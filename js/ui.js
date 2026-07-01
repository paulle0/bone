/**
 * UI module - rendering, modals, toasts, file cards
 */
import { getFileIcon, formatDate, truncateHex } from './utils.js';
import { toggleTheme, getTheme } from './theme.js';

/** Icon glyphs for theme states */
const THEME_ICONS = { light: '🌙', dark: '☀️' };

/** Show a view, hide others */
export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === viewId);
  });
}

/** Create the theme toggle button (shared by login + dashboard) */
function createThemeButton() {
  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.title = 'Toggle dark / light mode';
  btn.textContent = THEME_ICONS[getTheme()];
  btn.onclick = () => {
    const next = toggleTheme();
    btn.textContent = THEME_ICONS[next];
  };
  return btn;
}

/** Render the header actions for logged-in user */
export function renderHeaderUser(npub, onRelays, onLogout) {
  const el = document.getElementById('header-actions');
  el.innerHTML = '';

  const info = document.createElement('span');
  info.className = 'user-info';
  info.innerHTML = `<span class="user-npub" title="${npub}">`
    + `${truncateHex(npub, 10, 6)}</span>`;
  el.appendChild(info);

  const relayBtn = document.createElement('button');
  relayBtn.className = 'btn btn-text btn-sm';
  relayBtn.textContent = 'Relays';
  relayBtn.onclick = onRelays;
  el.appendChild(relayBtn);

  el.appendChild(createThemeButton());

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-secondary btn-sm';
  logoutBtn.textContent = 'Logout';
  logoutBtn.onclick = onLogout;
  el.appendChild(logoutBtn);
}

/** Clear header actions and re-add theme toggle */
export function clearHeader() {
  const el = document.getElementById('header-actions');
  el.innerHTML = '';
  el.appendChild(createThemeButton());
}

/** Render file list */
export function renderFileList(files, onDownload, onDelete) {
  const grid = document.getElementById('file-list');
  grid.innerHTML = '';

  if (!files.length) {
    grid.innerHTML = '<div class="empty-state">'
      + '<p>No files uploaded yet.</p></div>';
    return;
  }

  for (const f of files) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
      <div class="file-card-header">
        <div class="file-icon">${getFileIcon(f.mime)}</div>
        <div>
          <div class="file-name">${escHtml(f.filename)}</div>
          <div class="file-meta">
            ${f.sizeFormatted} &middot; ${formatDate(f.createdAt)}
          </div>
        </div>
      </div>
      <div class="file-card-actions"></div>`;

    const actions = card.querySelector('.file-card-actions');

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn btn-secondary btn-sm';
    dlBtn.textContent = 'Download';
    dlBtn.onclick = () => onDownload(f);
    actions.appendChild(dlBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-sm';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => onDelete(f);
    actions.appendChild(delBtn);

    grid.appendChild(card);
  }
}

/** Show loading state in file list */
export function renderLoading() {
  const grid = document.getElementById('file-list');
  grid.innerHTML = '<div class="loading-state">'
    + '<div class="spinner"></div><p>Loading files...</p></div>';
}

/** Show a toast notification */
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** Open a modal with given HTML content */
export function openModal(contentHtml) {
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  container.innerHTML = contentHtml;
  overlay.classList.remove('hidden');

  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };
}

/** Close the modal */
export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-container').innerHTML = '';
}

/** Update modal content (for progress updates) */
export function updateModalContent(html) {
  document.getElementById('modal-container').innerHTML = html;
}

/** Escape HTML */
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
