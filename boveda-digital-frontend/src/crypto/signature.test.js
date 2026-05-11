import { describe, it, expect, beforeAll } from "vitest";
import sodium from "libsodium-wrappers";
import { signContainer, verifyContainer } from "./keyPair.js";

/**
 * Test suite for Ed25519 digital signatures over encrypted containers.
 *
 * Signed data: SHA-512(encryptedBytes || canonicalize(sortedShares))
 * - encryptedBytes represents the full encrypted file blob (header + metadata AAD + nonce + ciphertext)
 * - sortedShares represents the recipient list (sorted by user_id for determinism)
 */
describe("Firmas digitales Ed25519", () => {
  let pubKeyHex, privKey, signature;

  // Simulated encrypted container bytes (header | metadata | nonce | ciphertext)
  const encryptedBytes = new Uint8Array([
    0x00, 0x00, 0x00, 0x10, // 4-byte header length
    0x7b, 0x22, 0x61, 0x6c, 0x67, 0x22, 0x3a, 0x22, 0x63, 0x68, 0x61, 0x63, 0x68, 0x61, 0x22, 0x7d, // metadata JSON
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, // nonce
    0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe, // ciphertext + tag
  ]);

  const shares = [
    { encrypted_symmetric_key: "aabbccdd", user_id: 2 },
    { encrypted_symmetric_key: "eeff0011", user_id: 1 },
  ];
  const sortedShares = [...shares].sort((a, b) => a.user_id - b.user_id);

  beforeAll(async () => {
    await sodium.ready;
    const kp = sodium.crypto_sign_keypair();
    pubKeyHex = sodium.to_hex(kp.publicKey);
    privKey = kp.privateKey;
    // Generate the baseline signature for all tests
    signature = await signContainer(encryptedBytes, sortedShares, privKey);
  });

  it("firma válida es aceptada", async () => {
    const valid = await verifyContainer(encryptedBytes, sortedShares, signature, pubKeyHex);
    expect(valid).toBe(true);
  });

  it("ciphertext modificado es rechazado", async () => {
    // Flip a bit in the ciphertext area (last bytes)
    const tampered = new Uint8Array(encryptedBytes);
    tampered[tampered.length - 1] ^= 0xff;
    const valid = await verifyContainer(tampered, sortedShares, signature, pubKeyHex);
    expect(valid).toBe(false);
  });

  it("metadatos modificados son rechazados", async () => {
    // Flip a bit in the metadata header area (bytes 4–19)
    const tampered = new Uint8Array(encryptedBytes);
    tampered[4] ^= 0x01; // first byte of metadata JSON
    const valid = await verifyContainer(tampered, sortedShares, signature, pubKeyHex);
    expect(valid).toBe(false);
  });

  it("lista de destinatarios modificada es rechazada", async () => {
    // Modify one recipient's encrypted key
    const tamperedShares = sortedShares.map((s, i) =>
      i === 0 ? { ...s, encrypted_symmetric_key: "ffffffff" } : s
    );
    const valid = await verifyContainer(encryptedBytes, tamperedShares, signature, pubKeyHex);
    expect(valid).toBe(false);
  });

  it("clave pública incorrecta es rechazada", async () => {
    const wrongKp = sodium.crypto_sign_keypair();
    const wrongPubKeyHex = sodium.to_hex(wrongKp.publicKey);
    const valid = await verifyContainer(encryptedBytes, sortedShares, signature, wrongPubKeyHex);
    expect(valid).toBe(false);
  });

  it("firma ausente es rechazada", async () => {
    const valid = await verifyContainer(encryptedBytes, sortedShares, "", pubKeyHex);
    expect(valid).toBe(false);
  });

  it("firma null es rechazada", async () => {
    const valid = await verifyContainer(encryptedBytes, sortedShares, null, pubKeyHex);
    expect(valid).toBe(false);
  });

  it("firma de otro par de claves es rechazada", async () => {
    const otherKp = sodium.crypto_sign_keypair();
    const otherSig = await signContainer(encryptedBytes, sortedShares, otherKp.privateKey);
    // Verify with original public key → should fail
    const valid = await verifyContainer(encryptedBytes, sortedShares, otherSig, pubKeyHex);
    expect(valid).toBe(false);
  });
});
