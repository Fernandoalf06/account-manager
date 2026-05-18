import { getHistory, formatDuration, formatTimeAgo } from '../lib/store.js';
import { avatarHtml } from '../lib/ui.js';

export async function renderHistory(container) {
  container.innerHTML = `
    <div class="page-section-title animate-in">Riwayat Penggunaan</div>
    <div id="history-content">
      <div style="text-align:center;padding:32px;color:var(--text-3);">
        <div class="loader-bar" style="width:60px;height:3px;background:var(--primary);border-radius:4px;margin:0 auto;animation:loading 1s ease-in-out infinite;"></div>
        <p style="margin-top:12px;font-size:13px;">Memuat riwayat...</p>
      </div>
    </div>
  `;

  const history = await getHistory();
  const contentEl = document.getElementById('history-content');
  if (!contentEl) return;

  if (history.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state animate-in">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <h3>Belum ada riwayat</h3>
        <p>Riwayat penggunaan akun akan muncul di sini setelah ada yang check out.</p>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = `
    <div class="card animate-in">
      ${history.map(h => `
        <div class="history-item">
          ${avatarHtml(h.userName, h.userColor, 36)}
          <div class="history-details">
            <div class="history-name">${h.userName}</div>
            <div class="history-account">${h.accountIcon} ${h.accountName}${h.taskDescription ? ` — ${h.taskDescription}` : ''}</div>
            <div class="history-time">${formatTimeAgo(h.checkedOutAt)}</div>
          </div>
          <div class="history-duration">${formatDuration(h.duration)}</div>
        </div>
      `).join('')}
    </div>
  `;
}
