import sodium from "libsodium-wrappers";

/**
 * Genera un par de claves X25519 (Curve25519) usando libsodium.
 * @returns {Promise<{publicKeyHex: string, privateKey: Uint8Array}>}
 */
export async function generateKeyPair() {
  await sodium.ready;
  const { publicKey, privateKey } = sodium.crypto_box_keypair();
  return {
    publicKeyHex: sodium.to_hex(publicKey),
    privateKey,
  };
}

/**
 * Cifra la clave privada de forma determinista usando la contraseña en claro.
 * Deriva una clave simétrica con BLAKE2b y un nonce determinista desde la
 * contraseña, luego cifra con XSalsa20-Poly1305 (crypto_secretbox).
 *
 * Formato de salida: [24 bytes nonce][ciphertext + 16 bytes MAC]
 *
 * @param {Uint8Array} privateKey - Clave privada en crudo
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<Uint8Array>} Clave privada cifrada
 */
export async function encryptPrivateKey(privateKey, password) {
  await sodium.ready;

  const symKey = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    sodium.from_string(password)
  );

  const nonce = sodium.crypto_generichash(
    sodium.crypto_secretbox_NONCEBYTES,
    sodium.from_string("boveda-privkey-nonce:" + password)
  );

  const ciphertext = sodium.crypto_secretbox_easy(privateKey, nonce, symKey);

  const output = new Uint8Array(nonce.length + ciphertext.length);
  output.set(nonce, 0);
  output.set(ciphertext, nonce.length);

  return output;
}

/**
 * Descifra la clave privada usando la contraseña en claro.
 * @param {Uint8Array} encryptedData - Datos cifrados [nonce][ciphertext]
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<Uint8Array>} Clave privada descifrada
 */
export async function decryptPrivateKey(encryptedData, password) {
  await sodium.ready;

  const NONCE_BYTES = sodium.crypto_secretbox_NONCEBYTES;
  const nonce = encryptedData.slice(0, NONCE_BYTES);
  const ciphertext = encryptedData.slice(NONCE_BYTES);

  const symKey = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    sodium.from_string(password)
  );

  const privateKey = sodium.crypto_secretbox_open_easy(ciphertext, nonce, symKey);
  if (!privateKey) {
    throw new Error("No se pudo descifrar la clave privada. Contraseña incorrecta.");
  }

  return privateKey;
}
