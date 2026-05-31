# Bóveda Digital — Vault de Documentos Seguro

Aplicación web de cifrado de archivos del lado del cliente que permite a los usuarios cifrar, firmar y compartir documentos de forma segura. Todas las operaciones criptográficas se ejecutan en el navegador usando libsodium; los datos en texto plano nunca salen del cliente sin cifrar.

---

## Descripción del Proyecto

Bóveda Digital es una aplicación web que implementa almacenamiento y compartición de archivos con cifrado de extremo a extremo. Los usuarios generan pares de claves asimétricas localmente, cifran archivos con cifrado simétrico autenticado, y los comparten con otros usuarios mediante cifrado híbrido. Las firmas digitales garantizan la autenticidad e integridad de los documentos compartidos.

El sistema integra:
- **Cifrado simétrico AEAD** (ChaCha20-Poly1305) para confidencialidad e integridad de archivos
- **Cifrado híbrido** (X25519 + ChaCha20-Poly1305) para compartición segura entre múltiples usuarios
- **Firmas digitales** (Ed25519) para autenticación del remitente
- **Almacenamiento de claves protegido por contraseña** (Argon2id + XSalsa20-Poly1305) para gestión de claves
- **Canonicalización JSON** (RFC 8785) para entradas de firma deterministas

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                  Navegador (Cliente)                     │
│                                                         │
│  ┌──────────┐   ┌─────────────┐   ┌─────────────────┐  │
│  │  Login/  │   │EncryptShare │   │ DecryptShared   │  │
│  │Registro  │   │ (Remitente) │   │  (Destinatario) │  │
│  └────┬─────┘   └──────┬──────┘   └────────┬────────┘  │
│       │                │                    │           │
│  ┌────▼────────────────▼────────────────────▼────────┐  │
│  │            Capa Criptográfica (libsodium)          │  │
│  │  chachaEncrypt.js  keyPair.js  canonicalize.js     │  │
│  │  passwordHash.js   dataUtils.js                    │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           │ HTTPS (solo texto cifrado)   │
└───────────────────────────┼─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                 Backend (Spring Boot)                    │
│  /auth  /users  /files/share  /files/shared  /error-logs │
│  Almacena: texto cifrado, shares, firmas, claves públicas│
└─────────────────────────────────────────────────────────┘
```

**Responsabilidades de cada componente:**

| Componente | Responsabilidad |
|------------|----------------|
| `src/crypto/chachaEncrypt.js` | Cifrado/descifrado AEAD con ChaCha20-Poly1305 |
| `src/crypto/keyPair.js` | Generación de claves X25519/Ed25519, formato BOV3, firma |
| `src/crypto/canonicalize.js` | Serialización JSON determinista RFC 8785 |
| `src/crypto/passwordHash.js` | Hash de contraseña con BLAKE2b para autenticación backend |
| `src/components/EncryptShare.jsx` | Interfaz de compartición multi-usuario con firma |
| `src/components/DecryptShared.jsx` | Interfaz de verificación de firma y descifrado |
| `src/services/` | Capa de comunicación con la API del backend |

**Formato del archivo cifrado (`.encrypted`):**
```
[4 bytes]  Longitud del encabezado (uint32 big-endian)
[N bytes]  Metadatos JSON canonicalizados (usados como AAD — autenticados, no cifrados)
[12 bytes] Nonce aleatorio
[M bytes]  Texto cifrado || etiqueta de autenticación Poly1305 (16 bytes)
```

**Flujo de compartición:**
```
Remitente cifra el archivo → genera clave simétrica K
  Para cada destinatario r:
    K_r = crypto_box_seal(K, clave_publica_x25519_de_r)
  Shares = [{ user_id, K_r }, ...] ordenados por user_id
  Firma = Ed25519_sign(SHA-512(texto_cifrado || canonicalize(Shares)))
  Subir: texto cifrado + Shares + Firma
```

---

## Instalación

### Requisitos Previos

- Node.js 18+ y npm
- Servicio backend corriendo en `http://localhost:8080` (Spring Boot)

### Configuración

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd boveda-digital-frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación se abrirá en `http://localhost:3000`.

### Build para producción

```bash
npm run build
```

La salida se genera en `dist/`.

### Ejecutar pruebas

```bash
npm test
```

---

## Ejemplos de Uso

### 1. Registrarse y generar par de claves

1. Abrir la aplicación e ir a la página de Login.
2. Ingresar un nombre de usuario y contraseña, luego hacer clic en **Registrarse**.
3. La aplicación genera un par de claves X25519 + Ed25519 localmente.
4. **Descargar y guardar el archivo `.keys`** — este contiene la clave privada cifrada. No puede recuperarse si se pierde.
5. Las claves públicas se registran automáticamente en el backend.

### 2. Cifrar y compartir un archivo

1. Ir a **Dashboard → Cifrar y Compartir**.
2. Seleccionar el archivo a compartir.
3. Seleccionar uno o más destinatarios de la lista de usuarios.
4. Cargar el archivo `.keys` e ingresar la contraseña.
5. Hacer clic en **Cifrar y Compartir**.
   - El archivo se cifra con una clave simétrica aleatoria.
   - La clave se encapsula con la clave pública X25519 de cada destinatario.
   - El contenedor (texto cifrado + shares) se firma con la clave Ed25519 del remitente.
   - Todo se sube al servidor.

### 3. Descifrar un archivo recibido

1. Ir a **Dashboard → Compartidos Conmigo**.
2. Cargar el archivo `.keys` e ingresar la contraseña.
3. Hacer clic en **Descifrar** sobre cualquier archivo.
   - La aplicación verifica la firma Ed25519. Si es inválida, se rechaza el descifrado.
   - La clave simétrica se desencapsula usando la clave privada X25519 propia.
   - El archivo se descifra y descarga con su nombre original.

