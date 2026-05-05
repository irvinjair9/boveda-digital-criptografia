import sodium from "libsodium-wrappers";
import { canonicalizeToBytes } from "./canonicalize.js";

/**
 * Formato del archivo .encrypted:
 *   [ 4 bytes uint32 BE: longitud del header JSON ]
 *   [ N bytes: header JSON con metadata canónica (AAD) ]
 *   [ 12 bytes: nonce ]
 *   [ M bytes: ciphertext + 16 bytes Poly1305 tag ]
 *
 * Los metadatos canónicos (algorithm, createdAt, fileName, fileSize, version) se usan como AAD (Additional
 * Associated Data). Poly1305 los autentica junto con el ciphertext, por lo que
 * cualquier modificación a estos campos hace que la desencriptación falle.
 * 
 * La metadata canónica garantiza determinismo: dos archivos con los mismos valores
 * en los mismos campos producirán exactamente los mismos bytes (independiente del orden
 * en que se escriban las claves).
 */

const HEADER_LENGTH_BYTES = 4; // uint32 big-endian que indica el tamaño del JSON

function encodeHeaderLength(len) {
  const buf = new Uint8Array(4);
  buf[0] = (len >>> 24) & 0xff;
  buf[1] = (len >>> 16) & 0xff;
  buf[2] = (len >>> 8) & 0xff;
  buf[3] = len & 0xff;
  return buf;
}

function decodeHeaderLength(buf) {
  return (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
}

/**
 * Encripta un archivo usando ChaCha20-Poly1305 con metadatos autenticados (AAD).
 * 
 * La metadata se canonicaliza completamente y se usa como AAD (Additional Associated Data).
 * Esto asegura que cualquier modificación a los metadatos invalida el archivo descifrado.
 * 
 * @param {Uint8Array} fileBuffer - Contenido del archivo
 * @param {string} fileName - Nombre original del archivo
 * @param {number} fileSize - Tamaño original en bytes
 * @returns {Promise<{encrypted: Uint8Array, key: string, nonce: string, metadata: Object}>}
 */
export async function encryptFile(fileBuffer, fileName = "", fileSize = 0) {
  await sodium.ready;

  const key = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_ietf_KEYBYTES);
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);

  // Metadatos canónicos que se autenticarán pero NO se cifrarán
  // Estructura: { algorithm, createdAt, fileName, fileSize, version }
  const metadata = {
    algorithm: "ChaCha20-Poly1305",
    createdAt: new Date().toISOString(),
    fileName,
    fileSize,
    version: 1
  };
  const metadataBytes = canonicalizeToBytes(metadata);

  // Cifrar con AAD = metadatos canónicos
  const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
    fileBuffer,
    metadataBytes, // AAD: autenticado pero no cifrado
    null,
    nonce,
    key
  );

  // El tag Poly1305 son los últimos 16 bytes del ciphertext
  const MACBYTES = sodium.crypto_aead_chacha20poly1305_ietf_ABYTES; // 16
  const tag = sodium.to_hex(ciphertext.slice(-MACBYTES));

  // Ensamblar: [4 bytes longitud header][header JSON][nonce][ciphertext]
  const headerLen = encodeHeaderLength(metadataBytes.length);
  const output = new Uint8Array(
    HEADER_LENGTH_BYTES + metadataBytes.length + nonce.length + ciphertext.length
  );
  let offset = 0;
  output.set(headerLen, offset);       offset += HEADER_LENGTH_BYTES;
  output.set(metadataBytes, offset);   offset += metadataBytes.length;
  output.set(nonce, offset);           offset += nonce.length;
  output.set(ciphertext, offset);

  return {
    encrypted: output,
    key: sodium.to_hex(key),
    nonce: sodium.to_hex(nonce),
    tag,       // ← tag Poly1305 en hex para mostrar en UI
    metadata
  };
}

/**
 * Desencripta un archivo cifrado con ChaCha20-Poly1305.
 * Verifica que el nombre del archivo y los metadatos internos no hayan sido modificados.
 * @param {Uint8Array} encryptedBuffer - Archivo .encrypted completo
 * @param {string} keyHex - Clave en hexadecimal
 * @param {string} currentFileName - Nombre actual del archivo subido (para validar contra el header)
 * @returns {Promise<{data: Uint8Array, metadata: Object}>}
 */
