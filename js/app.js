/**
 * bone - blobs over nostr events
 * Main application controller
 */
import { decodeNlogin, parseSecretKey } from './nlogin.js';
import {
  initPool, loadSavedRelays, closePool, getRelays
} from './nostr.js';
import { listFiles } from './blobs.js';
import {
  showView, renderHeaderUser, clearHeader,
  renderFileList, renderLoading, showToast
} from './ui.js';
import {
  showUploadModal, showDeleteModal,
  handleDownload, showRelayModal
} from './modals.js';
import { bytesToHex } from '../lib/nostr-bundle.js';
import { CONFIG } from './config.js';

let session = null; // { secretKey, pubkey, masterPubkey, relays }

/** App initialization */
function init() {
  document.getElementById('btn-login').onclick = handleNloginLogin;
  document.getElementById('btn-nsec-login').onclick = handleNsecLogin;
  document.getElementById('btn-upload').onclick = () => {
    showUploadModal(session.secretKey, refreshFiles);
  };
  document.getElementById('btn-refresh').onclick = refreshFiles;

  // Check for saved session
  tryRestoreSession();
}

/** Handle nlogin string login */
async function handleNloginLogin() {
  const input = document.getElementById('nlogin-input').value.trim();
  if (!input) {
    showToast('Please paste an nlogin string.', 'error');
    return;
  }

  try {
    const result = decodeNlogin(input);
    const relays = result.relays || loadSavedRelays()
      || CONFIG.DEFAULT_RELAYS;

    session = {
      secretKey: result.secretKey,
      pubkey: result.pubkey,
      masterPubkey: result.masterPubkey,
      relays
    };

    saveSession();
    initPool(relays);
    enterDashboard();
  } catch (err) {
    showToast('Invalid nlogin: ' + err.message, 'error');
  }
}

/** Handle nsec / hex secret key login */
async function handleNsecLogin() {
  const input = document.getElementById('nsec-input').value.trim();
  if (!input) {
    showToast('Please enter an nsec or hex key.', 'error');
    return;
  }

  try {
    const result = parseSecretKey(input);
    const relays = loadSavedRelays() || CONFIG.DEFAULT_RELAYS;

    session = {
      secretKey: result.secretKey,
      pubkey: result.pubkey,
      masterPubkey: null,
      relays
    };

    saveSession();
    initPool(relays);
    enterDashboard();
  } catch (err) {
    showToast('Invalid key: ' + err.message, 'error');
  }
}

/** Transition to the dashboard view */
function enterDashboard() {
  showView('dashboard-view');
  renderHeaderUser(
    session.pubkey,
    showRelayModal,
    handleLogout
  );
  refreshFiles();
}

/** Refresh file list from relays */
async function refreshFiles() {
  renderLoading();
  try {
    const files = await listFiles(session.pubkey);
    renderFileList(
      files,
      (f) => handleDownload(f),
      (f) => showDeleteModal(f, session.secretKey, refreshFiles)
    );
  } catch (err) {
    showToast('Failed to load files: ' + err.message, 'error');
    renderFileList([], () => {}, () => {});
  }
}

/** Logout */
function handleLogout() {
  session = null;
  localStorage.removeItem(CONFIG.STORAGE_SESSION);
  closePool();
  clearHeader();
  showView('login-view');
  document.getElementById('nlogin-input').value = '';
  document.getElementById('nsec-input').value = '';
  showToast('Logged out.', 'info');
}

/** Save session to localStorage (stores hex key) */
function saveSession() {
  if (!session) return;
  const data = {
    sk: bytesToHex(session.secretKey),
    pubkey: session.pubkey,
    masterPubkey: session.masterPubkey,
    relays: session.relays
  };
  localStorage.setItem(CONFIG.STORAGE_SESSION, JSON.stringify(data));
}

/** Try to restore session from localStorage */
function tryRestoreSession() {
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_SESSION);
    if (!saved) return;

    const data = JSON.parse(saved);
    const { secretKey } = parseSecretKey(data.sk);

    session = {
      secretKey,
      pubkey: data.pubkey,
      masterPubkey: data.masterPubkey,
      relays: data.relays || CONFIG.DEFAULT_RELAYS
    };

    initPool(session.relays);
    enterDashboard();
  } catch {
    localStorage.removeItem(CONFIG.STORAGE_SESSION);
  }
}

// Start the app
init();
