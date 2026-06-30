/**
 * Modal builders - upload, delete confirmation, relay settings
 */
import { openModal, closeModal, updateModalContent, showToast } from './ui.js';
import { uploadFile, deleteFile, downloadFile, triggerDownload } from './blobs.js';
import { getRelays, setRelays } from './nostr.js';
import { formatSize } from './utils.js';

function progressHtml(title, pct, msg) {
  return `<h3>${title}</h3>
    <p class="progress-text">${msg}</p>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${pct}%"></div>
    </div><p class="progress-text">${pct}%</p>`;
}

/** Show the upload file modal */
export function showUploadModal(secretKey, onComplete) {
  openModal(`<h3>Upload File</h3>
    <div class="upload-area" id="upload-drop">
      <div class="icon">📁</div>
      <p>Click or drag a file here</p>
      <input type="file" id="upload-input" style="display:none">
    </div>
    <div id="upload-file-info" class="upload-file-info" style="display:none"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="modal-upload" disabled>Upload</button>
    </div>`);

  let selectedFile = null;
  const dropArea = document.getElementById('upload-drop');
  const fileInput = document.getElementById('upload-input');
  const info = document.getElementById('upload-file-info');
  const uploadBtn = document.getElementById('modal-upload');

  dropArea.onclick = () => fileInput.click();
  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
  dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('dragover');
  });
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) selectFile(e.dataTransfer.files[0]);
  });
  fileInput.onchange = () => {
    if (fileInput.files.length) selectFile(fileInput.files[0]);
  };

  function selectFile(file) {
    selectedFile = file;
    info.style.display = 'block';
    info.textContent = `${file.name} (${formatSize(file.size)})`;
    uploadBtn.disabled = false;
  }

  document.getElementById('modal-cancel').onclick = closeModal;
  uploadBtn.onclick = async () => {
    if (!selectedFile) return;
    uploadBtn.disabled = true;
    try {
      await uploadFile(selectedFile, secretKey, (pct, msg) => {
        updateModalContent(progressHtml('Uploading...', pct, msg));
      });
      closeModal();
      showToast('File uploaded successfully!', 'success');
      onComplete();
    } catch (err) {
      closeModal();
      showToast('Upload failed: ' + err.message, 'error');
    }
  };
}

/** Show delete confirmation modal */
export function showDeleteModal(file, secretKey, onComplete) {
  openModal(`<h3>Delete File</h3>
    <p>Are you sure you want to delete <strong>${file.filename}</strong>?</p>
    <p style="color:var(--gray-500);font-size:0.85rem;margin-top:8px">
      This publishes a deletion request to relays. Relays may or may not honor it.</p>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-danger" id="modal-confirm">Delete</button>
    </div>`);

  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-confirm').onclick = async () => {
    const btn = document.getElementById('modal-confirm');
    btn.disabled = true;
    btn.textContent = 'Deleting...';
    try {
      await deleteFile(file.id, secretKey);
      closeModal();
      showToast('Deletion request sent.', 'success');
      onComplete();
    } catch (err) {
      closeModal();
      showToast('Delete failed: ' + err.message, 'error');
    }
  };
}

/** Download a file with progress and trigger browser save */
export async function handleDownload(file) {
  openModal(progressHtml('Downloading...', 0, 'Preparing...'));
  try {
    const result = await downloadFile(file.id, (pct, msg) => {
      updateModalContent(progressHtml('Downloading...', pct, msg));
    });
    closeModal();
    triggerDownload(result.filename, result.mime, result.data);
    showToast('Download complete!', 'success');
  } catch (err) {
    closeModal();
    showToast('Download failed: ' + err.message, 'error');
  }
}

/** Show relay configuration modal */
export function showRelayModal() {
  openModal(`<h3>Relay Settings</h3>
    <div id="relay-list"></div>
    <div class="relay-input-row">
      <input type="text" id="relay-new" placeholder="wss://relay.example.com">
      <button class="btn btn-secondary btn-sm" id="relay-add">Add</button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" id="relay-done">Done</button>
    </div>`);

  function renderRelays() {
    const list = document.getElementById('relay-list');
    const current = getRelays();
    list.innerHTML = current.map((r, i) =>
      `<span class="relay-tag">${r}<button data-idx="${i}">&times;</button></span>`
    ).join('');
    list.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        const updated = getRelays().filter((_, j) => j !== parseInt(btn.dataset.idx));
        if (!updated.length) { showToast('Need at least one relay.', 'error'); return; }
        setRelays(updated);
        renderRelays();
      };
    });
  }
  renderRelays();

  document.getElementById('relay-add').onclick = () => {
    const input = document.getElementById('relay-new');
    const url = input.value.trim();
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      showToast('Relay URL must start with wss://', 'error'); return;
    }
    const current = getRelays();
    if (current.includes(url)) { showToast('Relay already added.', 'info'); return; }
    setRelays([...current, url]);
    input.value = '';
    renderRelays();
  };
  document.getElementById('relay-done').onclick = closeModal;
}
