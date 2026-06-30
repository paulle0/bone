/**
 * Blob operations - upload, download, delete
 * Implements the blobs_nip protocol (kind 3538 manifest, 3539 chunks)
 */
import { CONFIG } from './config.js';
import { publishEvent, queryEvents, publishDelete } from './nostr.js';
import {
  readFileAsArrayBuffer, arrayBufferToBase64,
  base64ToArrayBuffer, sha256Hex, chunkString, formatSize
} from './utils.js';

/**
 * Upload a file as blob events
 * @param {File} file
 * @param {Uint8Array} secretKey
 * @param {function} onProgress - callback(percent, message)
 * @returns {object} the manifest event
 */
export async function uploadFile(file, secretKey, onProgress) {
  onProgress(5, 'Reading file...');
  const buffer = await readFileAsArrayBuffer(file);
  const fileHash = await sha256Hex(buffer);

  onProgress(15, 'Encoding file...');
  const base64Data = arrayBufferToBase64(buffer);
  const chunks = chunkString(base64Data, CONFIG.MAX_CHUNK_CHARS);
  const totalChunks = chunks.length;

  // Publish manifest event (kind 3538)
  onProgress(20, 'Publishing manifest...');
  const manifest = await publishEvent({
    kind: CONFIG.KIND_MANIFEST,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['encryption', 'none'],
      ['encoding', 'base64'],
      ['filename', file.name],
      ['m', file.type || 'application/octet-stream'],
      ['x', fileHash],
      ['size', String(file.size)],
      ['chunks', String(totalChunks)]
    ],
    content: ''
  }, secretKey);

  // Publish chunk events (kind 3539)
  for (let i = 0; i < totalChunks; i++) {
    const pct = 20 + Math.floor(((i + 1) / totalChunks) * 75);
    onProgress(pct, `Uploading chunk ${i + 1}/${totalChunks}...`);

    await publishEvent({
      kind: CONFIG.KIND_CHUNK,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['chunk', String(i), String(totalChunks)],
        ['e', manifest.id]
      ],
      content: chunks[i]
    }, secretKey);
  }

  onProgress(100, 'Upload complete!');
  return manifest;
}

/**
 * List all manifest events for a given pubkey
 * @param {string} pubkey - hex pubkey
 * @returns {Array} manifest objects with parsed metadata
 */
export async function listFiles(pubkey) {
  const events = await queryEvents({
    kinds: [CONFIG.KIND_MANIFEST],
    authors: [pubkey]
  });

  // Also fetch deletion events to filter out deleted files
  const delEvents = await queryEvents({
    kinds: [CONFIG.KIND_DELETE],
    authors: [pubkey]
  });

  const deletedIds = new Set();
  for (const del of delEvents) {
    for (const tag of del.tags) {
      if (tag[0] === 'e') deletedIds.add(tag[1]);
    }
  }

  return events
    .filter(e => !deletedIds.has(e.id))
    .map(e => parseManifest(e))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Parse a manifest event into a readable object
 */
function parseManifest(event) {
  const getTag = (name) => {
    const tag = event.tags.find(t => t[0] === name);
    return tag ? tag[1] : null;
  };

  return {
    id: event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    filename: getTag('filename') || 'unknown',
    mime: getTag('m') || 'application/octet-stream',
    hash: getTag('x'),
    size: parseInt(getTag('size') || '0', 10),
    totalChunks: parseInt(getTag('chunks') || '0', 10),
    sizeFormatted: formatSize(parseInt(getTag('size') || '0', 10))
  };
}

/**
 * Download a file by its manifest ID
 * @param {string} manifestId
 * @param {function} onProgress
 * @returns {{ filename, mime, data: ArrayBuffer }}
 */
export async function downloadFile(manifestId, onProgress) {
  onProgress(5, 'Fetching manifest...');

  const manifests = await queryEvents({
    kinds: [CONFIG.KIND_MANIFEST],
    ids: [manifestId]
  });

  if (!manifests.length) throw new Error('Manifest not found');
  const manifest = parseManifest(manifests[0]);

  onProgress(10, `Fetching ${manifest.totalChunks} chunks...`);
  const chunkEvents = await queryEvents({
    kinds: [CONFIG.KIND_CHUNK],
    '#e': [manifestId]
  });

  if (chunkEvents.length < manifest.totalChunks) {
    throw new Error(
      `Incomplete: got ${chunkEvents.length}/${manifest.totalChunks} chunks`
    );
  }

  // Sort chunks by index
  const sorted = chunkEvents
    .map(e => {
      const tag = e.tags.find(t => t[0] === 'chunk');
      return { index: parseInt(tag[1], 10), content: e.content };
    })
    .sort((a, b) => a.index - b.index);

  onProgress(70, 'Reassembling file...');
  const base64Full = sorted.map(c => c.content).join('');
  const data = base64ToArrayBuffer(base64Full);

  onProgress(100, 'Download complete!');
  return { filename: manifest.filename, mime: manifest.mime, data };
}

/**
 * Delete a file (publish kind 5 deletion event)
 * @param {string} manifestId
 * @param {Uint8Array} secretKey
 */
export async function deleteFile(manifestId, secretKey) {
  // Fetch chunk event IDs to include in deletion
  const chunks = await queryEvents({
    kinds: [CONFIG.KIND_CHUNK],
    '#e': [manifestId]
  });

  const idsToDelete = [manifestId, ...chunks.map(c => c.id)];
  return publishDelete(idsToDelete, secretKey);
}

/**
 * Trigger a browser download for file data
 */
export function triggerDownload(filename, mime, data) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
