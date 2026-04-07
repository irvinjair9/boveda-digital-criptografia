# Bóveda Digital — Presentation Info

---

## B. Architecture (2–3 min)

### Components

| Componente | Descripción | Tecnología |
|---|---|---|
| **Vault (Bóveda)** | Almacén de archivos cifrados en el servidor. El backend guarda blobs cifrados que **no puede leer ni descifrar**. | Node/Express API + BD |
| **Keystore** | Gestión de claves asimétricas X25519 (Curve25519). La clave pública se almacena en el servidor; la privada se cifra localmente con XSalsa20-Poly1305 y la descarga el usuario como archivo `.encrypted`. | libsodium (`crypto_box_keypair`) |
| **Container (formato de archivo)** | Formato binario propio: `[4B longitud header][metadata JSON como AAD][12B nonce][ciphertext + 16B Poly1305 tag]`. La metadata (nombre, tamaño, versión) se autentica pero **no se cifra**, lo que impide manipulación sin que falle la verificación del tag. | ChaCha20-Poly1305 IETF (AEAD) |

**Parámetros criptográficos clave:**

| Parámetro | Valor |
|---|---|
| Clave simétrica | 256 bits (generada con CSPRNG) |
| Nonce | 96 bits (aleatorio por archivo) |
| Tag de autenticación | 128 bits (Poly1305) |
| Claves asimétricas | X25519 — 32 bytes pub / 32 bytes priv |
| Hash de contraseña | BLAKE2b — 256 bits |
| Cifrado de clave privada | XSalsa20-Poly1305 (nonce determinista derivado de contraseña) |

### Data Flow: Encryption → Sharing → Decryption

```
 CIFRADO (Emisor)                    COMPARTIR                         DESCIFRADO (Receptor)
 ─────────────────                   ──────────                        ─────────────────────
 1. Seleccionar archivo              4. Obtener public key             8. Login + cargar clave
 2. encryptFile()                       del receptor (/api/users)         privada cifrada
    → Gen key 32B random             5. crypto_box_seal(               9. Descifrar clave privada
    → Gen nonce 12B random              symmetricKey,                     con password (XSalsa20)
    → Cifrar con ChaCha20-Poly1305      recipientPubKey)              10. crypto_box_seal_open(
    → Metadata como AAD              6. Enviar al servidor:                wrappedKey,
 3. Resultado: archivo .encrypted       - archivo cifrado                  pubKey, privKey)
    + clave simétrica hex               - wrapped key por receptor     11. Recuperar clave simétrica
                                     7. Servidor almacena              12. decryptFile(blob, key)
                                        (NO puede descifrar)               → Verificar tag Poly1305
                                                                           → Descargar archivo original
```

**Endpoints involucrados:**

- `POST /api/files/share` — sube archivo cifrado + wrapped keys por receptor
- `GET /api/files/shared/{userId}` — lista archivos compartidos con el usuario
- `GET /api/files/shared/download/{fileId}` — descarga blob cifrado
- `GET /api/users` — obtiene claves públicas de receptores

### Trust Boundaries

```
┌──────────────────────────────────────────────┐
│  ZONA DE CONFIANZA: CLIENTE (Browser)        │
│  ✅ Genera claves simétricas y nonces        │
│  ✅ Cifra/descifra archivos localmente       │
│  ✅ Gestiona clave privada (nunca sale       │
│     en texto plano del navegador)            │
│  ✅ Envuelve claves con crypto_box_seal      │
└──────────────┬───────────────────────────────┘
               │ ← FRONTERA DE CONFIANZA (TLS requerido)
               │   Solo pasan: blobs cifrados, claves
               │   envueltas, hash de contraseña, pubkeys
┌──────────────▼───────────────────────────────┐
│  ZONA NO CONFIABLE: SERVIDOR                 │
│  ❌ NO puede leer contenido de archivos      │
│  ❌ NO puede derivar claves simétricas       │
│  ❌ NO puede descifrar claves privadas       │
│  ❌ NO puede modificar archivos sin romper   │
│     el tag Poly1305 (integrity check)        │
│  ✅ Solo almacena: blobs, pubkeys,           │
│     wrapped keys, hashes                     │
└──────────────────────────────────────────────┘
```

El servidor actúa como **proveedor de almacenamiento zero-knowledge**: no tiene acceso a datos en claro en ningún momento.

---

## C. Threat Model Summary (2–3 min)

### Who is the attacker?

El sistema considera los siguientes perfiles de atacante:

| Atacante | Capacidad | ¿Protegido? | Mecanismo de defensa |
|---|---|---|---|
| **Servidor comprometido / Admin malicioso** | Accede a BD completa: blobs cifrados, wrapped keys, hashes de contraseña, claves públicas | ✅ Sí | Cifrado E2E: los archivos están cifrados con ChaCha20-Poly1305 y las claves simétricas solo se desenvuelven con la clave privada del receptor, que nunca está en el servidor |
| **Atacante de red (Man-in-the-Middle)** | Intercepta tráfico entre cliente y servidor | ⚠️ Parcial | Requiere TLS/HTTPS en producción. Sin TLS, los blobs cifrados y hashes viajan expuestos. El contenido de archivos permanece protegido por el cifrado E2E |
| **Atacante con acceso a la base de datos** | Obtiene `encrypted_symmetric_key` (wrapped key) de la BD | ✅ Sí | La wrapped key solo se desenvuelve con la clave privada X25519 del receptor, que nunca se almacena en el servidor |
| **Atacante que modifica archivos almacenados** | Altera bytes del blob cifrado o de la metadata | ✅ Sí | Poly1305 tag + AAD: cualquier modificación de un solo bit hace fallar la verificación antes de retornar datos |
| **Fuerza bruta sobre contraseña** | Intenta adivinar la contraseña del usuario | ⚠️ Parcial | Se usa BLAKE2b sin sal ni iteraciones (no Argon2). Mitigación recomendada: rate limiting en backend + migrar a Argon2id |
| **Malware / keylogger en máquina del usuario** | Captura contraseña o clave privada en memoria del navegador | ❌ No | Fuera del alcance del modelo criptográfico; requiere medidas de seguridad del endpoint (antivirus, OS hardening) |
| **Computación cuántica (futuro)** | Rompe X25519 (ECDH) mediante algoritmo de Shor | ❌ No (actualmente) | Considerar migración futura a algoritmos post-cuánticos (CRYSTALS-Kyber, ML-KEM) |

