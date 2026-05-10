import sodium from "libsodium-wrappers";
import { canonicalizeToBytes } from "./canonicalize.js";

// Magic marker to distinguish combined-key format (BOV2) from legacy (X25519-only)
const MAGIC = new Uint8Array([0x42, 0x4f, 0x56, 0x32]); // "BOV2"

/**
 * Generates an X25519 keypair (for encryption) and an Ed25519 keypair (for signing).
 * Both private keys are meant to be stored together in a single encrypted file.
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
 * Encrypts both private keys into a single file using XSalsa20-Poly1305.
 *
 * Output format: [4 bytes "BOV2"][24 bytes nonce][encrypted JSON + 16 MAC]
 * JSON payload:  {"ed25519":"<hex>","x25519":"<hex>"}
 *
 * @param {Uint8Array} x25519PrivKey  - X25519 private key (32 bytes)
 * @param {Uint8Array} ed25519PrivKey - Ed25519 private key (64 bytes)
 * @param {string}     password
 * @returns {Promise<Uint8Array>}
 */
export async function encryptPrivateKey(x25519PrivKey, ed25519PrivKey, password) {
  await sodium.ready;

  const symKey = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    sodium.from_string(password)
  );
  const nonce = sodium.crypto_generichash(
    sodium.crypto_secretbox_NONCEBYTES,
    sodium.from_string("boveda-privkey-nonce:" + password)
  );

  const payload = JSON.stringify({
    ed25519: sodium.to_hex(ed25519PrivKey),
    x25519:  sodium.to_hex(x25519PrivKey),
  });
  const payloadBytes = new TextEncoder().encode(payload);
  const ciphertext = sodium.crypto_secretbox_easy(payloadBytes, nonce, symKey);

  const output = new Uint8Array(MAGIC.length + nonce.length + ciphertext.length);
  output.set(MAGIC, 0);
  output.set(nonce, MAGIC.length);
  output.set(ciphertext, MAGIC.length + nonce.length);
  return output;
}

/**
 * Decrypts the private key file.
 * Supports both the new combined format (BOV2) and the legacy X25519-only format.
 *
 * @param {Uint8Array} encryptedData
 * @param {string}     password
 * @returns {Promise<{ x25519: Uint8Array, ed25519: Uint8Array|null }>}
 *   ed25519 is null when the file is in the legacy format (only X25519 key inside).
 */
export async function decryptPrivateKey(encryptedData, password) {
  await sodium.ready;

  const symKey = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    sodium.from_string(password)
  );

  const isBOV2 = encryptedData[0] === MAGIC[0] && encryptedData[1] === MAGIC[1] &&
                 encryptedData[2] === MAGIC[2] && encryptedData[3] === MAGIC[3];

  if (isBOV2) {
    const nonce      = encryptedData.slice(4, 4 + sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = encryptedData.slice(4 + sodium.crypto_secretbox_NONCEBYTES);
    const decrypted  = sodium.crypto_secretbox_open_easy(ciphertext, nonce, symKey);
    if (!decrypted) throw new Error("No se pudo descifrar. Contraseña incorrecta.");
    const { x25519, ed25519 } = JSON.parse(new TextDecoder().decode(decrypted));
    return {
      x25519:  sodium.from_hex(x25519),
      ed25519: sodium.from_hex(ed25519),
    };
  } else {
    // Legacy format: [24 bytes nonce][X25519 ciphertext + MAC]
    const NONCE_BYTES = sodium.crypto_secretbox_NONCEBYTES;
    const nonce      = encryptedData.slice(0, NONCE_BYTES);
    const ciphertext = encryptedData.slice(NONCE_BYTES);
    const privateKey = sodium.crypto_secretbox_open_easy(ciphertext, nonce, symKey);
    if (!privateKey) throw new Error("No se pudo descifrar la clave privada. Contraseña incorrecta.");
    return { x25519: privateKey, ed25519: null };
  }
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