### 4. Cifrar un archivo localmente (sin compartir)

1. Ir a **Herramienta Cripto** (modo archivo único).
2. Seleccionar un archivo y hacer clic en **Cifrar**.
3. Guardar la clave y el nonce mostrados — son necesarios para descifrar.
4. Para descifrar: seleccionar el archivo `.encrypted`, ingresar clave y nonce.

---

## Supuestos de Seguridad

- **El dispositivo del cliente es de confianza.** El modelo criptográfico no protege contra malware, keyloggers o un sistema operativo comprometido en el dispositivo del usuario.
- **El archivo de claves privadas debe mantenerse en secreto.** El archivo `.keys` está cifrado con Argon2id, pero una contraseña débil reduce la protección.
- **El servidor no es de confianza para confidencialidad.** El servidor almacena solo texto cifrado, shares de claves cifradas, firmas y claves públicas. Nunca ve contenido en plano ni claves simétricas sin cifrar.
- **El servidor es de confianza para disponibilidad y distribución de claves públicas.** Un servidor malicioso podría sustituir claves públicas o retener archivos, pero no puede descifrar el contenido.
- **Se asume verificación de identidad fuera de banda.** Los usuarios deben verificar la identidad de los destinatarios por un canal de confianza antes de compartir. El sistema no provee PKI ni autoridades de certificación.
- **Se asume HTTPS para transporte.** El frontend envía todas las llamadas a la API a través del backend via HTTPS en producción.
- **Los nonces son aleatorios.** El sistema depende del CSPRNG de libsodium para generación de nonces de 96 bits. La reutilización de nonces con la misma clave comprometería la confidencialidad de ChaCha20-Poly1305.

---

## Limitaciones Conocidas

- **Sin secreto hacia adelante (forward secrecy).** El compromiso de la clave privada X25519 de un usuario permite descifrar todos los archivos recibidos anteriormente.
- **Hash de contraseña BLAKE2b sin salt.** El hash de contraseña enviado al backend es determinista (sin salt), haciéndolo vulnerable a ataques de diccionario precomputados si la base de datos del backend es vulnerada.
- **Sin revocación de claves.** No existe mecanismo para revocar un par de claves comprometido ni rotar claves para archivos previamente compartidos.
- **Sin criptografía post-cuántica.** X25519 y Ed25519 no son resistentes a computadoras cuánticas.
- **Encapsulamiento de clave anónimo (sealed boxes).** `crypto_box_seal` no autentica al remitente de la clave encapsulada. La autenticidad del remitente se garantiza únicamente a nivel de la firma Ed25519.
- **Único punto de confianza del backend.** Todas las claves públicas se obtienen de un solo backend. Un backend comprometido podría servir claves públicas controladas por un atacante.
- **Estado de sesión en sessionStorage.** Los datos de sesión del usuario se almacenan en `sessionStorage`, accesible a scripts del mismo origen.
- **Sin deduplicación ni versionado de archivos.** Cada subida crea un texto cifrado independiente; no hay historial de versiones.

---

## Estructura del Proyecto

```
boveda-digital-frontend/
├── src/
│   ├── crypto/                    # Primitivas criptográficas
│   │   ├── chachaEncrypt.js       # Cifrado/descifrado ChaCha20-Poly1305
│   │   ├── keyPair.js             # Generación de claves, formato BOV3, firma Ed25519
│   │   ├── canonicalize.js        # Canonicalización JSON RFC 8785
│   │   ├── passwordHash.js        # Hash de contraseña con BLAKE2b
│   │   ├── dataUtils.js           # Conversiones Uint8Array/Blob/hex
│   │   ├── canonicalize.test.js   # Pruebas unitarias de canonicalización
│   │   ├── keyManagement.test.js  # Pruebas unitarias de gestión de claves
│   │   └── signature.test.js      # Pruebas unitarias de firma Ed25519
│   ├── components/
│   │   ├── EncryptShare.jsx       # Interfaz de cifrado multi-usuario + firma
│   │   ├── DecryptShared.jsx      # Interfaz de verificación + descifrado
│   │   ├── CryptoTool.jsx         # Interfaz de cifrado de archivo único
│   │   └── Navigation.jsx         # Barra de navegación superior
│   ├── pages/
│   │   ├── Dashboard.jsx          # Página principal (flujos de compartición)
│   │   └── Login.jsx              # Autenticación y registro
│   ├── services/
│   │   ├── api.js                 # Cliente HTTP con Axios
│   │   ├── authService.js         # Llamadas de login y registro
│   │   ├── fileService.js         # Llamadas API de compartición de archivos
│   │   └── errorLogService.js     # Reporte de errores
│   └── styles/                    # CSS por componente
├── docs/
│   └── SECURITY.md                # Documentación de seguridad
├── package.json
├── vite.config.js
└── index.html
```

---

## Dependencias

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `react` | ^19.2.0 | Framework de interfaz |
| `react-router-dom` | ^7.13.1 | Enrutamiento del lado del cliente |
| `axios` | ^1.13.6 | Cliente HTTP |
| `libsodium-wrappers` | ^0.8.2 | ChaCha20-Poly1305, X25519, Ed25519 |
| `libsodium-wrappers-sumo` | ^0.8.4 | XSalsa20-Poly1305 (cifrado de claves) |
| `vite` | ^7.2.4 | Herramienta de build y servidor de desarrollo |

---

**Versión:** 1.0.0  
**Última actualización:** Mayo 2026
