# 🔐 Bóveda Digital - Encriptación de Archivos

Aplicación web moderna para encriptar y desencriptar archivos usando **ChaCha20-Poly1305 AEAD** (Authenticated Encryption with Associated Data).

## 🌟 Características

✅ **Encriptación de Archivos**
- ChaCha20-Poly1305 para cifrado y autenticación integrados
- Generación automática de claves y nonces criptográficamente seguros
- Interfaz intuitiva con drag & drop

✅ **Desencriptación Segura**
- Validación automática de autenticidad (Poly1305)
- Rechazo de archivos modificados o con clave incorrecta
- Descarga directa del archivo original

✅ **Diseño Moderno**
- Interfaz hermosa con gradientes y animaciones
- Responsive design para móviles y desktops
- Dark-friendly gradient theme

✅ **Gestión de Bandeja**
- Visualización de archivos encriptados recibidos
- Desencriptación bajo demanda
- Descarga segura

## 📋 Estructura del Proyecto

```
src/
├── components/
│   ├── CryptoTool.jsx        # Herramienta principal de encriptación/desencriptación
│   ├── Navigation.jsx         # Navegación superior
│   └── (componentes antiguos eliminados)
├── pages/
│   ├── Dashboard.jsx          # Página principal
│   └── Inbox.jsx              # Bandeja de archivos
├── crypto/
│   ├── chachaEncrypt.js       # Lógica de encriptación/desencriptación
│   ├── dataUtils.js           # Utilidades de conversión de datos
│   └── README.md              # Documentación del módulo crypto
├── services/
│   ├── api.js                 # Cliente HTTP con axios
│   └── fileService.js         # Servicios de archivo
├── styles/
│   ├── CryptoTool.css         # Estilos de herramienta crypto
│   ├── Inbox.css              # Estilos de bandeja
│   ├── Navigation.css         # Estilos de navegación
│   └── App.css                # Estilos globales
└── App.jsx, main.jsx, etc.
```

## 🚀 Inicio Rápido

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

La aplicación se abrirá en `http://localhost:5173`

### Build para Producción

```bash
npm run build
```

## 📖 Uso

### 1️⃣ Encriptar Archivo

```
1. Ve a la página principal (Encriptar)
2. Arrastra un archivo o haz clic para seleccionar
3. Haz clic en "Encriptar Archivo"
4. Se generarán automáticamente:
   - Archivo cifrado (.encrypted)
   - Clave (hexadecimal)
   - Nonce (hexadecimal)
5. Copia las credenciales y descarga el archivo
```

### 2️⃣ Desencriptar Archivo

```
1. Selecciona un archivo encriptado
2. Haz clic en "Desencriptar Archivo"
3. Ingresa la CLAVE cuando se solicite
4. Ingresa el NONCE cuando se solicite
5. El archivo original se descargará automáticamente
```

### 3️⃣ Recibir Archivos

```
1. Ve a la Bandeja (📬)
2. Visualiza todos los archivos encriptados recibidos
3. Haz clic en "Descargar" para obtener el archivo original
```

## 🔐 Seguridad

### Encryption Design Section

#### Algoritmo AEAD Seleccionado: ChaCha20-Poly1305 IETF

**ChaCha20-Poly1305** es un esquema de Authenticated Encryption with Associated Data (AEAD) que combina dos primitivas criptográficas:

- **ChaCha20**: Cifrado de flujo (stream cipher) que genera una secuencia pseudoaleatoria para cifrar los datos
- **Poly1305**: Código de autenticación basado en MAC que genera una etiqueta de autenticidad

Este algoritmo es considerado **estándar de facto moderno** y es recomendado por IETF (RFC 7539, RFC 8439).

#### Parámetros Criptográficos

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| **Tamaño de Clave** | 256 bits (32 bytes) | Clave de encriptación compartida entre remitente y destinatario |
| **Tamaño de Nonce** | 96 bits (12 bytes) | Número único utilizado una sola vez por clave |
| **Tamaño de Tag** | 128 bits (16 bytes) | Código de autenticación que verifica integridad |
| **Recomendación** | FIPS 202, NIST | Considerado criptográficamente seguro |

