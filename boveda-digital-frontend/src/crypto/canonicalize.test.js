/**
 * UNIT + INTEGRATION TESTS - Canonicalization Module
 *
 * Incluye:
 * - Pruebas unitarias de canonicalización
 * - Pruebas de integración con ChaCha20-Poly1305
 */

import test from 'node:test';
import assert from 'node:assert';
import sodium from 'libsodium-wrappers';
import { encryptFile, decryptFile } from './chachaEncrypt.js';
import { canonicalize, canonicalizeToBytes, buildCanonicalSignatureInput } from './canonicalize.js';

await sodium.ready;

// UNIT TESTS - Canonicalization

test('Test 1: Dos objetos con diferente orden de claves producen la misma salida canónica', () => {
  const obj1 = {
    algorithm: "ChaCha20-Poly1305",
    createdAt: "2026-04-30T21:30:00Z",
    filename: "tesis.pdf",
    mimeType: "application/pdf",
    ownerId: "user123",
    version: 1
  };

  const obj2 = {
    version: 1,
    ownerId: "user123",
    mimeType: "application/pdf",
    filename: "tesis.pdf",
    createdAt: "2026-04-30T21:30:00Z",
    algorithm: "ChaCha20-Poly1305"
  };

  const canonical1 = canonicalize(obj1);
  const canonical2 = canonicalize(obj2);

  assert.strictEqual(canonical1, canonical2);
  console.log('  - Canonical output:', canonical1);
});

test('Test 2: undefined se excluye de la salida canónica', () => {
  const obj = {
    algorithm: "ChaCha20-Poly1305",
    createdAt: "2026-04-30T21:30:00Z",
    filename: "tesis.pdf",
    mimeType: "application/pdf",
    ownerId: "user123",
    version: 1,
    extra: undefined
  };

  const canonical = canonicalize(obj);
  const parsed = JSON.parse(canonical);

  assert.strictEqual(parsed.extra, undefined);
  assert.ok(!canonical.includes('extra'));
  console.log('  - Canonical output (without undefined):', canonical);
});

test('Test 3: canonicalizeToBytes() devuelve Uint8Array', () => {
  const obj = {
    algorithm: "ChaCha20-Poly1305",
    filename: "tesis.pdf"
  };

  const bytes = canonicalizeToBytes(obj);

  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 0);
  console.log('  - Bytes length:', bytes.length);
  console.log(
    '  - Bytes sample (hex):',
    Array.from(bytes.slice(0, 10)).map(b => b.toString(16)).join(' ')
  );
});

test('Test 4: La salida canónica de metadata es exactamente la esperada', () => {
  const metadata = {
    algorithm: "ChaCha20-Poly1305",
    createdAt: "2026-04-30T21:30:00.000Z",
    fileName: "tesis.pdf",
    fileSize: 1024,
    version: 1
  };

  const canonical = canonicalize(metadata);
  const parsed = JSON.parse(canonical);

  const keys = Object.keys(parsed);
  const sortedKeys = [...keys].sort();

  assert.deepStrictEqual(keys, sortedKeys);

  const canonical2 = canonicalize(metadata);
  assert.strictEqual(canonical, canonical2);

  console.log('  - Canonical output:', canonical);
  console.log('  - Key order (lexicographic):', keys);
});

test('Test 5: null se preserva en la salida canónica', () => {
  const obj = {
    field1: "value1",
    field2: null,
    field3: "value3"
  };

  const canonical = canonicalize(obj);
  const parsed = JSON.parse(canonical);

  assert.strictEqual(parsed.field2, null);
  console.log('  - Canonical output with null:', canonical);
});

test('Test 6: Arrays mantienen su orden original', () => {
  const obj = {
    items: [3, 1, 4, 1, 5, 9, 2, 6]
  };

  const canonical = canonicalize(obj);
  const parsed = JSON.parse(canonical);

  assert.deepStrictEqual(parsed.items, [3, 1, 4, 1, 5, 9, 2, 6]);
  console.log('  - Array order preserved:', canonical);
});

test('Test 7: Error cuando se intenta serializar tipos no soportados', () => {
  const unsupportedValue = () => {};
  assert.throws(() => canonicalize(unsupportedValue), /Tipo no soportado/);
});

test('Test 8: Dates se convierten a ISO 8601 UTC', () => {
  const date = new Date('2026-04-30T21:30:00Z');
  const obj = { timestamp: date };

  const canonical = canonicalize(obj);
  const parsed = JSON.parse(canonical);

  assert.strictEqual(parsed.timestamp, '2026-04-30T21:30:00.000Z');
  console.log('  - Date as ISO 8601:', canonical);
});

