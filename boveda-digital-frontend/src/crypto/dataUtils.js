/**
 * Utilidades para conversión de datos en el módulo criptográfico
 */

/**
 * Convierte un Blob a Uint8Array
 * @param {Blob} blob - Blob a convertir
 * @returns {Promise<Uint8Array>} Buffer del blob
 */
export async function blobToUint8Array(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Convierte Uint8Array a Blob
 * @param {Uint8Array} data - Datos a convertir
 * @param {string} mimeType - Tipo MIME del blob (default: 'application/octet-stream')
 * @returns {Blob} Blob creado
 */
export function uint8ArrayToBlob(data, mimeType = "application/octet-stream") {
  return new Blob([data], { type: mimeType });
}

/**
 * Descarga un blob en el navegador
 * @param {Blob} blob - Blob a descargar
 * @param {string} fileName - Nombre del archivo
 */
export function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Convierte un File a Uint8Array
 * @param {File} file - Archivo a convertir
 * @returns {Promise<Uint8Array>} Buffer del archivo
 */
export async function fileToUint8Array(file) {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
