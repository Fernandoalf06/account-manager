import { getAccounts, getActiveSession, getQueue, getCurrentUser, getUserActiveSession, checkIn, checkOut, joinQueue, leaveQueue, getUserQueuePosition, formatDuration } from '../lib/store.js';
import { showToast, showModal, closeModal, avatarHtml } from '../lib/ui.js';

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
      <h2>Halo, ${user.name.split(' ')[0]}! 👋</h2>
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
    bindEvents(container, user);
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

  return `
    <div class="card account-card account-card--${statusClass} animate-in" style="animation-delay:${idx * 0.08}s" data-account-id="${account.id}">
      <div class="account-header">
        <div class="account-info">
          <div class="account-icon">${account.icon}</div>
          <div>
            <div class="account-name">${account.name}</div>
            <div class="account-desc">${account.description || ''}</div>
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
              <div class="session-username">${session.userName}${isMySession ? ' (Anda)' : ''}</div>
              ${session.taskDescription ? `<div class="session-task">📝 ${session.taskDescription}</div>` : ''}
            </div>
          </div>
          <div class="session-timer" data-start="${session.checkedInAt}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span class="timer-value">${formatDuration(Date.now() - new Date(session.checkedInAt).getTime())}</span>
          </div>
        </div>
      ` : ''}

      ${queue.length > 0 && !isMySession ? `
        <div class="queue-info">
          <div class="queue-avatars">
            ${queue.slice(0, 3).map(q => avatarHtml(q.userName, q.userColor, 24)).join('')}
          </div>
          <span>${queue.length} orang mengantri</span>
        </div>
      ` : ''}

      <div class="btn-row">
        ${isMySession ? `
          <button class="btn btn-danger btn-checkout" data-session-id="${session.id}" data-account="${account.name}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Check Out
          </button>
        ` : session ? `
          ${myQueuePos ? `
            <button class="btn btn-outline btn-leave-queue" data-account-id="${account.id}">Keluar Antrian (#${myQueuePos})</button>
          ` : `
            <button class="btn btn-warning btn-join-queue" data-account-id="${account.id}" ${userHasActiveSession ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Antri
            </button>
          `}
        ` : `
          <button class="btn btn-success btn-checkin" data-account-id="${account.id}" data-account-name="${account.name}" ${userHasActiveSession ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Check In
          </button>
        `}
      </div>
    </div>
  `;
}

function bindEvents(container, user) {
  // Check In
  container.querySelectorAll('.btn-checkin').forEach(btn => {
    btn.addEventListener('click', () => {
      const accountId = btn.dataset.accountId;
      const accountName = btn.dataset.accountName;
      showModal(`
        <h3 class="modal-title">Check In — ${accountName}</h3>
        <form id="checkin-form">
          <div class="form-group">
            <label class="form-label" for="task-desc">Apa yang akan dikerjakan? (opsional)</label>
            <input class="form-input" type="text" id="task-desc" placeholder="Contoh: Edit poster ibadah minggu" />
          </div>
          <button type="submit" class="btn btn-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            Mulai Pakai
          </button>
        </form>
      `);
      document.getElementById('checkin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const task = document.getElementById('task-desc').value.trim();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memproses...';

        const result = await checkIn(accountId, task);
        closeModal();
        if (result.error) { showToast(result.error, 'error'); }
        else { showToast(`Berhasil check in ke ${accountName}! ✅`, 'success'); }
        await renderDashboard(container);
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
}

function startTimers() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    document.querySelectorAll('.session-timer').forEach(el => {
      const start = el.dataset.start;
      if (start) {
        const elapsed = Date.now() - new Date(start).getTime();
        const timerVal = el.querySelector('.timer-value');
        if (timerVal) timerVal.textContent = formatDuration(elapsed);
      }
    });
  }, 1000);
}

export function destroyDashboard() {
  clearInterval(timerInterval);
  isRendering = false;
}