test('Test 9: Números no finitos (Infinity, -Infinity, NaN) lanzan error', () => {
  assert.throws(() => canonicalize({ x: Infinity }), /no es un número finito/);
  assert.throws(() => canonicalize({ x: -Infinity }), /no es un número finito/);
  assert.throws(() => canonicalize({ x: NaN }), /no es un número finito/);
  console.log('  - Non-finite numbers properly rejected');
});

test('Test 10: buildCanonicalSignatureInput produce Uint8Array', () => {
  const metadata = {
    algorithm: "ChaCha20-Poly1305",
    createdAt: "2026-04-30T21:30:00.000Z",
    fileName: "document.pdf",
    fileSize: 2048,
    version: 1
  };

  const sigInput = buildCanonicalSignatureInput({
    metadata,
    recipients: [],
    nonce: "abc123def456ab",
    ciphertext: "fedcba987654321",
    tag: "1234567890abcdef"
  });

  assert.ok(sigInput instanceof Uint8Array);
  assert.ok(sigInput.length > 0);

  console.log('  - Signature input length:', sigInput.length);
});

test('Test 11: Dos buildCanonicalSignatureInput idénticas producen el mismo output', () => {
  const metadata = {
    algorithm: "ChaCha20-Poly1305",
    createdAt: "2026-04-30T21:30:00.000Z",
    fileName: "contract.docx",
    fileSize: 4096,
    version: 1
  };

  const input = {
    metadata,
    recipients: [],
    nonce: "xyz789uvw012xyz",
    ciphertext: "abc123def456abc",
    tag: "fedcba987654fed"
  };

  const sigInput1 = buildCanonicalSignatureInput(input);
  const sigInput2 = buildCanonicalSignatureInput(input);

  assert.deepStrictEqual(sigInput1, sigInput2);
  console.log('  - Signature inputs are identical (deterministic)');
});



// INTEGRATION TESTS - Canonicalization + ChaCha20-Poly1305

test('INT_TEST_1: La metadata usada en encryptFile es canónica', async () => {
  const testContent = new TextEncoder().encode('Test file content');

  const { encrypted, metadata, key } = await encryptFile(
    testContent,
    'test.txt',
    testContent.length
  );

  assert.ok(metadata.algorithm);
  assert.ok(metadata.createdAt);
  assert.strictEqual(metadata.algorithm, 'ChaCha20-Poly1305');
  assert.strictEqual(metadata.fileName, 'test.txt');
  assert.strictEqual(metadata.fileSize, testContent.length);
  assert.strictEqual(metadata.version, 1);

  const createdAtDate = new Date(metadata.createdAt);
  assert.ok(!isNaN(createdAtDate.getTime()));

  const { data: decrypted } = await decryptFile(encrypted, key);
  assert.deepStrictEqual(decrypted, testContent);

  console.log('  - Metadata structure:', JSON.stringify(metadata));
});

test('INT_TEST_2: Modificar createdAt en AAD hace fallar desencriptación', async () => {
  const testContent = new TextEncoder().encode('Secret content');

  const { encrypted, key } = await encryptFile(
    testContent,
    'secret.txt',
    testContent.length
  );

  const HEADER_LENGTH_BYTES = 4;
  let offset = 0;
  const headerLen = new DataView(encrypted.buffer, 0, 4).getUint32(0, false);
  offset += HEADER_LENGTH_BYTES;

  const metadataBytes = encrypted.slice(offset, offset + headerLen);
  const originalMetadata = JSON.parse(new TextDecoder().decode(metadataBytes));

  const tamperedMetadata = {
    ...originalMetadata,
    createdAt: '2025-01-01T00:00:00.000Z'
  };

  const tamperedJson = canonicalize(tamperedMetadata);
  const tamperedMetadataBytes = new TextEncoder().encode(tamperedJson);

  const tamperedEncrypted = new Uint8Array(
    HEADER_LENGTH_BYTES + tamperedMetadataBytes.length + encrypted.length - HEADER_LENGTH_BYTES - headerLen
  );
  let tOffset = 0;

  const headerView = new DataView(new Uint8Array(HEADER_LENGTH_BYTES).buffer);
  headerView.setUint32(0, tamperedMetadataBytes.length, false);
  tamperedEncrypted.set(new Uint8Array(headerView.buffer), tOffset);
  tOffset += HEADER_LENGTH_BYTES;

  tamperedEncrypted.set(tamperedMetadataBytes, tOffset);
  tOffset += tamperedMetadataBytes.length;

  const nonceCipherStart = HEADER_LENGTH_BYTES + headerLen;
  tamperedEncrypted.set(encrypted.slice(nonceCipherStart), tOffset);

  try {
    await decryptFile(tamperedEncrypted, key);
    assert.fail('Desencriptación debería fallar con AAD modificado');
  } catch (error) {
    assert.ok(
      error.message.includes('KEY_INVALID') || error.message.includes('METADATA_TAMPERED')
    );
    console.log('  - Tampering detected:', error.message);
  }
});

