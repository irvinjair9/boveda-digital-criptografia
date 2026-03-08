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

- **Algoritmo**: ChaCha20-Poly1305 IETF
- **Encriptación**: ChaCha20 (256-bit)
- **Autenticación**: Poly1305 MAC (128-bit)
- **Nonce**: 96-bit generado aleatoriamente
- **Librería**: libsodium (implementación profesional)

### Características de Seguridad

✅ **AEAD** - Autenticación + Encriptación en una operación  
✅ **Random Nonces** - Único para cada encriptación  
✅ **Poly1305 Verification** - Detección automática de modificaciones  
✅ **Constant-time Operations** - Resistente a timing attacks  

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

