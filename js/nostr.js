/**
 * Nostr relay pool management and event operations
 */
import { SimplePool, finalizeEvent } from '../lib/nostr-bundle.js';
import { CONFIG } from './config.js';

let pool = null;
let activeRelays = [];

/** Initialize relay pool */
export function initPool(relays) {
  pool = new SimplePool();
  activeRelays = relays && relays.length > 0
    ? relays : [...CONFIG.DEFAULT_RELAYS];
  return activeRelays;
}

/** Get the current relay list */
export function getRelays() {
  return [...activeRelays];
}

/** Update relay list */
export function setRelays(relays) {
  activeRelays = [...relays];
  localStorage.setItem(CONFIG.STORAGE_RELAYS, JSON.stringify(relays));
}

/** Load saved relays from localStorage */
export function loadSavedRelays() {
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_RELAYS);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

/**
 * Publish an event to relays
 * @param {object} eventTemplate - unsigned event template
 * @param {Uint8Array} secretKey - secret key for signing
 * @returns {object} the signed event
 */
export async function publishEvent(eventTemplate, secretKey) {
  if (!pool) throw new Error('Pool not initialized');
  const signed = finalizeEvent(eventTemplate, secretKey);
  await Promise.allSettled(
    pool.publish(activeRelays, signed)
  );
  return signed;
}

/**
 * Query events from relays
 * @param {object} filter - nostr filter
 * @returns {Promise<Array>} matching events
 */
export async function queryEvents(filter) {
  if (!pool) throw new Error('Pool not initialized');
  const events = await pool.querySync(activeRelays, filter);
  return events || [];
}

/**
 * Query a single event
 */
export async function getEvent(filter) {
  if (!pool) throw new Error('Pool not initialized');
  return await pool.get(activeRelays, filter);
}

/**
 * Publish a NIP-09 deletion event (kind 5)
 * @param {string[]} eventIds - IDs of events to delete
 * @param {Uint8Array} secretKey
 */
export async function publishDelete(eventIds, secretKey) {
  const tags = eventIds.map(id => ['e', id]);
  return publishEvent({
    kind: CONFIG.KIND_DELETE,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: 'delete'
  }, secretKey);
}

/** Close pool connections */
export function closePool() {
  if (pool) {
    pool.close(activeRelays);
    pool = null;
  }
}
