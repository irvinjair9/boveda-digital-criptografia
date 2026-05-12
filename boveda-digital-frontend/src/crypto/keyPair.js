import sodium from "libsodium-wrappers-sumo";
import { canonicalizeToBytes } from "./canonicalize.js";

// BOV2: combined X25519 + Ed25519 keys, password-derived key via BLAKE2b (no salt) — deprecated
// BOV3: combined keys, password-derived key via Argon2id with random salt
const MAGIC_BOV2 = new Uint8Array([0x42, 0x4f, 0x56, 0x32]); // "BOV2"
const MAGIC_BOV3 = new Uint8Array([0x42, 0x4f, 0x56, 0x33]); // "BOV3"

// Argon2id parameters (INTERACTIVE profile: ~1 s, 64 MiB RAM)
const ARGON2_OPSLIMIT = 2;        // sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE
const ARGON2_MEMLIMIT = 67108864; // sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE (64 MiB)

/**
 * Derives a 32-byte symmetric key from a password and salt using Argon2id.
 */
function deriveKeyArgon2id(password, salt) {
  return sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    sodium.from_string(password),
    salt,
    ARGON2_OPSLIMIT,
    ARGON2_MEMLIMIT,
    sodium.crypto_pwhash_ALG_DEFAULT // Argon2id
  );
}

/**
 * Generates an X25519 keypair (for encryption) and an Ed25519 keypair (for signing).
 * Both private keys are stored together in a single encrypted file.
 */
export async function generateKeyPair() {
  await sodium.ready;
  const boxKp  = sodium.crypto_box_keypair();   // X25519
  const signKp = sodium.crypto_sign_keypair();  // Ed25519
  return {
    publicKeyHex:        sodium.to_hex(boxKp.publicKey),
    signingPublicKeyHex: sodium.to_hex(signKp.publicKey),
    privateKey:          boxKp.privateKey,
    signingPrivateKey:   signKp.privateKey,
  };
}

/**
 * Encrypts both private keys into a single file using Argon2id + XSalsa20-Poly1305.
 *
 * Output format (BOV3):
 *   [4 bytes "BOV3"][16 bytes Argon2id salt][24 bytes nonce][encrypted JSON + 16-byte MAC]
 * JSON payload: {"ed25519":"<hex>","x25519":"<hex>"}
 *
 * @param {Uint8Array} x25519PrivKey  - X25519 private key (32 bytes)
 * @param {Uint8Array} ed25519PrivKey - Ed25519 private key (64 bytes)
 * @param {string}     password
 * @returns {Promise<Uint8Array>}
 */
export async function encryptPrivateKey(x25519PrivKey, ed25519PrivKey, password) {
  await sodium.ready;

  const salt   = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES); // 16 bytes random
  const symKey = deriveKeyArgon2id(password, salt);
  const nonce  = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES); // 24 bytes random

  const payload = JSON.stringify({
    ed25519: sodium.to_hex(ed25519PrivKey),
    x25519:  sodium.to_hex(x25519PrivKey),
  });
  const payloadBytes = new TextEncoder().encode(payload);
  const ciphertext = sodium.crypto_secretbox_easy(payloadBytes, nonce, symKey);

  const output = new Uint8Array(MAGIC_BOV3.length + salt.length + nonce.length + ciphertext.length);
  output.set(MAGIC_BOV3, 0);
  output.set(salt,  MAGIC_BOV3.length);
  output.set(nonce, MAGIC_BOV3.length + salt.length);
  output.set(ciphertext, MAGIC_BOV3.length + salt.length + nonce.length);
  return output;
}

/**
 * Decrypts the private key file.
 * Supports:
 *   BOV3 — Argon2id + random salt (current)
 *   BOV2 — BLAKE2b-derived key, no salt (deprecated, transitional)
 *   legacy — X25519-only key, BLAKE2b (oldest format)
 *
 * @param {Uint8Array} encryptedData
 * @param {string}     password
 * @returns {Promise<{ x25519: Uint8Array, ed25519: Uint8Array|null }>}
 *   ed25519 is null when the file is in the legacy (X25519-only) format.
 */