#### Estrategia de Nonce

El nonce es generado de forma **completamente aleatoria** para cada encriptación:

```javascript
const nonce = sodium.randombytes_buf(
  sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES // 12 bytes
);
```

- **Generación**: Usando `randombytes_buf()` de libsodium (CSPRNG - Cryptographically Secure Pseudo-Random Number Generator)
- **Frecuencia**: Un nonce diferente para cada archivo encriptado
- **Garantía**: La probabilidad matemática de repetición con 96-bit random es prácticamente imposible (< 2^-64)

#### Estrategia de Autenticación de Metadatos

Los metadatos del archivo se protegen usando **Additional Associated Data (AAD)**:

```javascript
// Metadatos autenticados pero NO cifrados
const metadata = { fileName, fileSize, version: 1 };
const metadataJson = JSON.stringify(metadata);
const metadataBytes = new TextEncoder().encode(metadataJson);

// Encriptación con AAD
const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
  fileBuffer,
  metadataBytes,  // ← AAD: autenticado pero no cifrado
  null,
  nonce,
  key
);
```

**Beneficio**: El tag Poly1305 incluye tanto el contenido del archivo **como** los metadatos. Si alguien modifica el nombre o tamaño del archivo, la desencriptación **fallará automáticamente**.

Formato del archivo `.encrypted`:
```
[4 bytes: longitud del header JSON]
[N bytes: header JSON con metadatos (autenticado)]
[12 bytes: nonce]
[M bytes: ciphertext cifrado + 16 bytes Poly1305 tag]
```

### Security Decisions

#### 1️⃣ ¿Por qué AEAD en lugar de Encriptación + Hash?

**Razones técnicas:**

| Aspecto | Encriptación + Hash | AEAD |
|--------|---------------------|------|
| **Complejidad** | 2 operaciones ❌ | 1 operación ✅ |
| **Riesgo de Error** | Alto (puede fallar validación) | Bajo (falsa automáticamente) |
| **Timing Attacks** | Vulnerable 🚨 | Resistente ✅ |
| **Tag Implícito** | No, debe incluirse | Sí, integrado |
| **Verificación Ordenada** | Crítica, fácil de equivocar | Automática ✅ |

**Problema histórico (Encrypt-then-MAC vs others):**
- Históricos implementadores han cometido errores fatales validando MAC después de desencriptar
- Esto puede exponer información del contenido antes de validar autenticidad
- AEAD **fuerza** a validar ambas simultáneamente

**Nuestro caso:**
AEAD garantiza que si el archivo fue modificado (incluso 1 bit), la validación Poly1305 fallará **antes** de retornar cualquier dato desencriptado.

#### 2️⃣ ¿Qué Sucede si el Nonce se Repite?

**Escenario del ataque:**

Si se usa la **misma clave** con el **mismo nonce** dos veces:

1. ChaCha20 genera el **mismo keystream** exacto
2. Ciphertext1 XOR Keystream = Plaintext1
3. Ciphertext2 XOR Keystream = Plaintext2
4. **Ciphertext1 XOR Ciphertext2 = Plaintext1 XOR Plaintext2** ❌

**Riesgo:**
- Los dos plaintexts quedan XOReados, revelando su estructura
- En textos normales, esto puede permitir recuperar parcialmente el contenido
- **CRÍTICO**: Nunca reutilizar (clave, nonce)

**Mitigación en Bóveda Digital:**
- ✅ Nonce generado **aleatoriamente** cada vez (96-bit)
- ✅ Probabilidad de colisión: < 1 en 2^64 operaciones
- ✅ Incluso si se encripta 2^32 archivos, probabilidad de colisión < 0.0001%

**Nota de construcción:** Para máxima seguridad, aplicaciones críticas usan nonces **secuenciales** (contador) con hardware dedicado, pero para encriptación web general, random es aceptable por libsodium.

#### 3️⃣ ¿Contra Qué Atacantes nos Defendemos?

**Perfil de Atacante Defendido:**

