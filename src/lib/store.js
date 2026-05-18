/**
 * store.js — Supabase-backed multi-user reactive data store
 * All data is stored in Supabase for real-time multi-user sync.
 */
import { getSupabase, isSupabaseConfigured } from './supabase.js';

const USER_KEY = 'accmgr_user';
const listeners = new Set();

// ---- Reactive subscriptions ----
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Debounced notify to prevent flooding from rapid Supabase events
let notifyTimer = null;
function notify() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    listeners.forEach(fn => { try { fn(); } catch(e) { console.error(e); } });
  }, 300);
}

// ---- Supabase Realtime ----
let realtimeChannel = null;

export function setupRealtime() {
  const sb = getSupabase();
  if (!sb || realtimeChannel) return;

  realtimeChannel = sb.channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => notify())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, () => notify())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_accounts' }, () => notify())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => notify())
    .subscribe();
}

export function cleanupRealtime() {
  if (realtimeChannel) {
    const sb = getSupabase();
    if (sb) sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ---- User Auth (Local PIN-based, user record stored in Supabase) ----
export function getCurrentUser() {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export async function login(name, pin) {
  const adminPin = import.meta.env.VITE_ADMIN_PIN || '8888';
  const memberPin = import.meta.env.VITE_MEMBER_PIN || '1234';
  
  let role = '';
  if (pin === adminPin) role = 'admin';
  else if (pin === memberPin) role = 'member';
  else return { error: 'PIN salah! Masukkan PIN Admin atau Member yang benar.' };

  const sb = getSupabase();
  if (!sb) return { error: 'Supabase belum dikonfigurasi. Periksa file .env Anda.' };

  try {
    // Check if member exists by name (case-insensitive)
    const { data: existing, error: fetchErr } = await sb
      .from('members').select('*').ilike('name', name.trim()).limit(1);

    if (fetchErr) return { error: 'Gagal menghubungi server: ' + fetchErr.message };

    let member;
    if (existing && existing.length > 0) {
      member = existing[0];
      // Sync role if they log in with a different PIN level, and reactivate if deleted
      if (member.role !== role || member.is_active === false) {
        await sb.from('members').update({ role, is_active: true }).eq('id', member.id);
        member.role = role;
      }
    } else {
      const color = generateColor(name);
      const { data, error } = await sb.from('members').insert({
        name: name.trim(), role, color
      }).select().single();

      if (error) return { error: 'Gagal mendaftar: ' + error.message };
      member = data;
    }

    const user = { id: member.id, name: member.name, role: member.role, color: member.color };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return { user };
  } catch (e) {
    return { error: 'Koneksi gagal. Periksa internet Anda.' };
  }
}

export async function logout() {
  const user = getCurrentUser();
  if (user) {
    const sb = getSupabase();
    if (sb) {
      try {
        // Check out any active sessions
        const { data: activeSessions } = await sb.from('sessions')
          .select('id').eq('user_id', user.id).eq('status', 'active');
        if (activeSessions && activeSessions.length > 0) {
          for (const s of activeSessions) {
            await checkOut(s.id);
          }
        }
        // Remove from any queues
        await sb.from('queue').delete().eq('user_id', user.id);
      } catch (e) {
        console.error('Logout cleanup error:', e);
      }
    }
  }
  localStorage.removeItem(USER_KEY);
  cleanupRealtime();
  listeners.clear();
}

export async function updateUserRole(userId, role) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from('members').update({ role }).eq('id', userId);
  if (error) return;
  // Sync local user if it's the current user
  const curr = getCurrentUser();
  if (curr && curr.id === userId) {
    curr.role = role;
    localStorage.setItem(USER_KEY, JSON.stringify(curr));
  }
}

// ---- Accounts ----
export async function getAccounts() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('shared_accounts')
    .select('*').eq('is_active', true).order('created_at');
  return error ? [] : (data || []);
}

export async function addAccount(account) {
  const sb = getSupabase();
  if (!sb) return { error: 'Tidak terhubung.' };
  const { error } = await sb.from('shared_accounts').insert({
    name: account.name,
    icon: account.icon || '📱',
    description: account.description || '',
    credentials_note: account.credentials_note || '',
    premium_expiry_date: account.premiumExpiryDate || null,
  });
  return error ? { error: error.message } : { success: true };
}

export async function removeAccount(id) {
  const sb = getSupabase();
  if (!sb) return;
  // Clean up related queue entries first
  await sb.from('queue').delete().eq('account_id', id);
  // Complete active sessions instead of deleting (preserves history)
  await sb.from('sessions').update({
    status: 'completed',
    checked_out_at: new Date().toISOString(),
  }).eq('account_id', id).eq('status', 'active');
  // Soft-delete the account
  await sb.from('shared_accounts').update({ is_active: false }).eq('id', id);
}

export async function editAccount(id, updates) {
  const sb = getSupabase();
  if (!sb) return;
  const dbUpdates = { ...updates };
  if (dbUpdates.premiumExpiryDate !== undefined) {
    dbUpdates.premium_expiry_date = dbUpdates.premiumExpiryDate || null;
    delete dbUpdates.premiumExpiryDate;
  }
  await sb.from('shared_accounts').update(dbUpdates).eq('id', id);
}

// ---- Sessions (Check In / Out) ----
export async function getActiveSession(accountId) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from('sessions')
    .select('*, members(name, color)')
    .eq('account_id', accountId).eq('status', 'active')
    .order('checked_in_at', { ascending: false })
    .limit(1).maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    accountId: data.account_id,
    userId: data.user_id,
    userName: data.members?.name || 'Unknown',
    userColor: data.members?.color || '#6366f1',
    checkedInAt: data.checked_in_at,
    expectedCheckoutAt: data.expected_checkout_at,
    taskDescription: data.task_description,
    status: data.status,
  };
}

