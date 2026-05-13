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

---

## D. Cryptographic Design (3–4 min)

### D2 — Symmetric Encryption: AEAD, Nonce Strategy & Metadata

#### AEAD Choice: ChaCha20-Poly1305 IETF

**¿Por qué ChaCha20-Poly1305 y no AES-GCM?**

| Criterio | ChaCha20-Poly1305 | AES-GCM |
|---|---|---|
| **Rendimiento en software** | Rápido sin instrucciones AES-NI (ideal para navegadores / WebAssembly) | Requiere AES-NI para rendimiento competitivo |
| **Seguridad ante timing attacks** | Operaciones en tiempo constante por diseño | Vulnerable si la implementación no usa AES-NI |
| **Estándar** | RFC 8439, usado en TLS 1.3, WireGuard, Signal | RFC 5116, ampliamente adoptado |
| **Autenticación** | Integrada (AEAD): cifra + autentica en una sola operación | Integrada (AEAD) |
| **Tamaño de nonce** | 96 bits (12 bytes) | 96 bits (12 bytes) |

**Implementación en el proyecto** ([src/crypto/chachaEncrypt.js](src/crypto/chachaEncrypt.js)):

```javascript
// Cifrado AEAD — una sola llamada cubre confidencialidad + integridad
const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
  fileBuffer,        // plaintext (contenido del archivo)
  metadataBytes,     // AAD (Additional Authenticated Data)
  null,              // nsec (no usado en IETF variant)
  nonce,             // 12 bytes aleatorios
  key                // 32 bytes aleatorios (256 bits)
);
// Resultado: ciphertext || 16-byte Poly1305 tag (concatenados automáticamente)
```

**Ventaja clave de AEAD vs Encrypt-then-MAC manual:**
- En Encrypt-then-MAC, el desarrollador debe verificar el MAC **antes** de descifrar. Si se olvida o lo hace en orden incorrecto, se expone a ataques de padding oracle.
- Con AEAD, `crypto_aead_*_decrypt()` **rechaza automáticamente** datos alterados y **nunca retorna plaintext** si el tag no verifica. Es imposible olvidar la verificación.

#### Nonce Strategy

```
Estrategia: NONCE ALEATORIO (Random Nonce)

┌─────────────────────────────────────────────────┐
│ sodium.randombytes_buf(12)  →  96 bits random   │
│                                                   │
│ Se genera un nonce NUEVO por cada archivo        │
│ Se genera una KEY NUEVA por cada archivo         │
│ → El par (key, nonce) es único por construcción  │
└─────────────────────────────────────────────────┘
```

**¿Por qué nonce aleatorio y no un contador?**

| Aspecto | Nonce aleatorio (este proyecto) | Nonce contador |
|---|---|---|
| **Estado requerido** | Sin estado — no necesita persistir un contador | Requiere almacenar y sincronizar un contador |
| **Riesgo de colisión** | < 2⁻³² tras 2³² cifrados (birthday bound a 96 bits) | Cero si el contador no se reinicia |
| **Adecuado para web** | ✅ Ideal — no hay estado persistente entre sesiones del navegador | ❌ Problemático — el contador puede perderse al cerrar pestaña |
| **Con clave única por archivo** | ✅ Riesgo de colisión = 0 en la práctica (cada archivo tiene su propia clave) | Innecesario si la clave ya es única |

**Dato clave:** Como cada archivo genera su propia clave simétrica aleatoria de 256 bits, el nonce solo necesita ser único *dentro de los cifrados con esa misma clave*. Como solo se cifra **un archivo por clave**, la colisión de nonce es imposible en la práctica.

**Almacenamiento del nonce** — se embebe en el archivo cifrado:
```
[4B header len][metadata JSON][12B NONCE][ciphertext + 16B tag]
                                ^^^^^^^^
                                Almacenado en claro dentro del contenedor
                                (el nonce NO es secreto — solo debe ser único)
```

#### Metadata + AAD (Additional Authenticated Data)

**¿Qué es AAD?**
AAD son datos que se **autentican pero NO se cifran**. El tag Poly1305 cubre tanto el ciphertext como el AAD, garantizando que ambos son íntegros.

**Metadata incluida como AAD:**
```json
{
  "fileName": "documento-confidencial.pdf",
  "fileSize": 1048576,
  "version": 1
}
```

**Flujo de verificación:**
```
┌────────────────────────────────┐
│ CIFRADO                        │
│                                │
│ metadata (AAD) ──┐             │
│                  ├──→ Poly1305 TAG (128 bits)
│ archivo (enc) ───┘             │
└────────────────────────────────┘

┌────────────────────────────────┐
│ DESCIFRADO                     │
│                                │
│ metadata (AAD) ──┐             │
│                  ├──→ ¿TAG coincide?
│ ciphertext ──────┘             │
│                                │
│   ✅ SÍ → descifrar y retornar│
│   ❌ NO → RECHAZAR (error)    │
│          nunca retorna datos   │
└────────────────────────────────┘
```