**Modelo principal asumido:** El sistema se diseña contra un **servidor honesto pero curioso** (*honest-but-curious*) — el servidor cumple el protocolo correctamente pero intenta leer toda la información a la que tiene acceso. El cifrado extremo a extremo garantiza que incluso con acceso total a la base de datos, el atacante no obtiene datos en claro.

### What are you protecting?

| Activo protegido | Descripción | Mecanismo criptográfico |
|---|---|---|
| **Confidencialidad del archivo** | El contenido del archivo nunca es visible fuera del navegador del usuario autorizado | ChaCha20-Poly1305 IETF (AEAD) con clave simétrica de 256 bits generada por CSPRNG |
| **Integridad del archivo** | No se puede modificar ni un solo byte sin que se detecte | Tag Poly1305 de 128 bits verifica el ciphertext completo |
| **Integridad de la metadata** | El nombre, tamaño y versión del archivo no pueden ser alterados | Metadata usada como AAD (Additional Authenticated Data); el tag cubre metadata + contenido |
| **Clave simétrica en tránsito** | La clave de cifrado del archivo se transmite protegida entre usuarios | `crypto_box_seal` (X25519 + XSalsa20-Poly1305): solo el receptor puede desenvuelver |
| **Clave privada del usuario** | La clave privada X25519 nunca existe en texto plano fuera del navegador | Cifrada con XSalsa20-Poly1305 usando clave derivada de la contraseña (BLAKE2b). Se exporta como archivo `.encrypted` |
| **Contraseña del usuario** | La contraseña en texto plano nunca viaja al servidor | Se envía el hash BLAKE2b de 256 bits; el servidor solo compara hashes |

**Ataque prevenido — ejemplo concreto:**
Un atacante que renombra un archivo `.txt` a `.exe` en la base de datos para engañar al receptor **no puede hacerlo** porque el nombre original está autenticado como AAD. Al intentar descifrar, el tag Poly1305 falla y la operación se rechaza antes de retornar cualquier dato.

### What assumptions are you making?

| # | Suposición | Justificación | Riesgo si se rompe |
|---|---|---|---|
| 1 | **El navegador del usuario no está comprometido** | La criptografía ocurre en JavaScript dentro del browser. Si el entorno de ejecución está comprometido (malware, extensión maliciosa), las claves pueden ser capturadas en memoria. | Pérdida total de confidencialidad |
| 2 | **libsodium (libsodium-wrappers 0.8.2) es correcta y segura** | Se usa una biblioteca criptográfica auditada y ampliamente adoptada, compilada a WebAssembly. No se implementa criptografía propia ("don't roll your own crypto"). | Vulnerabilidad en primitivas criptográficas |
| 3 | **Los números aleatorios del sistema son criptográficamente seguros** | `sodium.randombytes_buf()` usa el CSPRNG del sistema operativo (Web Crypto API → OS entropy pool). | Nonces predecibles → posible reutilización de (key, nonce) → pérdida de confidencialidad |
| 4 | **El canal de transporte usa TLS/HTTPS** | Los datos cifrados y los hashes viajan por la red. Sin TLS, un atacante MitM puede capturar hashes de contraseña o sustituir claves públicas. | Suplantación de identidad, captura de hash para brute-force offline |
| 5 | **El usuario protege su contraseña y archivo de clave privada** | La contraseña deriva la clave para descifrar la clave privada. Si ambos se comprometen, el atacante puede descifrar todos los archivos compartidos con ese usuario. | Pérdida de confidencialidad para todos los archivos del usuario |
| 6 | **El servidor no sustituye claves públicas** | Al solicitar la clave pública de un receptor (`GET /api/users`), confiamos en que el servidor entrega la clave correcta. Un servidor malicioso podría sustituirla por su propia clave. | Ataque de suplantación de clave pública (requiere verificación out-of-band para mitigar) |
| 7 | **BLAKE2b es suficiente para el hash de contraseña** | BLAKE2b es rápido por diseño (no resistente a brute-force como Argon2). Se asume que las contraseñas son suficientemente fuertes o que hay rate-limiting en el servidor. | Brute-force offline si se filtra el hash |
| 8 | **No se requiere forward secrecy** | Si una clave privada X25519 se compromete, todos los archivos pasados compartidos con esa clave pueden descifrarse. No se usan claves efímeras por archivo. | Compromiso de historial completo de archivos compartidos |
| 9 | **La colisión de nonce es negligible** | Con nonces aleatorios de 96 bits, la probabilidad de colisión es < 2⁻³² tras 2³² cifrados con la misma clave. En la práctica web, el volumen de archivos está muy por debajo de ese umbral. | Reutilización de (key, nonce) rompe confidencialidad (XOR de plaintexts) |
