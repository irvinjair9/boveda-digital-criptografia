/**
 * CANONICALIZATION MODULE
 * 
 * Implementa canonicalización JSON según RFC 8785 con variantes para este proyecto.
 * 
 * Reglas de serialización canónica:
 * 1. Todos los objetos se serializan como JSON canónico
 * 2. Todas las claves de objetos se ordenan en orden lexicográfico ascendente (A-Z)
 * 3. Sin espacios extra ni saltos de línea innecesarios (compact form)
 * 4. Codificación final UTF-8
 * 5. Campos con valor `undefined` se excluyen de la salida
 * 6. Campos con valor `null` se conservan
 * 7. Arrays conservan su orden original (no se reordenan)
 * 8. Dates se convierten a strings ISO 8601 UTC (e.g., "2026-04-30T21:30:00.000Z")
 * 9. Números no finitos (NaN, Infinity, -Infinity) se rechazan
 * 10. Ya sea que se use en metadata, AAD o signature input, siempre se aplican mismas reglas
 * 
 * @module canonicalize
 */

/**
 * Canonicaliza un valor a su representación JSON canónica
 * 
 * @param {*} value - Valor a canonicalizar (object, array, primitivo, Date, etc)
 * @returns {string} String JSON canónico (compact, sin espacios extra)
 * @throws {Error} Si el tipo no es soportado (ej: función) o número no finito
 * 
 * @example
 * const obj1 = { c: 3, a: 1, b: 2 };
 * const obj2 = { a: 1, b: 2, c: 3 };
 * canonicalize(obj1) === canonicalize(obj2); // true → {"a":1,"b":2,"c":3}
 */
export function canonicalize(value) {
  return JSON.stringify(canonicalizeValue(value));
}

/**
 * Canonicaliza un valor y lo convierte a bytes UTF-8
 * 
 * @param {*} value - Valor a canonicalizar
 * @returns {Uint8Array} Bytes UTF-8 del JSON canónico
 * @throws {Error} De canonicalizeValue si tipo no soportado
 */
export function canonicalizeToBytes(value) {
  const canonicalJson = canonicalize(value);
  return new TextEncoder().encode(canonicalJson);
}

/**
 * Construye una entrada canónica para firma digital futura
 * 
 * Prepara una estructura estable que contiene:
 * - metadata canónica (que ya incluye algorithm, createdAt, fileName, fileSize, version)
 * - recipients (para futuro, puede ser array vacío)
 * - nonce en hex (representación consistente de datos binarios)
 * - ciphertext en hex
 * - tag en hex
 * 
 * Todos estos se canonicalizan juntos para producir bytes determinísticos.
 * Estos bytes serán el input para firma EDDSA eventual.
 * 
 * @param {Object} signatureInputData - Datos para construir signature input
 * @param {Object} signatureInputData.metadata - Metadata del archivo (debe incluir algorithm, createdAt, etc)
 * @param {Array} signatureInputData.recipients - Array de recipients (vacío por ahora)
 * @param {string} signatureInputData.nonce - Nonce en hexadecimal
 * @param {string} signatureInputData.ciphertext - Ciphertext en hexadecimal
 * @param {string} signatureInputData.tag - Tag Poly1305 en hexadecimal
 * @returns {Uint8Array} Bytes canónicos listos para firma digital
 * 
 * @example
 * const sigInput = buildCanonicalSignatureInput({
 *   metadata: { algorithm: "ChaCha20-Poly1305", createdAt: "2026-04-30T21:30:00.000Z", ... },
 *   recipients: [],
 *   nonce: "abc123...",
 *   ciphertext: "def456...",
 *   tag: "ghi789..."
 * });
 * // sigInput es Uint8Array con JSON canónico de toda la estructura
 */
export function buildCanonicalSignatureInput({ metadata, recipients, nonce, ciphertext, tag }) {
  const signatureInputStructure = {
    metadata,
    recipients: recipients || [],
    nonce,
    ciphertext,
    tag
  };
  return canonicalizeToBytes(signatureInputStructure);
}

/**
 * Procesa recursivamente un valor para canonicalización
 * 
 * @private
 * @param {*} value - Valor a procesar
 * @returns {*} Valor procesado según reglas canónicas
 * @throws {Error} Si tipo no soportado o número no finito
 */
function canonicalizeValue(value) {
  // null es especial en JSON: se preserva
  if (value === null) {
    return null;
  }

  const type = typeof value;

  // undefined NO aparece en JSON: se retorna para que sea excluido en objetos
  if (type === "undefined") {
    return undefined;
  }

  // Booleanos y strings: preservados como están
  if (type === "boolean" || type === "string") {
    return value;
  }

  // Números: validar que sean finitos
  if (type === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Tipo no soportado: ${value} no es un número finito (NaN, Infinity, -Infinity rechazados)`);
    }
    return value;
  }

  // Fechas: convertir a ISO 8601 UTC
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Arrays: procesar recursivamente preservando orden
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item));
  }

  // Objetos: procesar recursivamente con claves **ordenadas alfabéticamente**
  if (type === "object") {
    const keys = Object.keys(value).sort(); // ← SORTING LEXICOGRÁFICO
    const canonicalObj = {};

    for (const key of keys) {
      const val = value[key];
      const canonicalVal = canonicalizeValue(val);

      // Excluir undefined, pero preservar null
      if (canonicalVal !== undefined) {
        canonicalObj[key] = canonicalVal;
      }
    }

    return canonicalObj;
  }

  // Cualquier otro tipo (functions, symbols, etc) no es soportado
  throw new Error(`Tipo no soportado: ${type} no puede ser serializado canónicamente`);
}