**Ataque prevenido:**
Un atacante con acceso al servidor intenta renombrar `informe.pdf` → `malware.exe` en la metadata del blob almacenado. Al descifrar:
1. Se extrae la metadata modificada como AAD
2. Se recalcula el tag Poly1305 sobre (ciphertext + metadata modificada)
3. El tag **no coincide** con el tag original almacenado
4. `crypto_aead_*_decrypt()` retorna error — **cero bytes de plaintext expuestos**

**¿Por qué no cifrar la metadata?**
- Permite al sistema mostrar nombre y tamaño de archivo en la UI **sin descifrar** el contenido completo
- La autenticación vía AAD es suficiente: la metadata no puede alterarse sin detección
- El nombre del archivo no se considera secreto en este modelo (el contenido sí)

---

### D3 — Hybrid Encryption: Key Wrapping & Recipient Handling

#### Hybrid Encryption Workflow

El sistema usa **cifrado híbrido**: combina cifrado simétrico (rápido, para el archivo) con cifrado asimétrico (para distribuir la clave).

```
┌─────────────────────────────────────────────────────────────────────┐
│  PASO 1: Cifrado simétrico del archivo                              │
│                                                                      │
│  archivo.pdf ──→ ChaCha20-Poly1305(key, nonce) ──→ archivo.encrypted│
│                   ↑                                                  │
│            key = 32 bytes aleatorios (CSPRNG)                       │
│            nonce = 12 bytes aleatorios                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ key simétrica (32 bytes)
┌─────────────────────────────────────────────────────────────────────┐
│  PASO 2: Key wrapping asimétrico (por cada receptor)                │
│                                                                      │
│  Para receptor A:                                                    │
│    crypto_box_seal(key, pubKey_A) ──→ wrapped_key_A (48 bytes)      │
│                                                                      │
│  Para receptor B:                                                    │
│    crypto_box_seal(key, pubKey_B) ──→ wrapped_key_B (48 bytes)      │
│                                                                      │
│  Para receptor C:                                                    │
│    crypto_box_seal(key, pubKey_C) ──→ wrapped_key_C (48 bytes)      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PASO 3: Envío al servidor                                          │
│                                                                      │
│  POST /api/files/share                                               │
│  {                                                                   │
│    file: archivo.encrypted,                                          │
│    filename: "archivo.pdf",                                          │
│    owner_id: sender_id,                                              │
│    iv: nonce_hex,                                                    │
│    shares: [                                                         │
│      { user_id: A, encrypted_symmetric_key: wrapped_key_A_hex },    │
│      { user_id: B, encrypted_symmetric_key: wrapped_key_B_hex },    │
│      { user_id: C, encrypted_symmetric_key: wrapped_key_C_hex }     │
│    ]                                                                 │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**¿Por qué `crypto_box_seal` y no `crypto_box`?**

| Propiedad | `crypto_box_seal` (Sealed Box) | `crypto_box` (Authenticated Box) |
|---|---|---|
| **Autenticación del emisor** | ❌ Anónimo — el receptor no sabe quién cifró | ✅ Autenticado — verifica identidad del emisor |
| **Claves necesarias para cifrar** | Solo la pubkey del receptor | Pubkey receptor + privkey emisor |
| **Uso en Bóveda Digital** | ✅ Se usa este — el `owner_id` en la BD identifica al emisor | — |
| **Internamente** | Genera keypair efímero X25519, DH con pubkey receptor, cifra con XSalsa20-Poly1305 | DH directo entre emisor y receptor |

#### How Recipients Are Handled

**Flujo en [EncryptShare.jsx](src/components/EncryptShare.jsx):**

```
1. Usuario emisor selecciona archivo + receptores en la UI

2. GET /api/users → obtiene lista de usuarios con sus claves públicas
   Respuesta: [{ id, name, username, public_key }, ...]

3. El archivo se cifra UNA sola vez (una clave simétrica, un nonce)

4. Para CADA receptor seleccionado:
   a. Obtener su public_key (hex → Uint8Array)
   b. crypto_box_seal(symmetricKey, recipientPublicKey)
   c. Almacenar: { user_id, encrypted_symmetric_key: hex }

