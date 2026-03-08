# Módulo de Criptografía - Boveda Digital

## Descripción General

Este módulo implementa **ChaCha20-Poly1305** para cifrado autenticado de archivos. ChaCha20-Poly1305 es un cifrado AEAD (Authenticated Encryption with Associated Data) que proporciona:

- **Confidencialidad**: ChaCha20 cifra los datos
- **Autenticación**: Poly1305 garantiza la integridad y autenticidad de los datos

## Funciones Disponibles

### `encryptFile(fileBuffer)`

Encripta un archivo usando ChaCha20-Poly1305.

**Parámetros:**
- `fileBuffer` (Uint8Array|Buffer): Buffer del archivo a encriptar

**Retorna:**
```javascript
{
  encrypted: Uint8Array,     // Archivo cifrado y autenticado
  key: string,               // Clave en formato hexadecimal
  nonce: string              // Nonce en formato hexadecimal
}
```

**Ejemplo:**
```javascript
import { encryptFile } from "../crypto/chachaEncrypt";

const { encrypted, key, nonce } = await encryptFile(fileBuffer);
// key y nonce deben almacenarse en el servidor para desencriptación posterior
```

### `decryptFile(encryptedBuffer, keyHex, nonceHex)`

Desencripta un archivo cifrado con ChaCha20-Poly1305.

**Parámetros:**
- `encryptedBuffer` (Uint8Array|Buffer): Buffer cifrado
- `keyHex` (string): Clave en formato hexadecimal
- `nonceHex` (string): Nonce en formato hexadecimal

**Retorna:**
```javascript
Uint8Array  // Archivo desencriptado
```

**Lanza:**
- Error si la autenticación falla (datos modificados o clave incorrecta)

**Ejemplo:**
```javascript
import { decryptFile } from "../crypto/chachaEncrypt";

try {
  const original = await decryptFile(encrypted, key, nonce);
} catch (error) {
  console.error("Archivo corrupto o clave incorrecta:", error);
}
```

### `generateKey()`

Genera una clave ChaCha20 aleatoria válida.

**Retorna:**
```javascript
string  // Clave en formato hexadecimal (64 caracteres = 32 bytes)
```

### `generateNonce()`

Genera un nonce ChaCha20 aleatoria válido.

**Retorna:**
```javascript
string  // Nonce en formato hexadecimal (24 caracteres = 12 bytes)
```

## Especificaciones de Seguridad

- **Algoritmo**: ChaCha20-Poly1305 IETF
- **Tamaño de clave**: 32 bytes (256 bits)
- **Tamaño de nonce**: 12 bytes (96 bits)
- **Tamaño de MAC**: 16 bytes (128 bits)
- **Librería**: libsodium-wrappers

## Flujo de Encriptación en la Aplicación

### Upload (Componente: UploadFile.jsx)

1. Usuario selecciona archivo
2. Archivo se lee como `Uint8Array`
3. Se encripta con `encryptFile()`
4. Se envía al servidor:
   - `encrypted`: Blob cifrado
   - `key`: Clave hexadecimal
   - `nonce`: Nonce hexadecimal
   - `receiverId`: ID del destinatario

### Download (Componente: FileInbox.jsx)

1. Se obtiene lista de archivos recibidos
2. Usuario hace click en "Descargar"
3. Se descarga el archivo cifrado del servidor
4. Se desencripta con `decryptFile()` usando la clave y nonce
5. Se inicia descarga del archivo original en el navegador

## Notas de Implementación

- **Nonce**: NUNCA reutilizar el mismo nonce con la misma clave. Se genera aleatoriamente para cada encriptación.
- **Clave**: Se almacena en el servidor asociada al archivo encriptado.
- **Formato hexadecimal**: Facilita almacenamiento en bases de datos y transmisión por HTTP.
- **Front-end vs Back-end**: El frente cifra antes de enviar, el backend solo almacena datos ya cifrados.

## Consideraciones de Seguridad

✅ **Implementado:**
- AEAD (Authenticated Encryption with Associated Data)
- Nonces aleatorios para cada encriptación
- Validación de autenticidad al desencriptar

⚠️ **Por implementar en producción:**
- HTTPS/TLS para transmisión de claves
- Derivación de claves si compartes clave con múltiples archivos
- Almacenamiento seguro de claves en el servidor
- Logs de auditoría de acceso a archivos
