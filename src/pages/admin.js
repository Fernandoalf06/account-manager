import { getAccounts, getMembers, addAccount, removeAccount, editAccount, updateUserRole, removeMember, getCurrentUser } from '../lib/store.js';
import { showToast, showModal, closeModal, avatarHtml } from '../lib/ui.js';

export async function renderAdmin(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    container.innerHTML = `<div class="empty-state animate-in"><h3>Akses Ditolak</h3><p>Hanya admin yang bisa mengakses halaman ini.</p></div>`;
    return;
  }

  container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-3);"><p style="font-size:13px;">Memuat panel admin...</p></div>`;

  const [accounts, members] = await Promise.all([getAccounts(), getMembers()]);
  const teamPin = import.meta.env.VITE_TEAM_PIN || '1234';

  container.innerHTML = `
    <div class="page-section-title animate-in">Panel Admin</div>

    <div class="card animate-in" style="animation-delay:0.05s;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:700;font-size:15px;">PIN Tim</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px;">Bagikan ke anggota baru untuk login</div>
        </div>
        <div style="background:var(--surface-2);padding:8px 16px;border-radius:8px;font-family:monospace;font-size:18px;font-weight:700;letter-spacing:4px;color:var(--primary);">${teamPin}</div>
      </div>
    </div>

    <div class="admin-section animate-in" style="animation-delay:0.1s;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div class="admin-section-title" style="margin-bottom:0;">Akun Bersama</div>
        <button class="btn btn-primary btn-sm" id="btn-add-account" style="width:auto;">+ Tambah</button>
      </div>
      ${accounts.map(acc => `
        <div class="admin-item">
          <div class="admin-item-info">
            <span style="font-size:24px;">${acc.icon}</span>
            <div>
              <div style="font-weight:600;font-size:14px;">${acc.name}</div>
              <div style="font-size:11px;color:var(--text-3);">${acc.description}</div>
            </div>
          </div>
          <div class="admin-actions">
            <button class="btn btn-ghost btn-sm btn-edit-account" data-id="${acc.id}" style="width:auto;padding:6px;">✏️</button>
            <button class="btn btn-ghost btn-sm btn-del-account" data-id="${acc.id}" data-name="${acc.name}" style="width:auto;padding:6px;color:var(--danger);">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="admin-section animate-in" style="animation-delay:0.15s;">
      <div class="admin-section-title">Anggota Tim (${members.length})</div>
      ${members.map(m => `
        <div class="admin-item">
          <div class="admin-item-info">
            ${avatarHtml(m.name, m.color, 32)}
            <div>
              <div style="font-weight:600;font-size:14px;">${m.name} ${m.id === user.id ? '<span style="color:var(--primary);font-size:11px;">(Anda)</span>' : ''}</div>
              <div style="font-size:11px;color:${m.role === 'admin' ? 'var(--primary)' : 'var(--text-3)'};">${m.role === 'admin' ? '⭐ Admin' : 'Anggota'}</div>
            </div>
          </div>
          <div class="admin-actions">
            ${m.id !== user.id ? `
              <button class="btn btn-ghost btn-sm btn-toggle-role" data-id="${m.id}" data-role="${m.role}" style="width:auto;padding:6px 10px;font-size:11px;">
                ${m.role === 'admin' ? 'Jadikan Member' : 'Jadikan Admin'}
              </button>
              <button class="btn btn-ghost btn-sm btn-del-member" data-id="${m.id}" data-name="${m.name}" style="width:auto;padding:6px;color:var(--danger);">🗑️</button>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  bindAdminEvents(container, accounts);
}

function bindAdminEvents(container, accounts) {
  document.getElementById('btn-add-account')?.addEventListener('click', () => {
    showModal(`
      <h3 class="modal-title">Tambah Akun Bersama</h3>
      <form id="add-account-form">
        <div class="form-group"><label class="form-label">Emoji Icon</label><input class="form-input" type="text" id="acc-icon" placeholder="🎨" maxlength="4" value="📱" /></div>
        <div class="form-group"><label class="form-label">Nama Akun</label><input class="form-input" type="text" id="acc-name" placeholder="Contoh: Adobe Premiere" required /></div>
        <div class="form-group"><label class="form-label">Deskripsi</label><input class="form-input" type="text" id="acc-desc" placeholder="Contoh: Edit video profesional" /></div>
        <div class="form-group"><label class="form-label">Catatan Kredensial</label><input class="form-input" type="text" id="acc-cred" placeholder="Email & password akun" /></div>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </form>
    `);
    document.getElementById('add-account-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await addAccount({
        name: document.getElementById('acc-name').value.trim(),
        icon: document.getElementById('acc-icon').value.trim() || '📱',
        description: document.getElementById('acc-desc').value.trim(),
        credentials_note: document.getElementById('acc-cred').value.trim(),
      });
      closeModal();
      showToast('Akun berhasil ditambahkan! ✅', 'success');
      await renderAdmin(container);
    });
  });

  container.querySelectorAll('.btn-del-account').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm(`Hapus akun "${btn.dataset.name}"?`)) {
        await removeAccount(btn.dataset.id);
        showToast('Akun dihapus.', 'info');
        await renderAdmin(container);
      }
    });
  });

  container.querySelectorAll('.btn-edit-account').forEach(btn => {
    btn.addEventListener('click', () => {
      const acc = accounts.find(a => a.id === btn.dataset.id);
      if (!acc) return;
      showModal(`
        <h3 class="modal-title">Edit — ${acc.name}</h3>
        <form id="edit-account-form">
          <div class="form-group"><label class="form-label">Icon</label><input class="form-input" type="text" id="edit-icon" value="${acc.icon}" /></div>
          <div class="form-group"><label class="form-label">Nama</label><input class="form-input" type="text" id="edit-name" value="${acc.name}" required /></div>
          <div class="form-group"><label class="form-label">Deskripsi</label><input class="form-input" type="text" id="edit-desc" value="${acc.description || ''}" /></div>
          <div class="form-group"><label class="form-label">Kredensial</label><input class="form-input" type="text" id="edit-cred" value="${acc.credentials_note || ''}" /></div>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </form>
      `);
      document.getElementById('edit-account-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await editAccount(acc.id, {
          icon: document.getElementById('edit-icon').value.trim(),
          name: document.getElementById('edit-name').value.trim(),
          description: document.getElementById('edit-desc').value.trim(),
          credentials_note: document.getElementById('edit-cred').value.trim(),
        });
        closeModal(); showToast('Akun diperbarui! ✅', 'success');
        await renderAdmin(container);
      });
    });
  });

  container.querySelectorAll('.btn-toggle-role').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newRole = btn.dataset.role === 'admin' ? 'member' : 'admin';
      await updateUserRole(btn.dataset.id, newRole);
      showToast(`Role diubah ke ${newRole}.`, 'info');
      await renderAdmin(container);
    });
  });

  container.querySelectorAll('.btn-del-member').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm(`Hapus anggota "${btn.dataset.name}"?`)) {
        await removeMember(btn.dataset.id);
        showToast('Anggota dihapus.', 'info');
        await renderAdmin(container);
      }
    });
  });
}
