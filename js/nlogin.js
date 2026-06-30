/**
 * nlogin module - implements the keyring_nip nlogin protocol
 *
 * nlogin bech32 format (NIP-19 style TLV):
 *   prefix: "nlogin"
 *   TLV 0: 32 bytes subkey secret key
 *   TLV 1: relay URL(s) (utf-8)
 *   TLV 2: 32 bytes masterkey pubkey
 *   TLV 3: keyring kind number (4 bytes, big-endian)
 */
import {
  bech32, hexToBytes, bytesToHex, getPublicKey
} from '../lib/nostr-bundle.js';

const NLOGIN_PREFIX = 'nlogin';
const TLV_SECRET_KEY = 0;
const TLV_RELAY = 1;
const TLV_PUBKEY = 2;
const TLV_KIND = 3;

/**
 * Decode an nlogin bech32 string
 * Returns { secretKey, pubkey, masterPubkey, relays, keyringKind }
 */
export function decodeNlogin(nloginStr) {
  const str = nloginStr.trim().toLowerCase();
  if (!str.startsWith(NLOGIN_PREFIX + '1')) {
    throw new Error('Invalid nlogin string: wrong prefix');
  }

  const decoded = bech32.decode(str, 5000);
  const data = bech32.fromWords(decoded.words);
  const bytes = new Uint8Array(data);

  let secretKey = null;
  let masterPubkey = null;
  const relays = [];
  let keyringKind = 17991;

  let pos = 0;
  while (pos < bytes.length) {
    const type = bytes[pos];
    const length = bytes[pos + 1];
    const value = bytes.slice(pos + 2, pos + 2 + length);
    pos += 2 + length;

    if (type === TLV_SECRET_KEY) {
      secretKey = value;
    } else if (type === TLV_RELAY) {
      const relay = new TextDecoder().decode(value);
      relays.push(relay);
    } else if (type === TLV_PUBKEY) {
      masterPubkey = bytesToHex(value);
    } else if (type === TLV_KIND) {
      keyringKind = (value[0] << 24) | (value[1] << 16)
        | (value[2] << 8) | value[3];
    }
  }

  if (!secretKey) {
    throw new Error('Invalid nlogin: missing secret key');
  }

  const pubkey = getPublicKey(secretKey);

  return {
    secretKey,
    pubkey,
    masterPubkey,
    relays: relays.length > 0 ? relays : null,
    keyringKind
  };
}

/**
 * Encode an nlogin bech32 string
 */
export function encodeNlogin(secretKey, relays, masterPubkey, kind) {
  const parts = [];

  // TLV 0: secret key
  const skBytes = typeof secretKey === 'string'
    ? hexToBytes(secretKey) : secretKey;
  parts.push(TLV_SECRET_KEY, skBytes.length, ...skBytes);

  // TLV 1: relays
  if (relays) {
    for (const relay of relays) {
      const relayBytes = new TextEncoder().encode(relay);
      parts.push(TLV_RELAY, relayBytes.length, ...relayBytes);
    }
  }

  // TLV 2: master pubkey
  if (masterPubkey) {
    const pkBytes = hexToBytes(masterPubkey);
    parts.push(TLV_PUBKEY, pkBytes.length, ...pkBytes);
  }

  // TLV 3: kind
  const k = kind || 17991;
  parts.push(TLV_KIND, 4,
    (k >> 24) & 0xff, (k >> 16) & 0xff,
    (k >> 8) & 0xff, k & 0xff
  );

  const words = bech32.toWords(new Uint8Array(parts));
  return bech32.encode(NLOGIN_PREFIX, words, 5000);
}

/**
 * Parse an nsec string or raw hex secret key
 * Returns { secretKey (Uint8Array), pubkey (hex string) }
 */
export function parseSecretKey(input) {
  const str = input.trim();

  if (str.startsWith('nsec1')) {
    const decoded = bech32.decode(str, 5000);
    const secretKey = new Uint8Array(bech32.fromWords(decoded.words));
    const pubkey = getPublicKey(secretKey);
    return { secretKey, pubkey };
  }

  // Assume hex
  if (/^[0-9a-fA-F]{64}$/.test(str)) {
    const secretKey = hexToBytes(str);
    const pubkey = getPublicKey(secretKey);
    return { secretKey, pubkey };
  }

  throw new Error('Invalid secret key format');
}
