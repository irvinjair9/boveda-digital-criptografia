import sodium from "libsodium-wrappers";

/**
 * Genera un hash determinístico de la contraseña usando BLAKE2b (libsodium).
 * El mismo password siempre produce el mismo hash, permitiendo que el backend
 * almacene el hash y lo compare en cada login sin conocer la contraseña en claro.
 *
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<string>} Hash en hexadecimal (64 caracteres)
 */
export async function hashPassword(password) {
  await sodium.ready;

  const hash = sodium.crypto_generichash(
    32, // 32 bytes → 256 bits de salida
    sodium.from_string(password)
  );

  return sodium.to_hex(hash);
}
