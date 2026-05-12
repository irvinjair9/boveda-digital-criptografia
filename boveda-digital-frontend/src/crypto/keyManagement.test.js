import { describe, it, expect, beforeAll } from "vitest";
import sodium from "libsodium-wrappers-sumo";
import {
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
} from "./keyPair.js";

/**
 * Test suite for D6 — Key Management.
 *
 * Covers: correct password grants access, wrong password is rejected,
 * tampered keystore is rejected, backup/restore round-trip works,
 * stolen keystore alone (without password) cannot decrypt.
 */
describe("Gestión de claves (D6)", () => {
  const CORRECT_PASSWORD = "P@ssw0rd-S3gur0!";
  const WRONG_PASSWORD   = "contraseña-incorrecta";

  let x25519PrivKey;
  let ed25519PrivKey;
  let x25519PubKeyHex;
  let ed25519PubKeyHex;
  let encryptedKeystore; // BOV3 blob

  beforeAll(async () => {
    await sodium.ready;
    const kp = await generateKeyPair();
    x25519PubKeyHex  = kp.publicKeyHex;
    ed25519PubKeyHex = kp.signingPublicKeyHex;
    x25519PrivKey    = kp.privateKey;
    ed25519PrivKey   = kp.signingPrivateKey;

    encryptedKeystore = await encryptPrivateKey(x25519PrivKey, ed25519PrivKey, CORRECT_PASSWORD);
  });

  // ── Format ──────────────────────────────────────────────────────────────

  it("el keystore generado comienza con el magic BOV3", async () => {
    expect(encryptedKeystore[0]).toBe(0x42); // B
    expect(encryptedKeystore[1]).toBe(0x4f); // O
    expect(encryptedKeystore[2]).toBe(0x56); // V
    expect(encryptedKeystore[3]).toBe(0x33); // 3
  });

  it("el keystore tiene el tamaño mínimo esperado (magic + salt + nonce + payload + MAC)", async () => {
    await sodium.ready;
    const SALT_BYTES  = sodium.crypto_pwhash_SALTBYTES;
    const NONCE_BYTES = sodium.crypto_secretbox_NONCEBYTES;
    const MAC_BYTES   = sodium.crypto_secretbox_MACBYTES;
    const MIN_SIZE    = 4 + SALT_BYTES + NONCE_BYTES + MAC_BYTES + 10; // +10 for minimal JSON
    expect(encryptedKeystore.length).toBeGreaterThan(MIN_SIZE);
  });

  it("dos keystores del mismo par de claves tienen sales distintas (no determinista)", async () => {
    const second = await encryptPrivateKey(x25519PrivKey, ed25519PrivKey, CORRECT_PASSWORD);
    // Salt occupies bytes 4–19; different random salt → different ciphertext
    const salt1 = encryptedKeystore.slice(4, 20);
    const salt2 = second.slice(4, 20);
    expect(salt1).not.toEqual(salt2);
    expect(second).not.toEqual(encryptedKeystore);
  });

  // ── Acceso correcto ──────────────────────────────────────────────────────

  it("contraseña correcta descifra las claves privadas sin error", async () => {
    const keys = await decryptPrivateKey(encryptedKeystore, CORRECT_PASSWORD);
    expect(keys.x25519).toBeInstanceOf(Uint8Array);
    expect(keys.ed25519).toBeInstanceOf(Uint8Array);
    expect(keys.x25519.length).toBe(32);
    expect(keys.ed25519.length).toBe(64);
  });

  it("las claves recuperadas coinciden con las originales", async () => {
    const keys = await decryptPrivateKey(encryptedKeystore, CORRECT_PASSWORD);
    expect(sodium.to_hex(keys.x25519)).toBe(sodium.to_hex(x25519PrivKey));
    expect(sodium.to_hex(keys.ed25519)).toBe(sodium.to_hex(ed25519PrivKey));
  });

  // ── Acceso incorrecto ────────────────────────────────────────────────────

  it("contraseña incorrecta lanza un error (acceso denegado)", async () => {
    await expect(decryptPrivateKey(encryptedKeystore, WRONG_PASSWORD)).rejects.toThrow();
  });

  it("contraseña vacía lanza un error", async () => {
    await expect(decryptPrivateKey(encryptedKeystore, "")).rejects.toThrow();
  });

  // ── Integridad del keystore ──────────────────────────────────────────────

  it("keystore con un byte modificado en el cuerpo cifrado es rechazado", async () => {
    const tampered = new Uint8Array(encryptedKeystore);
    // Flip a bit well inside the ciphertext area (after magic + salt + nonce)
    const flipOffset = 4 + sodium.crypto_pwhash_SALTBYTES + sodium.crypto_secretbox_NONCEBYTES + 5;
    tampered[flipOffset] ^= 0xff;
    await expect(decryptPrivateKey(tampered, CORRECT_PASSWORD)).rejects.toThrow();
  });

  it("keystore con salt modificada no puede ser descifrado con la contraseña correcta", async () => {
    const tampered = new Uint8Array(encryptedKeystore);
    tampered[5] ^= 0x01; // flip a bit in the salt (bytes 4–19)
    await expect(decryptPrivateKey(tampered, CORRECT_PASSWORD)).rejects.toThrow();
  });

  it("keystore truncado es rechazado", async () => {
    const truncated = encryptedKeystore.slice(0, 20);
    await expect(decryptPrivateKey(truncated, CORRECT_PASSWORD)).rejects.toThrow();
  });

  // ── Copia de seguridad / restauración ───────────────────────────────────

  it("copia y restauración del keystore reproduce las claves originales", async () => {
    // Simulate backup: copy bytes → restore → decrypt
    const backup  = new Uint8Array(encryptedKeystore);
    const keys    = await decryptPrivateKey(backup, CORRECT_PASSWORD);
    expect(sodium.to_hex(keys.x25519)).toBe(sodium.to_hex(x25519PrivKey));
    expect(sodium.to_hex(keys.ed25519)).toBe(sodium.to_hex(ed25519PrivKey));
  });

  // ── Keystore robado sin contraseña ───────────────────────────────────────

  it("el keystore cifrado no expone claves privadas en texto plano", async () => {
    // Verify that neither private key appears as a raw hex substring in the ciphertext
    const keystoreHex   = sodium.to_hex(encryptedKeystore);
    const x25519Hex     = sodium.to_hex(x25519PrivKey);
    const ed25519Hex    = sodium.to_hex(ed25519PrivKey);
    expect(keystoreHex).not.toContain(x25519Hex);
    expect(keystoreHex).not.toContain(ed25519Hex);
  });

  // ── Compatibilidad con formato legado ────────────────────────────────────

  it("formato legado (solo X25519) devuelve ed25519: null", async () => {
    await sodium.ready;
    // Build a minimal legacy keystore: [24-byte nonce][ciphertext] with BLAKE2b-derived key
    const password   = "old-password";
    const symKey     = sodium.crypto_generichash(
      sodium.crypto_secretbox_KEYBYTES,
      sodium.from_string(password)
    );
    const privKey    = sodium.randombytes_buf(32);
    const nonce      = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = sodium.crypto_secretbox_easy(privKey, nonce, symKey);
    const legacy     = new Uint8Array(nonce.length + ciphertext.length);
    legacy.set(nonce, 0);
    legacy.set(ciphertext, nonce.length);

    const keys = await decryptPrivateKey(legacy, password);
    expect(keys.ed25519).toBeNull();
    expect(sodium.to_hex(keys.x25519)).toBe(sodium.to_hex(privKey));
  });
});
