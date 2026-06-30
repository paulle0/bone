// bone app configuration
export const CONFIG = {
  // Default relays to use
  DEFAULT_RELAYS: [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band'
  ],

  // Nostr event kinds for blobs NIP
  KIND_MANIFEST: 3538,
  KIND_CHUNK: 3539,
  KIND_DELETE: 5,

  // Keyring NIP kinds
  KIND_KEYRING_PUBLIC: 17991,

  // Max chunk content size in characters (~48KB base64 ≈ 36KB raw)
  MAX_CHUNK_CHARS: 48000,

  // Storage keys
  STORAGE_RELAYS: 'bone_relays',
  STORAGE_SESSION: 'bone_session'
};