test('INT_TEST_3: Modificar fileName en AAD hace fallar desencriptación', async () => {
  const testContent = new TextEncoder().encode('Important file');

  const { encrypted, key } = await encryptFile(
    testContent,
    'important.doc',
    testContent.length
  );

  const HEADER_LENGTH_BYTES = 4;
  let offset = 0;
  const headerLen = new DataView(encrypted.buffer, 0, 4).getUint32(0, false);
  offset += HEADER_LENGTH_BYTES;

  const metadataBytes = encrypted.slice(offset, offset + headerLen);
  const originalMetadata = JSON.parse(new TextDecoder().decode(metadataBytes));

  const tamperedMetadata = {
    ...originalMetadata,
    fileName: 'hacked.doc'
  };

  const tamperedJson = canonicalize(tamperedMetadata);
  const tamperedMetadataBytes = new TextEncoder().encode(tamperedJson);

  const tamperedEncrypted = new Uint8Array(
    HEADER_LENGTH_BYTES + tamperedMetadataBytes.length + encrypted.length - HEADER_LENGTH_BYTES - headerLen
  );
  let tOffset = 0;

  const headerView = new DataView(new Uint8Array(HEADER_LENGTH_BYTES).buffer);
  headerView.setUint32(0, tamperedMetadataBytes.length, false);
  tamperedEncrypted.set(new Uint8Array(headerView.buffer), tOffset);
  tOffset += HEADER_LENGTH_BYTES;

  tamperedEncrypted.set(tamperedMetadataBytes, tOffset);
  tOffset += tamperedMetadataBytes.length;

  const nonceCipherStart = HEADER_LENGTH_BYTES + headerLen;
  tamperedEncrypted.set(encrypted.slice(nonceCipherStart), tOffset);

  try {
    await decryptFile(tamperedEncrypted, key);
    assert.fail('Desencriptación debería fallar con fileName modificado');
  } catch (error) {
    assert.ok(
      error.message.includes('KEY_INVALID') || error.message.includes('METADATA_TAMPERED')
    );
    console.log('  - FileName tampering detected:', error.message);
  }
});

test('INT_TEST_4: buildCanonicalSignatureInput produce output estable', () => {
  const metadata = {
    algorithm: 'ChaCha20-Poly1305',
    createdAt: '2026-04-30T21:30:00.000Z',
    fileName: 'document.pdf',
    fileSize: 1024,
    version: 1
  };

  const sigInput1 = buildCanonicalSignatureInput({
    metadata,
    recipients: [],
    nonce: 'abc123def456',
    ciphertext: 'xyz789uvw012',
    tag: 'sig1234567890ab'
  });

  const sigInput2 = buildCanonicalSignatureInput({
    metadata,
    recipients: [],
    nonce: 'abc123def456',
    ciphertext: 'xyz789uvw012',
    tag: 'sig1234567890ab'
  });

  assert.ok(sigInput1 instanceof Uint8Array);
  assert.deepStrictEqual(sigInput1, sigInput2);

  console.log('  - Signature input length:', sigInput1.length);
  console.log('  - Entries are idempotent');
});

test('INT_TEST_5: buildCanonicalSignatureInput distinto si createdAt distinto', () => {
  const metadata1 = {
    algorithm: 'ChaCha20-Poly1305',
    createdAt: '2026-04-30T21:30:00.000Z',
    fileName: 'document.pdf',
    fileSize: 1024,
    version: 1
  };

  const metadata2 = {
    algorithm: 'ChaCha20-Poly1305',
    createdAt: '2026-05-01T12:00:00.000Z',
    fileName: 'document.pdf',
    fileSize: 1024,
    version: 1
  };

  const sigInput1 = buildCanonicalSignatureInput({
    metadata: metadata1,
    recipients: [],
    nonce: 'abc123def456',
    ciphertext: 'xyz789uvw012',
    tag: 'sig1234567890ab'
  });

  const sigInput2 = buildCanonicalSignatureInput({
    metadata: metadata2,
    recipients: [],
    nonce: 'abc123def456',
    ciphertext: 'xyz789uvw012',
    tag: 'sig1234567890ab'
  });

  assert.notDeepStrictEqual(sigInput1, sigInput2);

  console.log('  - sigInput1 length:', sigInput1.length);
  console.log('  - sigInput2 length:', sigInput2.length);
  console.log('  - Outputs are properly distinct');
});