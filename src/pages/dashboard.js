import { getAccounts, getActiveSession, getQueue, getCurrentUser, getUserActiveSession, checkIn, checkOut, joinQueue, leaveQueue, getUserQueuePosition, formatDuration, extendSession } from '../lib/store.js';
import { showToast, showModal, closeModal, avatarHtml, escapeHtml } from '../lib/ui.js';

let timerInterval = null;
let isRendering = false;

export async function renderDashboard(container) {
  if (isRendering) return; // Prevent concurrent renders
  isRendering = true;

  clearInterval(timerInterval);
  const user = getCurrentUser();
  if (!user) { isRendering = false; return; }

  container.innerHTML = `
    <div class="page-greeting animate-in">
      <h2>Halo, ${escapeHtml(user.name.split(' ')[0])}! 👋</h2>
      <p>Cek ketersediaan akun di bawah ini</p>
    </div>
    <div class="page-section-title">Akun Bersama</div>
    <div id="accounts-list">
      <div style="text-align:center;padding:32px;color:var(--text-3);">
        <div class="loader-bar" style="width:60px;height:3px;background:var(--primary);border-radius:4px;margin:0 auto;animation:loading 1s ease-in-out infinite;"></div>
        <p style="margin-top:12px;font-size:13px;">Memuat akun...</p>
      </div>
    </div>
  `;

  try {
    const accounts = await getAccounts();
    const listEl = document.getElementById('accounts-list');
    if (!listEl) { isRendering = false; return; }

    if (accounts.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state animate-in">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8m-4-4h8"/></svg>
          <h3>Belum ada akun</h3>
          <p>Admin perlu menambahkan akun bersama terlebih dahulu.</p>
        </div>
      `;
      isRendering = false;
      return;
    }

    // Fetch data for each account
    const cardsHtml = [];
    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const [session, queue, userActiveSession, myQueuePos] = await Promise.all([
        getActiveSession(acc.id),
        getQueue(acc.id),
        getUserActiveSession(user.id),
        getUserQueuePosition(acc.id, user.id),
      ]);
      cardsHtml.push(renderAccountCard(acc, user, i, session, queue, !!userActiveSession, myQueuePos));
    }

    // Check if DOM still exists (user may have navigated away)
    const listCheck = document.getElementById('accounts-list');
    if (!listCheck) { isRendering = false; return; }

    listCheck.innerHTML = cardsHtml.join('');
    bindEvents(container, user, accounts);
    startTimers();
  } catch (e) {
    console.error('Dashboard render error:', e);
    const listEl = document.getElementById('accounts-list');
    if (listEl) {
      listEl.innerHTML = `
        <div class="empty-state animate-in">
          <h3>Gagal memuat</h3>
          <p>Terjadi kesalahan. Coba refresh halaman.</p>
        </div>
      `;
    }
  }

  isRendering = false;
}

function renderAccountCard(account, user, idx, session, queue, userHasActiveSession, myQueuePos) {
  const isMySession = session && session.userId === user.id;

  let statusClass = 'available';
  let statusLabel = 'Tersedia';
  let statusDotClass = 'available';

  if (session) {
    if (isMySession) {
      statusClass = 'my-session'; statusLabel = 'Anda Pakai'; statusDotClass = 'in-use';
    } else {
      statusClass = 'in-use'; statusLabel = 'Sedang Dipakai'; statusDotClass = 'in-use';
    }
  } else if (myQueuePos) {
    statusClass = 'queued'; statusLabel = `Antrian #${myQueuePos}`; statusDotClass = 'queued';
  }

  const escapedAccName = escapeHtml(account.name);
  const escapedAccDesc = escapeHtml(account.description || '');
  const escapedTaskDesc = session?.taskDescription ? escapeHtml(session.taskDescription) : '';

  return `
    <div class="card account-card account-card--${statusClass} animate-in" style="animation-delay:${idx * 0.08}s" data-account-id="${account.id}">
      <div class="account-header">
        <div class="account-info">
          <div class="account-icon">${escapeHtml(account.icon)}</div>
          <div>
            <div class="account-name">${escapedAccName}</div>
            <div class="account-desc">${escapedAccDesc}</div>
          </div>
        </div>
        <div class="status-badge status-badge--${session ? 'in-use' : myQueuePos ? 'queued' : 'available'}">
          <div class="status-dot status-dot--${statusDotClass}"></div>
          ${statusLabel}
        </div>
      </div>

      ${session ? `
        <div class="session-info">
          <div class="session-user">
            ${avatarHtml(session.userName, session.userColor, 32)}
            <div>
              <div class="session-username">${escapeHtml(session.userName)}${isMySession ? ' (Anda)' : ''}</div>
              ${escapedTaskDesc ? `<div class="session-task">📝 ${escapedTaskDesc}</div>` : ''}
            </div>
          </div>
          <div class="session-timer" data-start="${session.checkedInAt}" data-expected="${session.expectedCheckoutAt || ''}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span class="timer-value">${formatDuration(Date.now() - new Date(session.checkedInAt).getTime())}</span>
            <span class="overtime-badge" style="display:none; color:var(--danger); font-size:10px; font-weight:bold; margin-left:6px; background:#4a0000; padding:2px 6px; border-radius:4px;">OVERTIME</span>
          </div>
        </div>
      ` : ''}

      ${queue.length > 0 ? `
        <div class="queue-info">
          <div class="queue-avatars">
            ${queue.slice(0, 3).map(q => avatarHtml(q.userName, q.userColor, 24)).join('')}
          </div>
          <span>${queue.map(q => escapeHtml(q.userName.split(' ')[0])).join(', ')} mengantri</span>
        </div>
      ` : ''}

      <div class="btn-row">
        ${isMySession ? `
          <div style="display:flex;gap:8px;width:100%;">
            <button class="btn btn-outline btn-extend" data-session-id="${session.id}" data-account="${escapedAccName}" style="flex:1;">
              + Waktu
            </button>
            <button class="btn btn-danger btn-checkout" data-session-id="${session.id}" data-account="${escapedAccName}" style="flex:1;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Selesai
            </button>
          </div>
        ` : session ? `
          ${myQueuePos ? `
            <button class="btn btn-outline btn-leave-queue" data-account-id="${account.id}">Keluar Antrian (#${myQueuePos})</button>
          ` : `
            <button class="btn btn-warning btn-join-queue" data-account-id="${account.id}" ${userHasActiveSession ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Antri
            </button>
          `}
        ` : `
          <button class="btn btn-success btn-checkin" data-account-id="${account.id}" data-account-name="${escapedAccName}" ${userHasActiveSession ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Check In
          </button>
        `}
      </div>
    </div>
  `;
}

function bindEvents(container, user, accounts) {
  // Check In
  container.querySelectorAll('.btn-checkin').forEach(btn => {
    btn.addEventListener('click', () => {
      const accountId = btn.dataset.accountId;
      const accountName = btn.dataset.accountName;
      showModal(`
        <h3 class="modal-title">Check In — ${accountName}</h3>
        <form id="checkin-form">
          <div class="form-group">
            <label class="form-label" for="duration-select">Estimasi Waktu Penggunaan</label>
            <select class="form-input" id="duration-select" required>
              <option value="15">15 Menit</option>
              <option value="30" selected>30 Menit</option>
              <option value="60">1 Jam</option>
              <option value="120">2 Jam</option>
              <option value="0">Tanpa Batas</option>
            </select>
          </div>
          <button type="submit" class="btn btn-success" style="width:100%">
            Mulai Sesi
          </button>
        </form>
      `);
      document.getElementById('checkin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const durationMins = parseInt(document.getElementById('duration-select').value, 10);
        let expectedCheckoutAt = null;
        if (durationMins > 0) {
          expectedCheckoutAt = new Date(Date.now() + durationMins * 60000).toISOString();
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memproses...';

        const result = await checkIn(accountId, expectedCheckoutAt);
        if (result.error) { 
          closeModal();
          showToast(result.error, 'error'); 
        } else {
          // Check-in success, show credentials
          const acc = accounts.find(a => a.id === accountId);
          showModal(`
            <h3 class="modal-title">Berhasil Check In ✅</h3>
            <p style="font-size:13px;color:var(--text-2);margin-bottom:16px;">Berikut adalah informasi login untuk <b>${accountName}</b>:</p>
            
            <div class="form-group">
              <label class="form-label">Email / Username</label>
              <div style="display:flex;gap:8px;">
                <input class="form-input" type="text" id="cred-email" value="${escapeHtml(acc?.email || '')}" readonly />
                <button class="btn btn-outline" type="button" onclick="navigator.clipboard.writeText(document.getElementById('cred-email').value); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 2000);">Copy</button>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Password</label>
              <div style="display:flex;gap:8px;">
                <input class="form-input" type="text" id="cred-pass" value="${escapeHtml(acc?.password || '')}" readonly />
                <button class="btn btn-outline" type="button" onclick="navigator.clipboard.writeText(document.getElementById('cred-pass').value); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 2000);">Copy</button>
              </div>
            </div>
            
            ${acc?.credentials_note ? `<div style="font-size:12px;color:var(--warning);background:#332700;padding:8px;border-radius:6px;margin-bottom:16px;">⚠️ Catatan: ${escapeHtml(acc.credentials_note)}</div>` : ''}
            
            <button class="btn btn-primary" style="width:100%" onclick="window.closeModalAndRender()">Tutup</button>
          `);
          window.closeModalAndRender = async () => {
            closeModal();
            await renderDashboard(container);
          };
        }
      });
    });
  });

  // Check Out
  container.querySelectorAll('.btn-checkout').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Memproses...';
      const sessionId = btn.dataset.sessionId;
      const accountName = btn.dataset.account;
      const result = await checkOut(sessionId);
      if (result.error) { showToast(result.error, 'error'); }
      else {
        showToast(`Check out dari ${accountName} berhasil! 👋`, 'success');
        if (result.nextInQueue) {
          showToast(`${result.nextInQueue.userName} — giliran kamu! 🔔`, 'info');
        }
      }
      await renderDashboard(container);
    });
  });

  // Join Queue
  container.querySelectorAll('.btn-join-queue').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const result = await joinQueue(btn.dataset.accountId);
      if (result.error) showToast(result.error, 'error');
      else showToast('Anda masuk antrian! Akan diberitahu saat tersedia. ⏳', 'info');
      await renderDashboard(container);
    });
  });

  // Leave Queue
  container.querySelectorAll('.btn-leave-queue').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await leaveQueue(btn.dataset.accountId);
      showToast('Anda keluar dari antrian.', 'info');
      await renderDashboard(container);
    });
  });

  // Extend Session
  container.querySelectorAll('.btn-extend').forEach(btn => {
    btn.addEventListener('click', () => {
      const sessionId = btn.dataset.sessionId;
      showModal(`
        <h3 class="modal-title">Perpanjang Waktu</h3>
        <form id="extend-form">
          <div class="form-group">
            <label class="form-label" for="extend-select">Tambah Durasi</label>
            <select class="form-input" id="extend-select" required>
              <option value="15">15 Menit</option>
              <option value="30">30 Menit</option>
              <option value="60">1 Jam</option>
              <option value="120">2 Jam</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%">Perpanjang</button>
        </form>
      `);
      document.getElementById('extend-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const mins = parseInt(document.getElementById('extend-select').value, 10);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memproses...';
        
        const result = await extendSession(sessionId, mins);
        closeModal();
        if (result.error) showToast(result.error, 'error');
        else showToast('Waktu berhasil diperpanjang! ⏱️', 'success');
        await renderDashboard(container);
      });
    });
  });
}

function startTimers() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    document.querySelectorAll('.session-timer').forEach(el => {
      const start = el.dataset.start;
      const expected = el.dataset.expected;
      if (start) {
        const elapsed = Date.now() - new Date(start).getTime();
        const timerVal = el.querySelector('.timer-value');
        if (timerVal) timerVal.textContent = formatDuration(elapsed);

        if (expected) {
          const isOvertime = Date.now() > new Date(expected).getTime();
          const badge = el.querySelector('.overtime-badge');
          if (badge) badge.style.display = isOvertime ? 'inline-block' : 'none';
          if (isOvertime) timerVal.style.color = 'var(--danger)';
          else timerVal.style.color = 'inherit';
        }
      }
    });
  }, 1000);
}

export function destroyDashboard() {
  clearInterval(timerInterval);
  isRendering = false;
}
