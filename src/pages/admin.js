import { getAccounts, getMembers, addAccount, removeAccount, editAccount, updateUserRole, removeMember, editMember, getCurrentUser } from '../lib/store.js';
import { showToast, showModal, closeModal, avatarHtml, escapeHtml } from '../lib/ui.js';

export async function renderAdmin(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    container.innerHTML = `<div class="empty-state animate-in"><h3>Akses Ditolak</h3><p>Hanya admin yang bisa mengakses halaman ini.</p></div>`;
    return;
  }

  container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-3);"><p style="font-size:13px;">Memuat panel admin...</p></div>`;

  const [accounts, members] = await Promise.all([getAccounts(), getMembers()]);
  const adminPin = import.meta.env.VITE_ADMIN_PIN || '8888';
  const memberPin = import.meta.env.VITE_MEMBER_PIN || '1234';

  container.innerHTML = `
    <div class="page-section-title animate-in">Panel Admin</div>

    <div class="card animate-in" style="animation-delay:0.05s; margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between; margin-bottom:12px;">
        <div>
          <div style="font-weight:700;font-size:14px;">PIN Admin</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px;">Akses halaman kelola ini</div>
        </div>
        <div style="background:var(--surface-2);padding:6px 12px;border-radius:6px;font-family:monospace;font-size:16px;font-weight:700;letter-spacing:2px;color:var(--primary);">${escapeHtml(adminPin)}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:700;font-size:14px;">PIN Member</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px;">Untuk login anggota biasa</div>
        </div>
        <div style="background:var(--surface-2);padding:6px 12px;border-radius:6px;font-family:monospace;font-size:16px;font-weight:700;letter-spacing:2px;color:var(--text-2);">${escapeHtml(memberPin)}</div>
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
            <span style="font-size:24px;">${escapeHtml(acc.icon)}</span>
            <div>
              <div style="font-weight:600;font-size:14px;">${escapeHtml(acc.name)}</div>
              <div style="font-size:11px;color:var(--text-3);">${escapeHtml(acc.description)}</div>
            </div>
          </div>
          <div class="admin-actions">
            <button class="btn btn-ghost btn-sm btn-edit-account" data-id="${acc.id}" style="width:auto;padding:6px;">✏️</button>
            <button class="btn btn-ghost btn-sm btn-del-account" data-id="${acc.id}" data-name="${escapeHtml(acc.name)}" style="width:auto;padding:6px;color:var(--danger);">🗑️</button>
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
              <div style="font-weight:600;font-size:14px;">${escapeHtml(m.name)} ${m.id === user.id ? '<span style="color:var(--primary);font-size:11px;">(Anda)</span>' : ''}</div>
              <div style="font-size:11px;color:${m.role === 'admin' ? 'var(--primary)' : 'var(--text-3)'};">${m.role === 'admin' ? '⭐ Admin' : 'Anggota'}</div>
            </div>
          </div>
          <div class="admin-actions">
            <button class="btn btn-ghost btn-sm btn-edit-member" data-id="${m.id}" style="width:auto;padding:6px;">✏️</button>
            ${m.id !== user.id ? `
              <button class="btn btn-ghost btn-sm btn-toggle-role" data-id="${m.id}" data-role="${m.role}" style="width:auto;padding:6px 10px;font-size:11px;">
                ${m.role === 'admin' ? 'Jadikan Member' : 'Jadikan Admin'}
              </button>
              <button class="btn btn-ghost btn-sm btn-del-member" data-id="${m.id}" data-name="${escapeHtml(m.name)}" style="width:auto;padding:6px;color:var(--danger);">🗑️</button>
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
        <div class="form-group"><label class="form-label">Email / Username</label><input class="form-input" type="text" id="acc-email" placeholder="Email akun" /></div>
        <div class="form-group"><label class="form-label">Password</label><input class="form-input" type="text" id="acc-password" placeholder="Password akun" /></div>
        <div class="form-group"><label class="form-label">Deskripsi Tambahan</label><input class="form-input" type="text" id="acc-desc" placeholder="Contoh: Edit video profesional" /></div>
        <div class="form-group"><label class="form-label">Catatan (Opsional)</label><input class="form-input" type="text" id="acc-cred" placeholder="Contoh: Jangan ubah profile" /></div>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </form>
    `);
    document.getElementById('add-account-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Menyimpan...';
      await addAccount({
        name: document.getElementById('acc-name').value.trim(),
        icon: document.getElementById('acc-icon').value.trim() || '📱',
        email: document.getElementById('acc-email').value.trim(),
        password: document.getElementById('acc-password').value.trim(),
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
        btn.disabled = true;
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
        <h3 class="modal-title">Edit — ${escapeHtml(acc.name)}</h3>
        <form id="edit-account-form">
          <div class="form-group"><label class="form-label">Icon</label><input class="form-input" type="text" id="edit-icon" value="${escapeHtml(acc.icon)}" /></div>
          <div class="form-group"><label class="form-label">Nama</label><input class="form-input" type="text" id="edit-name" value="${escapeHtml(acc.name)}" required /></div>
          <div class="form-group"><label class="form-label">Email / Username</label><input class="form-input" type="text" id="edit-email" value="${escapeHtml(acc.email || '')}" /></div>
          <div class="form-group"><label class="form-label">Password</label><input class="form-input" type="text" id="edit-password" value="${escapeHtml(acc.password || '')}" /></div>
          <div class="form-group"><label class="form-label">Deskripsi Tambahan</label><input class="form-input" type="text" id="edit-desc" value="${escapeHtml(acc.description || '')}" /></div>
          <div class="form-group"><label class="form-label">Catatan (Opsional)</label><input class="form-input" type="text" id="edit-cred" value="${escapeHtml(acc.credentials_note || '')}" /></div>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </form>
      `);
      document.getElementById('edit-account-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyimpan...';
        await editAccount(acc.id, {
          icon: document.getElementById('edit-icon').value.trim(),
          name: document.getElementById('edit-name').value.trim(),
          email: document.getElementById('edit-email').value.trim(),
          password: document.getElementById('edit-password').value.trim(),
          description: document.getElementById('edit-desc').value.trim(),
          credentials_note: document.getElementById('edit-cred').value.trim(),
        });
        closeModal(); showToast('Akun diperbarui! ✅', 'success');
        await renderAdmin(container);
      });
    });
  });

  container.querySelectorAll('.btn-edit-member').forEach(btn => {
    btn.addEventListener('click', () => {
      const member = members.find(m => m.id === btn.dataset.id);
      if (!member) return;
      showModal(`
        <h3 class="modal-title">Edit Anggota — ${escapeHtml(member.name)}</h3>
        <form id="edit-member-form">
          <div class="form-group"><label class="form-label">Nama Lengkap</label><input class="form-input" type="text" id="edit-member-name" value="${escapeHtml(member.name)}" required /></div>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </form>
      `);
      document.getElementById('edit-member-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyimpan...';
        await editMember(member.id, {
          name: document.getElementById('edit-member-name').value.trim(),
        });
        closeModal(); showToast('Anggota diperbarui! ✅', 'success');
        await renderAdmin(container);
      });
    });
  });

  container.querySelectorAll('.btn-toggle-role').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const newRole = btn.dataset.role === 'admin' ? 'member' : 'admin';
      await updateUserRole(btn.dataset.id, newRole);
      showToast(`Role diubah ke ${newRole}.`, 'info');
      await renderAdmin(container);
    });
  });

  container.querySelectorAll('.btn-del-member').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm(`Hapus anggota "${btn.dataset.name}"?`)) {
        btn.disabled = true;
        await removeMember(btn.dataset.id);
        showToast('Anggota dihapus.', 'info');
        await renderAdmin(container);
      }
    });
  });
}