5. Enviar al servidor: 1 archivo cifrado + N wrapped keys
```

**Propiedad importante:** El archivo se cifra **una única vez** independientemente del número de receptores. Solo la clave simétrica (32 bytes) se envuelve múltiples veces — una por receptor. Esto es eficiente: envolver una clave de 32 bytes es instantáneo comparado con cifrar un archivo de varios MB.

**Descifrado por el receptor** ([DecryptShared.jsx](src/components/DecryptShared.jsx)):

```
1. Receptor carga su archivo de clave privada (.encrypted)
2. Ingresa su contraseña
3. decryptPrivateKey(encryptedPrivKey, password)
   → BLAKE2b(password) → clave derivada
   → XSalsa20-Poly1305 decrypt → clave privada X25519
4. Para el archivo compartido:
   a. GET /api/files/shared/download/{fileId} → blob cifrado
   b. Obtener wrapped_key del share correspondiente
   c. crypto_box_seal_open(wrapped_key, pubKey, privKey) → clave simétrica
   d. decryptFile(blob, symmetricKey) → archivo original
```

#### How Keys Are Identified

El sistema gestiona **tres tipos de claves** con ciclos de vida distintos:

```
┌─────────────────────────────────────────────────────────────────┐
│ CLAVE SIMÉTRICA (por archivo)                                    │
│ Vida: efímera — generada al cifrar, descartada tras compartir   │
│ Tamaño: 256 bits (32 bytes)                                     │
│ Generación: sodium.randombytes_buf(32)                           │
│ Almacenamiento: NUNCA en claro en servidor                       │
│   → Envuelta con pubkey de cada receptor (crypto_box_seal)      │
│   → Almacenada como encrypted_symmetric_key en tabla shares     │
│ Identificación: implícita por file_id + user_id en la BD        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PAR DE CLAVES ASIMÉTRICO X25519 (por usuario)                   │
│ Vida: persistente — generado una vez al registrarse             │
│ Tamaño: 32 bytes (pub) + 32 bytes (priv)                       │
│ Generación: sodium.crypto_box_keypair()                          │
│                                                                   │
│ Clave pública:                                                   │
│   → Almacenada en servidor (campo public_key del usuario)       │
│   → Accesible vía GET /api/users                                │
│   → Identificada por: user_id                                   │
│                                                                   │
│ Clave privada:                                                   │
│   → Cifrada con XSalsa20-Poly1305 (clave derivada de password) │
│   → Exportada como archivo .encrypted al registro               │
│   → El usuario la conserva localmente (NUNCA en el servidor)    │
│   → Identificada por: el usuario la gestiona manualmente        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CLAVE DERIVADA DE CONTRASEÑA (por usuario)                      │
│ Vida: transitoria — existe solo en memoria del navegador        │
│ Tamaño: 256 bits (32 bytes)                                     │
│ Derivación: BLAKE2b(password) → 32 bytes                        │
│ Uso: descifrar la clave privada X25519                          │
│ Almacenamiento: NUNCA persistida — solo en RAM durante sesión   │
│ Identificada por: implícita (derivada de la contraseña)         │
└─────────────────────────────────────────────────────────────────┘
```

**Resumen de identificación de claves:**

| Clave | ¿Dónde se almacena? | ¿Cómo se identifica? |
|---|---|---|
| Simétrica (archivo) | Wrapped en BD (`shares` table) | `file_id` + `user_id` |
| Pública X25519 | BD del servidor (`users` table) | `user_id` |
| Privada X25519 | Archivo local del usuario (`.encrypted`) | Gestión manual del usuario |
| Derivada de password | Solo RAM del navegador | Implícita (se recalcula cada vez) |


---

## D5 — Key Management (Gestión de Claves)

### 1. Función de derivación de claves (KDF): Argon2id
El sistema implementa **Argon2id (RFC 9106)** para transformar la contraseña del usuario en una clave de 32 bytes robusta.

* **¿Por qué no BLAKE2b?** A diferencia de BLAKE2b (que es un hash rápido), Argon2id es una KDF diseñada para ser costosa en memoria y tiempo, mitigando ataques de fuerza bruta por GPU/ASIC.
* **Parámetros:** 2 iteraciones (`opslimit`), 64 MiB de RAM (`memlimit`) y salt de 16 bytes.

### 2. Formato de Contenedor de Claves (BOV3)
Las claves privadas se exportan en un formato binario propio que garantiza la integridad de las llaves del usuario:


| Magic (4B) | Salt (16B) | Nonce (24B) | Ciphertext (N bytes) |
|---|---|---|---|
| `BOV3` | Para Argon2id | Para XSalsa20 | JSON cifrado con claves priv. |

### 3. Ciclo de Vida y Responsabilidad
* **Generación:** Ocurre 100% en el cliente mediante `libsodium` (CSPRNG).
* **Almacenamiento:** Modelo **Zero-Knowledge**. El servidor no tiene copia del archivo `.encrypted` ni de la contraseña.
* **Compromiso:** Ante sospecha de robo, se requiere la creación de una identidad nueva, ya que no existe un esquema de revocación centralizado.
