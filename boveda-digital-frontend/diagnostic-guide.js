/**
 * GUÍA DE DIAGNÓSTICO PARA ERROR DE DESENCRIPTACIÓN
 * 
 * Ejecuta esto en la consola del navegador (F12) cuando intentes desencriptar un archivo
 * y revisa la salida para identificar el problema
 */

console.log("=== GUÍA DE DIAGNÓSTICO DE DESENCRIPTACIÓN ===\n");

console.log("📋 PASOS PARA DIAGNOSTICAR:\n");

console.log("1️⃣ REVISA LOS LOGS EN LA CONSOLA:");
console.log("   Abre DevTools (F12) → Console");
console.log("   Haz clic en 'Descargar' para un archivo");
console.log("   Busca los mensajes que comienzan con '🔍 Debug handleDownload:'");
console.log("   Anota estos valores:\n");

console.log("   a) KEY (raw):");
console.log("      - Si tiene 64 caracteres y solo tiene 0-9, a-f: ✅ PARECE OK");
console.log("      - Si tiene caracteres extraños: ❌ POSIBLE PROBLEMA\n");

console.log("   b) NONCE (raw):");
console.log("      - Si tiene 24 caracteres y solo tiene 0-9, a-f: ✅ PARECE OK");
console.log("      - Si tiene caracteres extraños: ❌ POSIBLE PROBLEMA\n");

console.log("   c) encryptedData type y length:");
console.log("      - Si es string: Revisará si es hex o base64");
console.log("      - Si es object/Uint8Array: Se usará directamente");
console.log("      - El tamaño debe ser > 16 bytes (para ChaCha20-Poly1305)\n");

console.log("2️⃣ REVISA LOS ERRORES:");
console.log("   Si ves: '⚠️ Key inválida'");
console.log("      → La clave no tiene 64 caracteres hexadecimales");
console.log("      → Probablemente se está guardando mal en el servidor\n");

console.log("   Si ves: '⚠️ Nonce inválido'");
console.log("      → El nonce no tiene 24 caracteres hexadecimales");
console.log("      → Probablemente se está truncando en el servidor\n");

console.log("   Si ves: '❌ Error al desencriptar: Error al desencriptar: ciphertext cannot...'");
console.log("      → La clave NO coincide con el texto cifrado");
console.log("      → Posibles causas:");
console.log("        • La clave fue cambiada o corrompida en el servidor");
console.log("        • El archivo fue modificado después de encriptarse");
console.log("        • Estás usando el nonce incorrecto\n");

console.log("3️⃣ VERIFICA EL SERVIDOR:");
console.log("   Necesitas enviar estos datos exactamente como se criptográficamente generaron:");
console.log("   - key: EXACTAMENTE 64 caracteres hexadecimales");
console.log("   - nonce: EXACTAMENTE 24 caracteres hexadecimales");
console.log("   - encryptedData: Los bytes exactos sin modificación\n");

console.log("4️⃣ PARA COMPARTIR EL PROBLEMA:");
console.log("   Copia y pega lo siguiente que veas en la consola:\n");
console.log("   - El valor completo de 'key (raw):'");
console.log("   - El valor completo de 'nonce (raw):'");
console.log("   - El valor de 'encryptedData type' y 'length'");
console.log("   - El mensaje de error completo\n");

console.log("=== FIN DE LA GUÍA ===\n");

// Instrucciones para copiar fácilmente
console.log("💾 Puedes hacer clic derecho en los mensajes de consola y 'Copy' para obtener los valores");
