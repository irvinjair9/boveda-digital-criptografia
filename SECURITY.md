# Documentación de Seguridad — Bóveda Digital

## Tabla de Contenidos

1. [Resumen del Modelo de Amenazas](#1-resumen-del-modelo-de-amenazas)
2. [Decisiones de Diseño Criptográfico](#2-decisiones-de-diseño-criptográfico)
3. [Estrategia de Canonicalización](#3-estrategia-de-canonicalización)
4. [Estrategia de Gestión de Claves](#4-estrategia-de-gestión-de-claves)
5. [Hallazgos de Auditoría de Seguridad](#5-hallazgos-de-auditoría-de-seguridad)

---

## 1. Resumen del Modelo de Amenazas

### Descripción del Sistema

Bóveda Digital es una aplicación web donde todas las operaciones criptográficas se ejecutan en el navegador usando libsodium. El servidor almacena únicamente texto cifrado, shares de claves cifradas, firmas Ed25519 y claves públicas. El servidor nunca tiene acceso al contenido en texto plano ni a las claves simétricas sin cifrar.

### Activos a Proteger

| Activo | Sensibilidad | Dónde vive |
|--------|-------------|------------|
| Contenido del archivo en plano | Alta | Memoria del navegador solo durante cifrado/descifrado |
| Clave simétrica del archivo (K) | Alta | Memoria del navegador durante las operaciones |
| Clave privada X25519 | Alta | Archivo `.keys` (cifrado en reposo) |
| Clave privada Ed25519 | Alta | Archivo `.keys` (cifrado en reposo) |
| Contraseña de inicio de sesión | Alta | Se envía como hash BLAKE2b al servidor |
| Texto cifrado del archivo | Baja (sin clave) | Servidor backend |
| Shares de claves encapsuladas | Baja (sin clave privada) | Servidor backend |
| Claves públicas | Pública | Servidor backend |
| Firmas Ed25519 | Pública | Servidor backend |

### Actores de Amenaza

**En alcance:**

| Actor | Capacidad | Amenaza |
|-------|-----------|---------|
| Atacante de red pasivo | Intercepta tráfico | Leer texto cifrado en tránsito |
| Atacante de red activo | Modifica tráfico de red | Alterar texto cifrado o metadatos |
| Servidor malicioso | Control total de los datos almacenados | Servir claves públicas falsas, retener archivos |
| Usuario no autorizado | Tiene cuenta pero no fue destinatario | Acceder a archivos cifrados de otro usuario |
| Atacante de integridad | Modifica texto cifrado o lista de shares almacenados | Falsificar lista de destinatarios o corromper archivo |

**Fuera de alcance:**

| Actor | Por qué excluido |
|-------|-----------------|
| Endpoint comprometido (malware, keylogger) | Requiere confianza en el SO; fuera del alcance criptográfico |
| Computadora cuántica | No se usan primitivas post-cuánticas en esta versión |
| Atacante de canal lateral a nivel hardware | Parcialmente mitigado por el código de tiempo constante de libsodium |
| Ingeniería social | Ataque no técnico; requiere educación del usuario |

### Propiedades de Seguridad

| Propiedad | Lograda | Mecanismo |
|-----------|---------|-----------|
| Confidencialidad de archivos | Sí | ChaCha20-Poly1305 con clave aleatoria por archivo |
| Integridad de archivos | Sí | Etiqueta de autenticación Poly1305 |
| Integridad de metadatos | Sí | Metadatos incluidos como AAD |
| Autenticidad del remitente | Sí | Firma Ed25519 sobre texto cifrado + shares |
| Vinculación con destinatario | Sí | Clave simétrica encapsulada por destinatario con X25519 |
| Confidencialidad de clave privada en reposo | Sí | Argon2id + XSalsa20-Poly1305 (formato BOV3) |
| Secreto hacia adelante | No | Ver Limitaciones Conocidas |
| Revocación de claves | No | Ver Limitaciones Conocidas |
| Seguridad post-cuántica | No | Ver Limitaciones Conocidas |

---

## 2. Decisiones de Diseño Criptográfico

### 2.1 Cifrado de Archivos: ChaCha20-Poly1305 IETF AEAD

**Algoritmo:** `crypto_aead_chacha20poly1305_ietf_encrypt` (libsodium)  
**Estándar:** RFC 8439 / IETF ChaCha20-Poly1305  
**Parámetros:**
- Clave: 256 bits (32 bytes), generada aleatoriamente por archivo
- Nonce: 96 bits (12 bytes), generado aleatoriamente por archivo
- Etiqueta de autenticación: 128 bits (16 bytes), Poly1305

**Por qué ChaCha20-Poly1305 sobre AES-GCM:**

| Criterio | AES-GCM | ChaCha20-Poly1305 |
|----------|---------|-------------------|
| Aceleración por hardware | AES-NI (solo Intel/AMD) | Rápido en software en todas las plataformas |
| Riesgo de canal lateral | Vulnerable sin AES-NI | ChaCha20 es de tiempo constante por diseño |
| Adopción IETF/TLS | Sí (TLS 1.3) | Sí (TLS 1.3, preferido en móvil) |
| Predeterminado en libsodium | No | Sí |

ChaCha20-Poly1305 fue seleccionado por sus garantías de tiempo constante en software, por ser el predeterminado de libsodium para cifrado autenticado, y por evitar los riesgos de canal lateral del AES en hardware sin AES-NI.

**Por qué AEAD sobre Cifrado-entonces-MAC:**

Las implementaciones separadas de Cifrado-entonces-MAC requieren un orden preciso para evitar vulnerabilidades de tipo MAC-entonces-Cifrado (que llevaron a ataques de Padding Oracle en TLS). AEAD fusiona el cifrado y la autenticación en una sola operación, haciendo imposible usar la primitiva incorrectamente en ese aspecto. Una verificación AEAD fallida rechaza el mensaje completo antes de retornar cualquier dato descifrado.

**Estrategia de Nonce:**

Cada llamada de cifrado de archivo genera un nonce aleatorio de 96 bits mediante `sodium.randombytes_buf(12)` (CSPRNG de libsodium). El nonce se almacena en el encabezado del texto cifrado y no es secreto.

Con un nonce aleatorio de 96 bits y clave de 32 bytes, la probabilidad de colisión de nonce entre dos archivos cifrados con la misma clave es despreciable (< 2^{-64} para hasta 2^{32} archivos). Además, se genera una clave aleatoria nueva por archivo, por lo que la reutilización de nonces entre diferentes pares clave-nonce es criptográficamente independiente.

**AAD (Datos Asociados Adicionales):**

Los metadatos del archivo (`fileName`, `fileSize`, `algorithm`, `createdAt`, `version`) se pasan como AAD a la primitiva AEAD. Esto significa que los metadatos son autenticados criptográficamente por la etiqueta Poly1305 pero no están cifrados. Cualquier modificación al nombre de archivo, tamaño o versión después del cifrado causará que el descifrado falle con un error de autenticación.

### 2.2 Intercambio de Claves: Sealed Box X25519

**Algoritmo:** `crypto_box_seal` / `crypto_box_seal_open` (libsodium)  
**Primitivas subyacentes:** X25519 ECDH + XSalsa20-Poly1305

Para la compartición multi-usuario, la clave simétrica del archivo `K` se encapsula individualmente para cada destinatario usando su clave pública X25519. `crypto_box_seal` realiza un ECDH efímero con la clave pública estática del destinatario, deriva un secreto compartido y cifra `K` bajo ese secreto. La identidad del remitente no está vinculada al sealed box (cifrado anónimo).

La autenticidad del destinatario no la provee la capa de encapsulamiento de clave. Sin embargo, la firma Ed25519 sobre todo el contenedor (texto cifrado + todas las claves encapsuladas) proporciona autenticación del remitente y vincula su identidad al conjunto específico de destinatarios.

**Compromiso de diseño:** Los sealed boxes no autentican quién envió la clave encapsulada. Un servidor malicioso podría sustituir la clave encapsulada para un destinatario. Esto está parcialmente mitigado por la firma del contenedor, que compromete al remitente con una lista específica de destinatarios.

### 2.3 Firmas Digitales: Ed25519

**Algoritmo:** `crypto_sign_ed25519_detached` (libsodium)  
**Tamaño de clave:** escalar de 256 bits (Ed25519 sobre Curve25519 con SHA-512)  
**Tamaño de firma:** 512 bits (64 bytes)

La firma se calcula sobre:

```
SHA-512( bytes_texto_cifrado || canonicalizar(shares_ordenados) )
```

Donde `shares_ordenados` es la lista de objetos `{user_id, encrypted_symmetric_key}` ordenados de forma ascendente por `user_id`. El paso de pre-hash con SHA-512 se usa para reducir el tamaño de la entrada antes de firmar.

**Política de verificación (fallo cerrado):** En `DecryptShared.jsx`, si un archivo tiene una firma asociada y falla la verificación, o si no puede obtenerse la clave pública del firmante, el sistema se niega a continuar con el descifrado. Los archivos sin campo de firma aún se aceptan por compatibilidad con archivos compartidos antes de que se introdujera la firma.

**Por qué Ed25519 sobre RSA o ECDSA:**

- Ed25519 tiene una API más simple y segura (sin modos de relleno, sin nonce aleatorio para firmar)
- Firmas deterministas (RFC 8032) eliminan vulnerabilidades dependientes de la aleatoriedad
- La implementación de libsodium es de tiempo constante
- Generación y verificación de firmas más rápidas que RSA-2048 o ECDSA-P256

### 2.4 Hash de Contraseña para Login: BLAKE2b

**Algoritmo:** `crypto_generichash` (BLAKE2b, libsodium)  
**Salida:** 256 bits (32 bytes), codificados en hexadecimal

La contraseña de inicio de sesión se hashea en el cliente con BLAKE2b y se envía al backend para comparación. El backend almacena y compara el hash.

**Limitación conocida:** BLAKE2b se usa sin salt y no está diseñado como KDF para contraseñas. Esto significa que el hash es determinista (misma contraseña → mismo hash para todos los usuarios) y no ofrece resistencia a tablas rainbow precomputadas ni a ataques con GPU. Esta es una limitación documentada; un sistema en producción debería usar Argon2id con salt por usuario en el servidor.

---

## 3. Estrategia de Canonicalización

### Propósito

Las operaciones criptográficas que involucran firmar o autenticar datos estructurados (objetos JSON) requieren una representación de bytes determinista. El `JSON.stringify()` estándar es no determinista: dos objetos lógicamente idénticos pueden serializarse en cadenas de bytes diferentes según el motor JavaScript.

Bóveda Digital usa el Esquema de Canonicalización JSON RFC 8785 (JCS) para producir una representación canónica utilizada en:
1. **AAD para cifrado AEAD** — los metadatos del archivo se canonizan antes de pasarse a ChaCha20-Poly1305 como datos asociados.
2. **Entrada de firma** — la lista de shares de destinatarios se canoniza antes de incluirse en la entrada de la firma Ed25519.

### Reglas (RFC 8785)

| Regla | Descripción |
|-------|-------------|
| Orden de claves | Claves de objetos ordenadas lexicográficamente (orden de code points Unicode) |
| Espacios en blanco | Forma compacta — sin espacios ni saltos de línea |
| Valores `undefined` | Excluidos de la salida |
| Valores `null` | Preservados como `null` JSON |
| Orden de arrays | Preservado (los arrays son ordenados por definición) |
| Cadenas | Codificadas en UTF-8, secuencias de escape JSON |
| Números | Solo números finitos IEEE 754; `NaN` e `Infinity` son rechazados |
| Fechas | Convertidas a cadena ISO 8601 UTC antes de serializar |

### Implementación

`src/crypto/canonicalize.js` exporta:

- `canonicalize(value)` → cadena JSON canónica UTF-8
- `canonicalizeToBytes(value)` → `Uint8Array` del JSON canónico
- `buildCanonicalSignatureInput({metadata, recipients, nonce, ciphertext, tag})` → `Uint8Array` usado como entrada de firma Ed25519

### Construcción de la Entrada de Firma

Para la firma del contenedor, los bytes de entrada son:

```
SHA-512(bytes_texto_cifrado || canonicalizar(destinatarios_ordenados))
```

Donde `destinatarios_ordenados` es el array de objetos de share ordenados de forma ascendente por `user_id`. El ordenamiento se aplica antes de la canonicalización para asegurar que la firma sea independiente del orden en que se agregaron los shares durante el flujo de compartición.

### Cobertura de Pruebas

`src/crypto/canonicalize.test.js` cubre:
- Orden de claves determinista con objetos desordenados
- Exclusión de campos `undefined`
- Preservación de valores `null`
- Preservación del orden de arrays
- Conversión de fechas a ISO
- Rechazo de `NaN` e `Infinity`
- Prueba de integración: la alteración del AAD causa fallo en el descifrado AEAD
- Prueba de integración: metadatos idénticos producen bytes AAD idénticos

---

## 4. Estrategia de Gestión de Claves

### Tipos de Claves

| Clave | Algoritmo | Propósito |
|-------|-----------|-----------|
| Clave simétrica de archivo | 256 bits aleatorios | Cifra un archivo (uso único) |
| Par de claves X25519 | Curve25519 (256 bits) | Encapsula/desencapsula claves simétricas para compartición |
| Par de claves Ed25519 | Edwards25519 (256 bits) | Firma y verifica contenedores de archivos |

### Generación de Claves

Los pares de claves se generan en el cliente usando libsodium:

```javascript
// X25519 (cifrado)
sodium.crypto_kx_keypair()

// Ed25519 (firma)
sodium.crypto_sign_keypair()
```

La generación ocurre en el navegador al momento del registro. Las claves públicas se suben inmediatamente al backend. Las claves privadas se cifran y se ofrecen como descarga en un archivo `.keys`.

Ningún material de clave se envía al servidor en texto plano.

### Formato de Almacenamiento de Clave Privada (BOV3)

El formato actual es **BOV3**, introducido después de los formatos legacy basados en BLAKE2b:

```
[4 bytes]   Encabezado mágico: "BOV3" (0x42 0x4F 0x56 0x33)
[16 bytes]  Salt Argon2id (aleatorio, por cifrado)
[24 bytes]  Nonce XSalsa20-Poly1305 (aleatorio, por cifrado)
[N bytes]   Texto cifrado XSalsa20-Poly1305 de:
              { "x25519": "<hex>", "ed25519": "<hex>" }
[16 bytes]  Etiqueta de autenticación Poly1305 (añadida al texto cifrado por secretbox)
```

**KDF:** Argon2id con `OPSLIMIT_INTERACTIVE` y `MEMLIMIT_INTERACTIVE` de libsodium (~1 operación, ~64 MiB de RAM). Esto proporciona ~1 segundo de tiempo de KDF en hardware de consumo, haciendo costosos los ataques de fuerza bruta offline.

**Formatos legacy:**

| Formato | KDF | Notas |
|---------|-----|-------|
| BOV3 (actual) | Argon2id + salt aleatorio | Recomendado |
| BOV2 (legacy) | BLAKE2b (sin salt) | Transicional; aún se carga para claves existentes |
| Legacy (más antiguo) | BLAKE2b (sin salt) | Solo X25519, sin clave Ed25519 |

Compatibilidad hacia atrás: `decryptPrivateKey()` detecta el formato verificando el encabezado mágico y retrocede al análisis legacy si es necesario.

### Distribución de Claves Públicas

Las claves públicas (X25519 y Ed25519) se almacenan en el backend y se obtienen mediante `GET /api/users`. Los remitentes obtienen las claves públicas X25519 de los destinatarios para encapsular la clave simétrica. Los verificadores obtienen las claves públicas Ed25519 de los firmantes para verificar firmas.

**Limitación de confianza:** El sistema no implementa una PKI. Los usuarios deben verificar que la clave pública retornada por el servidor pertenece a la persona correcta a través de un canal fuera de banda. Un servidor comprometido puede sustituir claves públicas.

### Ciclo de Vida de la Clave Simétrica

1. Se genera una clave aleatoria de 256 bits nueva para cada cifrado de archivo.
2. La clave se usa una sola vez (para una llamada de cifrado de un archivo).
3. Después del cifrado, la clave se encapsula con la clave pública X25519 de cada destinatario y se sube junto con el archivo.
4. La clave en texto plano existe solo en memoria del navegador durante la operación de cifrado y no se almacena en ningún lugar.
5. Para descifrar, el destinatario desencapsula su copia de la clave usando su clave privada X25519, la usa para descifrar el archivo y luego la descarta.

### Recomendaciones de Almacenamiento de Claves

- El archivo `.keys` debe guardarse offline (USB o respaldo cifrado).
- La contraseña que protege el archivo `.keys` debe ser fuerte (12+ caracteres aleatorios).
- No almacenar el archivo `.keys` y su contraseña en el mismo lugar.

---

## 5. Hallazgos de Auditoría de Seguridad

Los siguientes hallazgos fueron identificados durante una revisión de seguridad manual del código fuente.

### Hallazgo 1 — Hash de Contraseña BLAKE2b Sin Salt (Severidad: Media)

**Ubicación:** `src/crypto/passwordHash.js`  
**Descripción:** La contraseña de inicio de sesión se hashea con BLAKE2b sin salt por usuario antes de enviarse al backend. Esto hace que el hash sea determinista y vulnerable a ataques de diccionario precomputados (tablas rainbow) si la base de datos del backend es comprometida.  
**Impacto:** Un atacante con acceso a la base de datos del backend podría usar una tabla precomputada de valores BLAKE2b(contraseña) para recuperar contraseñas de usuarios.  
**Recomendación:** Usar Argon2id o bcrypt con salt aleatorio por usuario en el backend, y transmitir la contraseña por TLS sin pre-hash en el cliente, o introducir un salt generado por el servidor entregado durante el registro.

### Hallazgo 2 — Sin Requisito de Firma para Archivos Legacy (Severidad: Baja)

**Ubicación:** `src/components/DecryptShared.jsx`  
**Descripción:** Los archivos compartidos antes de que se introdujera la función de firma Ed25519 no tienen campo de firma. La implementación actual acepta y descifra estos archivos sin firma. Un atacante con acceso de escritura al backend podría inyectar un archivo sin firmar y que el destinatario lo descifre sin activar un error de firma.  
**Impacto:** La autenticidad no se aplica a todo el historial de archivos. La ventana de riesgo se limita a archivos compartidos antes del despliegue de la firma.  
**Recomendación:** Exigir la presencia de firma para todas las subidas nuevas a nivel de API. Considerar agregar una advertencia en la UI al descifrar un archivo sin firma.

### Hallazgo 3 — Datos de Sesión en sessionStorage (Severidad: Baja)

**Ubicación:** `src/App.jsx`  
**Descripción:** Los datos de sesión de autenticación (ID de usuario, nombre de usuario, claves públicas) se almacenan en `sessionStorage`. `sessionStorage` es accesible para cualquier JavaScript que se ejecute en el mismo origen, incluyendo scripts inyectados en un ataque XSS exitoso.  
**Impacto:** Una vulnerabilidad XSS en la aplicación podría exfiltrar datos de sesión, permitiendo a un atacante suplantar al usuario durante la duración de la sesión.  
**Recomendación:** Validar y sanear todas las entradas renderizadas al DOM. Evitar almacenar datos de sesión sensibles en `sessionStorage` más allá de lo necesario para la UI.

### Hallazgo 4 — Sin Autenticación del Destinatario en Sealed Box (Severidad: Informativa)

**Ubicación:** `src/components/EncryptShare.jsx` — uso de `crypto_box_seal`  
**Descripción:** `crypto_box_seal` (cifrado anónimo) no vincula la identidad del remitente a la clave encapsulada. La firma cubre la lista de shares y el texto cifrado, pero no prueba quién envió la clave encapsulada a nivel del encapsulamiento de clave.  
**Impacto:** La firma provee autenticación del remitente a nivel del contenedor, pero el encapsulamiento de clave por sí solo no prueba la identidad del remitente. Este es el comportamiento esperado de los sealed boxes y está documentado.  
**Recomendación:** Aceptar como restricción de diseño conocida. Documentar claramente que la autenticidad del remitente la provee la firma Ed25519, no el encapsulamiento de clave.

### Hallazgo 5 — Clave Privada Descifrada como String JavaScript (Severidad: Informativa)

**Ubicación:** `src/crypto/keyPair.js` — `decryptPrivateKey()`  
**Descripción:** Después del descifrado, los bytes de clave privada se retornan como una cadena hex en un objeto JavaScript plano. Las cadenas JavaScript son inmutables y se recolectan como basura de forma no determinista, lo que significa que el material de clave privada puede permanecer en memoria por un tiempo indefinido después de su uso.  
**Impacto:** Un volcado de memoria del proceso del navegador durante o después del descifrado de claves podría exponer material de clave privada.  
**Recomendación:** Usar `Uint8Array` en toda la cadena y limpiar el material de clave con `sodium.memzero()` después de su uso. Esta es una mitigación de mejor esfuerzo, ya que JavaScript no garantiza la liberación inmediata de memoria.

### Tabla Resumen

| # | Hallazgo | Severidad | Estado |
|---|---------|----------|--------|
| 1 | Hash de contraseña BLAKE2b sin salt | Media | Abierto |
| 2 | Sin requisito de firma para archivos legacy | Baja | Abierto (compatibilidad hacia atrás) |
| 3 | Datos de sesión en sessionStorage | Baja | Abierto |
| 4 | Sin autenticación del destinatario en sealed box | Informativa | Aceptado (diseño conocido) |
| 5 | Clave privada en memoria JavaScript | Informativa | Abierto |

---

*Documento generado para Entrega Final — Bóveda Digital Segura*  
*Fecha: Mayo 2026*