export async function getUserActiveSession(userId) {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.from('sessions')
    .select('*').eq('user_id', userId).eq('status', 'active');
  return data || [];
}

export async function checkIn(accountId, expectedCheckoutAt) {
  const user = getCurrentUser();
  if (!user) return { error: 'Anda belum login.' };
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase belum terhubung.' };

  // Check if user already has an active session ON THIS account
  const { data: mySession } = await sb.from('sessions')
    .select('id').eq('account_id', accountId).eq('user_id', user.id).eq('status', 'active')
    .maybeSingle();
  if (mySession) return { error: 'Anda sudah menggunakan akun ini.' };

  // Check if account is already in use
  const activeSession = await getActiveSession(accountId);
  if (activeSession) return { error: 'Akun sedang digunakan orang lain.' };

  const { data, error } = await sb.from('sessions').insert({
    account_id: accountId,
    user_id: user.id,
    task_description: '',
    status: 'active',
    expected_checkout_at: expectedCheckoutAt
  }).select().single();

  if (error) return { error: 'Gagal check in: ' + error.message };

  // Remove user from queue for this account (if they were waiting)
  await sb.from('queue').delete().eq('account_id', accountId).eq('user_id', user.id);

  return { session: data };
}

export async function extendSession(sessionId, extraMinutes) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase belum terhubung.' };
  
  const { data: session } = await sb.from('sessions').select('expected_checkout_at').eq('id', sessionId).maybeSingle();
  if (!session) return { error: 'Sesi tidak ditemukan.' };
  
  let currentExpected = session.expected_checkout_at ? new Date(session.expected_checkout_at) : new Date();
  if (currentExpected.getTime() < Date.now()) {
    currentExpected = new Date(); // If already overtime, add time from NOW
  }
  
  const newExpected = new Date(currentExpected.getTime() + extraMinutes * 60000);
  
  const { error } = await sb.from('sessions').update({
    expected_checkout_at: newExpected.toISOString()
  }).eq('id', sessionId);
  
  return error ? { error: error.message } : { success: true };
}

export async function checkOut(sessionId) {
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase belum terhubung.' };

  // Get session info first
  const { data: session, error: fetchErr } = await sb
    .from('sessions').select('*').eq('id', sessionId).maybeSingle();
  if (fetchErr || !session) return { error: 'Sesi tidak ditemukan.' };
  if (session.status === 'completed') return { error: 'Sesi sudah selesai.' };

  // Update session
  const { error } = await sb.from('sessions').update({
    status: 'completed',
    checked_out_at: new Date().toISOString(),
  }).eq('id', sessionId);

  if (error) return { error: 'Gagal check out: ' + error.message };

  // Find next in queue for notification
  const { data: nextQueue } = await sb.from('queue')
    .select('*, members(name)')
    .eq('account_id', session.account_id)
    .order('position').limit(1).maybeSingle();

  return {
    session,
    nextInQueue: nextQueue ? { userName: nextQueue.members?.name || 'Seseorang' } : null,
  };
}

// ---- Queue ----
export async function getQueue(accountId) {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.from('queue')
    .select('*, members(name, color)')
    .eq('account_id', accountId)
    .order('position');
  return (data || []).map(q => ({
    id: q.id, accountId: q.account_id, userId: q.user_id,
    userName: q.members?.name || 'Unknown', userColor: q.members?.color || '#6366f1',
    position: q.position,
  }));
}