export async function decryptFile(encryptedBuffer, keyHex, currentFileName = null) {
  await sodium.ready;

  console.log("🔍 Debug decryptFile — buffer length:", encryptedBuffer?.length);

  try {
    if (!keyHex) throw new Error("La clave es requerida");
    if (!/^[0-9a-fA-F]+$/.test(keyHex)) throw new Error("La clave debe ser hexadecimal válida");

    const KEYBYTES  = sodium.crypto_aead_chacha20poly1305_ietf_KEYBYTES;
    const NPUBBYTES = sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES;

    const key = sodium.from_hex(keyHex);
    if (key.length !== KEYBYTES) {
      throw new Error(`KEY_INVALID: Clave incorrecta — se esperaban ${KEYBYTES * 2} caracteres hex, se recibieron ${keyHex.length}`);
    }

    if (encryptedBuffer.length < HEADER_LENGTH_BYTES + NPUBBYTES + 16) {
      throw new Error("METADATA_TAMPERED: El archivo está corrupto o fue modificado");
    }

    // Leer longitud del header
    let offset = 0;
    const headerLen = decodeHeaderLength(encryptedBuffer.slice(offset, offset + HEADER_LENGTH_BYTES));
    offset += HEADER_LENGTH_BYTES;

    if (encryptedBuffer.length < HEADER_LENGTH_BYTES + headerLen + NPUBBYTES + 16) {
      throw new Error("METADATA_TAMPERED: El archivo está corrupto o los metadatos fueron alterados");
    }

    // Leer header JSON (AAD)
    const metadataBytes = encryptedBuffer.slice(offset, offset + headerLen);
    offset += headerLen;

    let metadata;
    try {
      metadata = JSON.parse(new TextDecoder().decode(metadataBytes));
    } catch {
      throw new Error("METADATA_TAMPERED: Los metadatos del archivo fueron modificados o el archivo está corrupto");
    }

    // Validar que el nombre del archivo no haya cambiado
    if (currentFileName !== null && metadata.fileName) {
      const expectedName = metadata.fileName + ".encrypted";
      if (currentFileName !== expectedName && currentFileName !== metadata.fileName) {
        throw new Error(
          `METADATA_TAMPERED: El nombre del archivo fue modificado. Se esperaba "${expectedName}", se recibió "${currentFileName}"`
        );
      }
    }

    // Leer nonce y ciphertext
    const nonce      = encryptedBuffer.slice(offset, offset + NPUBBYTES);
    const ciphertext = encryptedBuffer.slice(offset + NPUBBYTES);

    // Extraer el tag (últimos 16 bytes del ciphertext)
    const MACBYTES = sodium.crypto_aead_chacha20poly1305_ietf_ABYTES;
    const tag = sodium.to_hex(ciphertext.slice(-MACBYTES));

    console.log("  - Metadatos:", metadata);
    console.log("  - nonce (hex):", sodium.to_hex(nonce));
    console.log("  - tag (hex):", tag);

    let decrypted;
    try {
      decrypted = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
        null,
        ciphertext,
        metadataBytes,
        nonce,
        key
      );
    } catch {
      throw new Error("KEY_INVALID: Clave incorrecta — no se puede descifrar el archivo con esta clave");
    }

    console.log("  ✅ Desencriptación exitosa, tamaño:", decrypted.length);
    return { data: new Uint8Array(decrypted), metadata, nonce: sodium.to_hex(nonce), tag };

  } catch (error) {
    console.error("❌ Error en decryptFile:", error);
    throw error;
  }
}

/**
 * Genera una clave ChaCha20 válida
 * @returns {Promise<string>} Clave en formato hexadecimal
 */
export async function generateKey() {
  await sodium.ready;
  const key = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_ietf_KEYBYTES);
  return sodium.to_hex(key);
}

/**
 * Prueba básica: encripta y desencripta datos de prueba
 */
export async function testCrypto() {
  try {
    console.log("🧪 Probando encriptación/desencriptación...");
    const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const { encrypted, key } = await encryptFile(testData, "test.bin", testData.length);
    const { data: decrypted } = await decryptFile(encrypted, key);

    const match = testData.length === decrypted.length &&
                  testData.every((val, idx) => val === decrypted[idx]);
    console.log("  - Datos coinciden:", match);
    return match;
  } catch (error) {
    console.error("❌ Error en testCrypto:", error);
    return false;
  }
}

/**
 * Prueba con datos personalizados
 */
export async function testCryptoWithData(keyHex, nonceHex, data) {
  try {
    console.log("🧪 Probando con datos personalizados...");
    const { encrypted, key } = await encryptFile(data, "test.bin", data.length);
    const { data: decrypted } = await decryptFile(encrypted, key);

    const match = data.length === decrypted.length &&
                  data.every((val, idx) => val === decrypted[idx]);
    console.log("  - Datos coinciden:", match);
    return match;
  } catch (error) {
    console.error("❌ Error en testCryptoWithData:", error);
    return false;
  }
}

/**
 * Valida que una clave sea válida
 */
export function validateCredentials(keyHex) {
  const errors = [];
  let isValid = true;

  if (!keyHex || typeof keyHex !== 'string') {
    errors.push("La clave es requerida y debe ser un string");
    isValid = false;
  }
  if (!isValid) return { isValid: false, errors };

  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    errors.push("La clave contiene caracteres no hexadecimales");
    isValid = false;
  }
  if (!isValid) return { isValid: false, errors };

  const expectedKeyLength = 64;
  if (keyHex.length !== expectedKeyLength) {
    errors.push(
      `Longitud de clave incorrecta. Esperada: ${expectedKeyLength} caracteres (32 bytes), Recibida: ${keyHex.length} caracteres`
    );
    isValid = false;
  }

  return { isValid, errors };
}