| Tipo de Ataque | Defensa | Protección |
|----------------|---------|-----------|
| **Eavesdropping** (escucha de tráfico) | ChaCha20 encriptación |  ✅ Máxima |
| **Modification** (cambio de contenido) | Poly1305 authentication | ✅ Máxima |
| **Metadata Tampering** (modificación de nombre/tamaño) | AAD authentication | ✅ Máxima |
| **Wrong Key Detection** | Tag validation | ✅ Detección automática |
| **Timing Attacks** (información por tiempo) | Constant-time libsodium | ✅ Protegido |

**Atacantes NO defendidos:**

| Ataque | Razón | Mitigation |
|--------|-------|-----------|
| **Key Brute-Force** | 256-bit key space (2^256) | Imposible en tiempo polinomial |
| **Side-Channel local** | Acceso físico a la máquina | Uso de libsodium (constant-time) |
| **Quantum Computing** | Amenaza futura | Considerar Post-Quantum Cryptography en futuro |
| **Keylogger/Malware** | Acceso a sistema operativo | Escapa del alcance de la criptografía |
| **Social Engineering** | Engaño de usuario | Educación del usuario |

**Modelo de Amenaza Asumido:**

✅ Protegemos contra:
- Red insegura (ej: Wi-Fi público)
- Interceptación pasiva
- Modificación accidental o malintencionada
- Archivos interceptados en tránsito o almacenamiento

❌ Suponemos que:
- La clave es secreta y transmitida de forma segura (fuera de banda o HTTPS)
- El dispositivo del usuario no está comprometido
- No hay acceso root/admin al sistema

#### Recomendaciones de Uso Seguro

1. **Compartir claves de forma segura**:
   - No usar el mismo email/chat que el archivo
   - Usar canal secundario (teléfono, mensaje encriptado)
   - Verificar identidad del destinatario

2. **Gestión de claves**:
   - No guardar claves en texto plano
   - No reutilizar claves entre diferentes archivos
   - Eliminar claves después de confirmaciónnoon recepción

3. **Almacenamiento**:
   - Archivos `.encrypted` + claveson seguros en internet
   - Sin clave, el archivo es matemáticamente inutilizable  

## 📦 Dependencias Principales

```json
{
  "react": "^18.x",
  "react-router-dom": "^6.x",
  "axios": "^1.x",
  "libsodium-wrappers": "^0.7.x"
}
```

## 🎨 Temas de Color

- **Primario**: `#667eea` (Azul)
- **Secundario**: `#764ba2` (Púrpura)
- **Éxito**: `#4ade80` (Verde)
- **Error**: `#f5576c` (Rojo)

## 📱 Responsive

- ✅ Desktop (1920px+)
- ✅ Tablet (768px - 1024px)
- ✅ Mobile (< 768px)

## � Debugging

### Consola del Navegador

Si tienes problemas con la desencriptación, abre la consola del navegador (F12) y ejecuta:

```javascript
// Cargar herramientas de debug
import('./src/crypto/debug.js').then(() => {
  // Probar funcionalidad básica
  cryptoDebug.test();
  
  // Probar con datos específicos
  cryptoDebug.roundTrip([72, 101, 108, 108, 111]); // "Hello"
});
```

### Pruebas en la Interfaz

1. Ve a la página principal (Encriptar)
2. Haz clic en "Prueba Básica" o "Prueba Avanzada"
3. Revisa la consola del navegador para logs detallados

### Errores Comunes

- **"invalid public_nonce length"**: El nonce no tiene 12 bytes (24 caracteres hex)
- **"Longitud de clave inválida"**: La clave no tiene 32 bytes (64 caracteres hex)
- **"Clave debe ser hexadecimal válida"**: La clave contiene caracteres no válidos

### Logs de Debug

Los logs aparecen en la consola del navegador con el prefijo:
- `🔍 Debug decryptFile:` - Detalles de la desencriptación
- `🧪 Probando...` - Resultados de pruebas
- `❌ Error en...` - Errores detallados

## 📄 Licencia

Este proyecto está desarrollado como parte de Bóveda Digital.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

---

**Última actualización**: Marzo 2026  
**Versión**: 1.0.0