export async function getUserQueuePosition(accountId, userId) {
  const queue = await getQueue(accountId);
  const idx = queue.findIndex(q => q.userId === userId);
  return idx === -1 ? null : idx + 1;
}

export async function joinQueue(accountId) {
  const user = getCurrentUser();
  if (!user) return { error: 'Anda belum login.' };
  const sb = getSupabase();
  if (!sb) return { error: 'Supabase belum terhubung.' };

  // Already in queue?
  const { data: existing } = await sb.from('queue')
    .select('id').eq('account_id', accountId).eq('user_id', user.id).limit(1);
  if (existing && existing.length > 0) return { error: 'Anda sudah di antrian.' };

  // Check if user has active session on this account
  const activeSession = await getActiveSession(accountId);
  if (activeSession && activeSession.userId === user.id) {
    return { error: 'Anda sedang menggunakan akun ini. Tidak perlu mengantri.' };
  }

  // Get current max position
  const { data: lastInQueue } = await sb.from('queue')
    .select('position').eq('account_id', accountId)
    .order('position', { ascending: false }).limit(1).maybeSingle();

  const nextPosition = (lastInQueue?.position || 0) + 1;

  const { data, error } = await sb.from('queue').insert({
    account_id: accountId,
    user_id: user.id,
    position: nextPosition,
  }).select().single();

  if (error) return { error: 'Gagal masuk antrian: ' + error.message };
  return { entry: data };
}

export async function leaveQueue(accountId) {
  const user = getCurrentUser();
  if (!user) return { error: 'Anda belum login.' };
  const sb = getSupabase();
  if (!sb) return;

  // Get user's position first
  const { data: myEntry } = await sb.from('queue')
    .select('id, position').eq('account_id', accountId).eq('user_id', user.id).maybeSingle();

  if (!myEntry) return { success: true };

  // Delete the entry
  await sb.from('queue').delete().eq('id', myEntry.id);

  // Reindex positions for entries after the removed one
  const { data: remaining } = await sb.from('queue')
    .select('id, position').eq('account_id', accountId)
    .gt('position', myEntry.position).order('position');

  if (remaining && remaining.length > 0) {
    for (const entry of remaining) {
      await sb.from('queue').update({ position: entry.position - 1 }).eq('id', entry.id);
    }
  }

  return { success: true };
}

// ---- History ----
export async function getHistory(limit = 50) {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('sessions')
    .select('*, members(name, color), shared_accounts(name, icon)')
    .eq('status', 'completed')
    .not('checked_out_at', 'is', null)
    .order('checked_out_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(h => ({
    id: h.id,
    accountId: h.account_id,
    accountName: h.shared_accounts?.name || 'Akun Dihapus',
    accountIcon: h.shared_accounts?.icon || '📱',
    userId: h.user_id,
    userName: h.members?.name || 'Unknown',
    userColor: h.members?.color || '#6366f1',
    checkedInAt: h.checked_in_at,
    checkedOutAt: h.checked_out_at,
    taskDescription: h.task_description,
    duration: h.checked_out_at && h.checked_in_at
      ? new Date(h.checked_out_at).getTime() - new Date(h.checked_in_at).getTime()
      : 0,
  }));
}

// ---- Members ----
export async function getMembers() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb.from('members').select('*').eq('is_active', true).order('created_at');
  return data || [];
}

export async function removeMember(id) {
  const sb = getSupabase();
  if (!sb) return;
  // Remove their queue entries first (FK constraint)
  await sb.from('queue').delete().eq('user_id', id);
  // Complete any active sessions instead of deleting
  await sb.from('sessions').update({
    status: 'completed',
    checked_out_at: new Date().toISOString(),
  }).eq('user_id', id).eq('status', 'active');
  // Soft delete member to preserve history
  await sb.from('members').update({ is_active: false }).eq('id', id);
}

export async function editMember(id, updates) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from('members').update(updates).eq('id', id);
  
  // Sync if it's the current user
  const curr = getCurrentUser();
  if (curr && curr.id === id) {
    if (updates.name) curr.name = updates.name;
    if (updates.role) curr.role = updates.role;
    localStorage.setItem(USER_KEY, JSON.stringify(curr));
  }
}

// ---- Helpers ----
function generateColor(name) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f59e0b','#10b981','#06b6d4','#3b82f6','#a855f7','#14b8a6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function formatDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}j ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}d`;
  return `${secs}d`;
}

export function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'Baru saja';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  return `${days} hari lalu`;
}