export async function decryptPrivateKey(encryptedData, password) {
  await sodium.ready;

  const isBOV3 = encryptedData[0] === MAGIC_BOV3[0] && encryptedData[1] === MAGIC_BOV3[1] &&
                 encryptedData[2] === MAGIC_BOV3[2] && encryptedData[3] === MAGIC_BOV3[3];
  const isBOV2 = !isBOV3 &&
                 encryptedData[0] === MAGIC_BOV2[0] && encryptedData[1] === MAGIC_BOV2[1] &&
                 encryptedData[2] === MAGIC_BOV2[2] && encryptedData[3] === MAGIC_BOV2[3];

  if (isBOV3) {
    const SALT_BYTES  = sodium.crypto_pwhash_SALTBYTES;        // 16
    const NONCE_BYTES = sodium.crypto_secretbox_NONCEBYTES;    // 24
    const salt       = encryptedData.slice(4, 4 + SALT_BYTES);
    const nonce      = encryptedData.slice(4 + SALT_BYTES, 4 + SALT_BYTES + NONCE_BYTES);
    const ciphertext = encryptedData.slice(4 + SALT_BYTES + NONCE_BYTES);
    const symKey     = deriveKeyArgon2id(password, salt);
    const decrypted  = sodium.crypto_secretbox_open_easy(ciphertext, nonce, symKey);
    if (!decrypted) throw new Error("No se pudo descifrar. Contraseña incorrecta.");
    const { x25519, ed25519 } = JSON.parse(new TextDecoder().decode(decrypted));
    return {
      x25519:  sodium.from_hex(x25519),
      ed25519: sodium.from_hex(ed25519),
    };
  }

  if (isBOV2) {
    // Transitional: BOV2 used BLAKE2b (no salt). Still supported for existing files.
    const symKey = sodium.crypto_generichash(
      sodium.crypto_secretbox_KEYBYTES,
      sodium.from_string(password)
    );
    const NONCE_BYTES = sodium.crypto_secretbox_NONCEBYTES;
    const nonce      = encryptedData.slice(4, 4 + NONCE_BYTES);
    const ciphertext = encryptedData.slice(4 + NONCE_BYTES);
    const decrypted  = sodium.crypto_secretbox_open_easy(ciphertext, nonce, symKey);
    if (!decrypted) throw new Error("No se pudo descifrar. Contraseña incorrecta.");
    const { x25519, ed25519 } = JSON.parse(new TextDecoder().decode(decrypted));
    return {
      x25519:  sodium.from_hex(x25519),
      ed25519: sodium.from_hex(ed25519),
    };
  }

  // Legacy format: [24 bytes nonce][X25519 ciphertext + MAC] — BLAKE2b key, no signing key
  const symKey = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    sodium.from_string(password)
  );
  const NONCE_BYTES = sodium.crypto_secretbox_NONCEBYTES;
  const nonce      = encryptedData.slice(0, NONCE_BYTES);
  const ciphertext = encryptedData.slice(NONCE_BYTES);
  const privateKey = sodium.crypto_secretbox_open_easy(ciphertext, nonce, symKey);
  if (!privateKey) throw new Error("No se pudo descifrar la clave privada. Contraseña incorrecta.");
  return { x25519: privateKey, ed25519: null };
}

/**
 * Signs an encrypted container with Ed25519.
 *
 * Signed data: SHA-512(encryptedBytes || canonicalize(sortedShares))
 * - encryptedBytes covers: [headerLen][metadataAAD][nonce][ciphertext+tag]
 * - sortedShares covers the full recipient list (sorted by user_id for determinism)
 *
 * Hashing before signing makes the payload a fixed 64-byte digest regardless of
 * file size, while committing to every bit of the container and recipient list.
 *
 * @param {Uint8Array} encryptedBytes
 * @param {Array}      sortedShares   - [{encrypted_symmetric_key, user_id}] sorted by user_id asc
 * @param {Uint8Array} signingPrivKey - Ed25519 private key (64 bytes)
 * @returns {Promise<string>} Hex-encoded 64-byte signature
 */
export async function signContainer(encryptedBytes, sortedShares, signingPrivKey) {
  await sodium.ready;
  const sharesBytes = canonicalizeToBytes(sortedShares);
  const combined    = new Uint8Array(encryptedBytes.length + sharesBytes.length);
  combined.set(encryptedBytes, 0);
  combined.set(sharesBytes, encryptedBytes.length);
  const hash = sodium.crypto_hash(combined); // SHA-512
  const sig  = sodium.crypto_sign_detached(hash, signingPrivKey);
  return sodium.to_hex(sig);
}

/**
 * Verifies an Ed25519 signature over an encrypted container.
 * Returns false (never throws) so the caller decides how to handle rejection.
 *
 * @param {Uint8Array} encryptedBytes
 * @param {Array}      sortedShares
 * @param {string}     signatureHex
 * @param {string}     signerPubKeyHex - Signer's Ed25519 public key in hex (from users table)
 * @returns {Promise<boolean>}
 */
export async function verifyContainer(encryptedBytes, sortedShares, signatureHex, signerPubKeyHex) {
  await sodium.ready;
  if (!signatureHex || !signerPubKeyHex) return false;
  try {
    const sharesBytes = canonicalizeToBytes(sortedShares);
    const combined    = new Uint8Array(encryptedBytes.length + sharesBytes.length);
    combined.set(encryptedBytes, 0);
    combined.set(sharesBytes, encryptedBytes.length);
    const hash = sodium.crypto_hash(combined); // SHA-512
    return sodium.crypto_sign_verify_detached(
      sodium.from_hex(signatureHex),
      hash,
      sodium.from_hex(signerPubKeyHex)
    );
  } catch {
    return false;
  }
}
