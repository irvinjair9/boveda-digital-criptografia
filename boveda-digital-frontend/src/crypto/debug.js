// Script de debug para probar encriptación desde consola del navegador
// Ejecutar en la consola del navegador: import('./src/crypto/debug.js')

import { encryptFile, decryptFile, testCrypto } from './chachaEncrypt.js';

window.cryptoDebug = {
  // Probar funcionalidad básica
  async test() {
    console.log("🧪 Ejecutando prueba básica...");
    return await testCrypto();
  },

  // Encriptar datos específicos
  async encrypt(data) {
    console.log("🔐 Encriptando:", data);
    const result = await encryptFile(new Uint8Array(data));
    console.log("✅ Resultado:", result);
    return result;
  },

  // Desencriptar con credenciales específicas
  async decrypt(encrypted, key, nonce) {
    console.log("🔓 Desencriptando...");
    console.log("  - Encrypted length:", encrypted.length);
    console.log("  - Key:", key);
    console.log("  - Nonce:", nonce);

    const result = await decryptFile(new Uint8Array(encrypted), key, nonce);
    console.log("✅ Resultado:", result);
    return result;
  },

  // Probar round-trip (encriptar -> desencriptar)
  async roundTrip(data) {
    console.log("🔄 Probando round-trip con:", data);

    const { encrypted, key, nonce } = await encryptFile(new Uint8Array(data));
    console.log("  - Encriptado OK");

    const decrypted = await decryptFile(encrypted, key, nonce);
    console.log("  - Desencriptado OK");

    const match = data.length === decrypted.length &&
                  data.every((val, idx) => val === decrypted[idx]);

    console.log("  - Coinciden:", match);
    return { match, original: data, decrypted: Array.from(decrypted) };
  }
};

console.log("🔧 Crypto Debug Tools loaded!");
console.log("📋 Comandos disponibles:");
console.log("  - cryptoDebug.test() - Prueba básica");
console.log("  - cryptoDebug.encrypt([1,2,3]) - Encripta array");
console.log("  - cryptoDebug.decrypt(encrypted, key, nonce) - Desencripta");
console.log("  - cryptoDebug.roundTrip([1,2,3]) - Prueba completa");