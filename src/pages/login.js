import { login } from '../lib/store.js';
import { showToast } from '../lib/ui.js';

export function renderLogin(container, onSuccess) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-logo">
        <svg width="80" height="80" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="16" fill="url(#lgrd)"/>
          <path d="M32 18C25.373 18 20 23.373 20 30C20 34.418 22.549 38.229 26.2 40.174V42C26.2 43.105 27.095 44 28.2 44H35.8C36.905 44 37.8 43.105 37.8 42V40.174C41.451 38.229 44 34.418 44 30C44 23.373 38.627 18 32 18Z" fill="white" opacity="0.9"/>
          <rect x="28" y="45" width="8" height="3" rx="1.5" fill="white" opacity="0.6"/>
          <defs><linearGradient id="lgrd" x1="0" y1="0" x2="64" y2="64"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
        </svg>
      </div>
      <h1 class="login-title">Account Manager</h1>
      <p class="login-subtitle">Kelola akun bersama tim dengan mudah</p>

      <form id="login-form" class="login-form">
        <div class="form-group">
          <label class="form-label" for="login-name">Nama Lengkap</label>
          <input class="form-input" type="text" id="login-name" placeholder="Contoh: Fernando" required autocomplete="name" />
        </div>
        <div class="form-group">
          <label class="form-label" for="login-pin">PIN Tim</label>
          <input class="form-input" type="password" id="login-pin" placeholder="Masukkan PIN dari admin" required inputmode="numeric" maxlength="8" />
        </div>
        <button type="submit" class="btn btn-primary" id="login-btn" style="margin-top:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Masuk
        </button>
        <p style="text-align:center;margin-top:16px;font-size:12px;color:var(--text-3);">
          Orang pertama yang login akan menjadi Admin
        </p>
      </form>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('login-name').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const btn = document.getElementById('login-btn');

    if (!name || name.length < 2) { showToast('Masukkan nama lengkap Anda', 'error'); return; }
    if (!pin) { showToast('Masukkan PIN tim', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = 'Memproses...';

    const result = await login(name, pin);
    if (result.error) {
      showToast(result.error, 'error');
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Masuk`;
    } else {
      showToast(`Selamat datang, ${result.user.name}! 🎉`, 'success');
      onSuccess(result.user);
    }
  });
}
