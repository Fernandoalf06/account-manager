import './styles/index.css';
import { getCurrentUser, logout, subscribe, setupRealtime, cleanupRealtime } from './lib/store.js';
import { showToast } from './lib/ui.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard, destroyDashboard } from './pages/dashboard.js';
import { renderHistory } from './pages/history.js';
import { renderAdmin } from './pages/admin.js';

let currentPage = 'dashboard';
let currentUser = null;
let navigationBound = false;
let unsubscribe = null;
let isNavigating = false;

function boot() {
  setTimeout(() => {
    document.getElementById('splash-screen').classList.add('hidden');
    document.getElementById('app').style.display = 'flex';

    const user = getCurrentUser();
    if (user) {
      showApp(user);
    } else {
      showLoginPage();
    }
  }, 800);
}

function showLoginPage() {
  document.getElementById('app-header').style.display = 'none';
  document.getElementById('bottom-nav').style.display = 'none';

  const main = document.getElementById('main-content');
  main.style.padding = '0';
  renderLogin(main, (user) => {
    main.style.padding = '';
    showApp(user);
  });
}

function showApp(user) {
  currentUser = user;
  document.getElementById('app-header').style.display = 'flex';
  document.getElementById('bottom-nav').style.display = 'flex';

  // User badge
  const badge = document.getElementById('user-badge');
  const avatar = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name');
  badge.style.display = 'flex';
  avatar.style.background = user.color;
  avatar.textContent = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  nameEl.textContent = user.name.split(' ')[0];

  // Show admin nav if admin
  const navAdmin = document.getElementById('nav-admin');
  const menuAdmin = document.getElementById('menu-admin');
  if (user.role === 'admin') {
    navAdmin.style.display = 'flex';
    menuAdmin.style.display = 'flex';
  } else {
    navAdmin.style.display = 'none';
    menuAdmin.style.display = 'none';
  }

  // Setup Supabase Realtime for live updates
  setupRealtime();

  // Unsubscribe old listener if exists (prevent stacking on re-login)
  if (unsubscribe) unsubscribe();

  // Subscribe to realtime changes -> auto-refresh current page
  unsubscribe = subscribe(() => {
    if (isNavigating) return; // Don't refresh while navigating
    const main = document.getElementById('main-content');
    if (currentPage === 'dashboard') {
      renderDashboard(main);
    } else if (currentPage === 'history') {
      renderHistory(main);
    } else if (currentPage === 'admin') {
      renderAdmin(main);
    }
  });

  navigateTo('dashboard');

  // Only bind navigation once (prevent event listener stacking)
  if (!navigationBound) {
    setupNavigation();
    navigationBound = true;
  }
}

async function navigateTo(page) {
  if (isNavigating) return;
  isNavigating = true;

  destroyDashboard();
  currentPage = page;
  const main = document.getElementById('main-content');
  const titleEl = document.getElementById('page-title');
  main.scrollTop = 0;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });

  switch (page) {
    case 'dashboard':
      titleEl.textContent = 'Dashboard';
      await renderDashboard(main);
      break;
    case 'history':
      titleEl.textContent = 'Riwayat';
      await renderHistory(main);
      break;
    case 'admin':
      titleEl.textContent = 'Admin';
      await renderAdmin(main);
      break;
  }

  // Close dropdown if open
  document.getElementById('dropdown-menu').style.display = 'none';
  isNavigating = false;
}

function setupNavigation() {
  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Dropdown menu toggle
  document.getElementById('btn-menu').addEventListener('click', () => {
    const menu = document.getElementById('dropdown-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });

  // Dropdown backdrop close
  document.querySelector('.dropdown-backdrop')?.addEventListener('click', () => {
    document.getElementById('dropdown-menu').style.display = 'none';
  });

  // Dropdown items
  document.querySelectorAll('.dropdown-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    document.getElementById('dropdown-menu').style.display = 'none';
    destroyDashboard(); // Clean up dashboard timer before logout
    await logout();
    currentUser = null;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    showToast('Anda telah logout. Sampai jumpa! 👋', 'info');
    showLoginPage();
  });
}

// Boot the app
document.addEventListener('DOMContentLoaded', boot);
