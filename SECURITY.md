# Documentación de Seguridad — Bóveda Digital API

## Tabla de Contenidos

1. [Resumen del Modelo de Amenazas](#1-resumen-del-modelo-de-amenazas)
2. [Decisiones de Diseño Criptográfico](#2-decisiones-de-diseño-criptográfico)
3. [Estrategia de Canonicalización](#3-estrategia-de-canonicalización)
4. [Estrategia de Gestión de Claves](#4-estrategia-de-gestión-de-claves)
5. [Hallazgos de Auditoría de Seguridad](#5-hallazgos-de-auditoría-de-seguridad)

---

## 1. Resumen del Modelo de Amenazas

### Rol del Backend en el Sistema

El backend de Bóveda Digital es un **servidor de almacenamiento sin conocimiento criptográfico** (*zero-knowledge storage*). No realiza cifrado ni descifrado. Su función es:

- Almacenar archivos ya cifrados por el cliente
- Distribuir claves públicas entre usuarios
- Servir texto cifrado y shares de claves a los destinatarios
- Registrar errores del frontend

Toda la confidencialidad es responsabilidad del cliente. Un atacante que comprometa completamente el servidor únicamente accede a texto cifrado, claves públicas y firmas — ninguno de estos datos es suficiente para recuperar el contenido de los archivos.

### Activos Almacenados en el Backend

| Activo | Sensibilidad | Notas |
|--------|-------------|-------|
| Texto cifrado de archivos | Baja (sin clave simétrica) | Cifrado con ChaCha20-Poly1305 por el cliente |
| Claves simétricas cifradas (shares) | Baja (sin clave privada X25519) | Encapsuladas con `crypto_box_seal` para cada destinatario |
| Firmas Ed25519 | Pública | Verificables con clave pública del firmante |
| Claves públicas X25519 y Ed25519 | Pública | Usadas por el cliente para cifrado y verificación |
| Hash de contraseña (BLAKE2b) | Media | Sin salt; vulnerable a rainbow tables |
| Metadatos de archivos | Baja | Nombre de archivo, timestamps, IDs |
| Logs de errores | Baja | Mensajes de error del frontend |

### Actores de Amenaza

**En alcance:**

| Actor | Capacidad | Amenaza |
|-------|-----------|---------|
| Atacante de red | Intercepta tráfico HTTP/HTTPS | Leer datos en tránsito si no hay TLS |
| Usuario autenticado malicioso | Acceso a endpoints con su propio ID | Enumerar archivos de otros usuarios (sin autorización por token) |
| Atacante con acceso a la base de datos | Lee todas las tablas | Accede a hashes de contraseñas y texto cifrado |
| Servidor comprometido | Control total del backend | Sustituir claves públicas, retener archivos, servir texto cifrado alterado |

**Fuera de alcance:**

| Actor | Por qué excluido |
|-------|-----------------|
| Atacante con clave privada del cliente | La seguridad del endpoint del cliente es responsabilidad del frontend |
| Computadora cuántica | No hay primitivas post-cuánticas en esta versión |
| Ataques de canal lateral al servidor | Fuera del alcance de esta implementación académica |

### Propiedades de Seguridad del Backend

| Propiedad | Estado | Justificación |
|-----------|--------|--------------|
| Confidencialidad del contenido de archivos | Garantizada por el cliente | El servidor solo almacena texto cifrado |
| Integridad de archivos en almacenamiento | No verificada por el servidor | El cliente verifica la firma Ed25519 al descargar |
| Autenticación de endpoints | No implementada | Sin JWT ni tokens de sesión |
| Autorización de acceso a archivos | No implementada | Sin validación de que el solicitante es destinatario |
| Confidencialidad de contraseñas | Parcial | Hash BLAKE2b sin salt almacenado |
| Integridad de claves públicas | No garantizada | El servidor puede ser modificado para servir claves falsas |

---

## 2. Decisiones de Diseño Criptográfico

### 2.1 Rol del Backend: Almacenamiento Sin Conocimiento

El diseño arquitectónico más importante del backend es que **no participa en ninguna operación criptográfica**. Esta decisión es intencional:

- El servidor no puede descifrar archivos aunque sea comprometido
- No se requiere hardware seguro en el servidor
- La confianza en el servidor se reduce al mínimo necesario (disponibilidad y distribución de claves públicas)

**Implicación:** La seguridad del sistema no depende de la seguridad del servidor, sino de la seguridad de las claves privadas del cliente.

### 2.2 Almacenamiento de Texto Cifrado

El backend recibe y almacena el contenido cifrado del archivo como campo `BYTEA` en PostgreSQL. El formato del texto cifrado (incluyendo el nonce y la etiqueta Poly1305) lo define el cliente; el servidor lo trata como un bloque opaco de bytes.

El campo `iv` almacena el nonce utilizado en el cifrado. Este valor es público (no secreto) y necesario para que el cliente realice el descifrado.

### 2.3 Distribución de Claves Públicas

Las claves públicas X25519 (cifrado) y Ed25519 (verificación de firmas) se almacenan en la tabla `users` al momento del registro y se sirven a cualquier usuario autenticado mediante `GET /api/users`.

**Consideración de seguridad:** El servidor es el punto único de distribución de claves públicas. Un servidor comprometido podría sustituir la clave pública de un usuario por una controlada por el atacante, permitiendo un ataque de hombre en el medio sobre el cifrado de archivos. Este riesgo es inherente a sistemas sin PKI y está documentado como limitación conocida.

### 2.4 Almacenamiento de la Clave Pública del Firmante

Al subir un archivo, el cliente envía la clave pública Ed25519 del firmante (`signing_public_key`). Esta se almacena en el registro del archivo. Al servir los archivos compartidos, el backend **también consulta la clave pública desde la tabla `users`** y la incluye en la respuesta para que el cliente pueda verificar la firma.

El cliente usa la clave obtenida desde `users`, no la almacenada en el archivo, para la verificación — esto evita que el subidor controle qué clave se usa para verificar sus propias firmas.

### 2.5 Hash de Contraseña

El backend recibe y almacena el hash BLAKE2b de la contraseña generado por el cliente. La comparación en login es directa:

```java
if (user.get().getPassword().equals(password)) { return user; }
```

**Nota:** BLAKE2b fue elegido por el equipo del frontend como función de hash del lado del cliente para compatibilidad con libsodium. La gestión de contraseñas con KDF seguro (Argon2id) se aplica al archivo de claves privadas, no al hash de login. Ver hallazgo de auditoría #1.

---

## 3. Estrategia de Canonicalización

### Responsabilidad del Backend

La canonicalización RFC 8785 es una responsabilidad **exclusiva del cliente** (frontend). El backend no realiza ni verifica canonicalización.

El backend recibe:
- La lista de shares como JSON (campo `shares` en el formulario multipart)
- La firma Ed25519 del contenedor (campo `signature`)

Al construir la respuesta de `GET /api/files/shared/{userId}`, el backend incluye **todos los shares del archivo** (no solo el del destinatario solicitante). Esto es necesario porque el cliente necesita la lista completa y ordenada de shares para reconstruir el input de la firma y verificarla.

### Ordenamiento de Shares en la Respuesta

El backend incluye en la respuesta de archivos compartidos la lista completa de shares tal como está almacenada en la base de datos. El cliente es responsable de ordenarlos por `user_id` antes de canonicalizar para la verificación de la firma.

---

## 4. Estrategia de Gestión de Claves

### Claves Gestionadas por el Backend

El backend solo gestiona **claves públicas**:

| Clave | Dónde se almacena | Quién la usa |
|-------|------------------|-------------|
| Clave pública X25519 del usuario | Tabla `users.public_key` | Remitentes para encapsular clave simétrica |
| Clave pública Ed25519 del usuario | Tabla `users.signing_public_key` | Destinatarios para verificar firmas |

Las **claves privadas nunca llegan al servidor**. Se generan en el navegador del cliente y se almacenan localmente en el archivo `.keys` cifrado con Argon2id.

### Registro de Claves (Flujo de Registro)

1. El cliente genera el par de claves X25519 y Ed25519 localmente
2. El cliente cifra las claves privadas con Argon2id + XSalsa20-Poly1305 (formato BOV3)
3. El cliente sube las claves públicas al backend via `POST /api/auth/register`
4. El backend almacena las claves públicas en la tabla `users`
5. El cliente descarga el archivo `.keys` con las claves privadas cifradas

### Distribución de Claves para Compartición

Cuando el remitente quiere compartir un archivo:
1. Consulta `GET /api/users` para obtener las claves públicas X25519 de todos los destinatarios
2. Encapsula la clave simétrica del archivo con la clave pública de cada destinatario
3. Sube el archivo con todos los shares al backend

El backend no participa en la lógica de encapsulamiento de claves.

### Recuperación de Claves para Verificación de Firma

Cuando el destinatario verifica una firma:
1. El backend incluye en la respuesta de `GET /api/files/shared/{userId}` la clave pública Ed25519 del firmante (obtenida de la tabla `users`)
2. El cliente usa esta clave para verificar la firma Ed25519 localmente

---

## 5. Hallazgos de Auditoría de Seguridad

Los siguientes hallazgos fueron identificados durante una revisión manual del código fuente del backend.

### Hallazgo 1 — Hash de Contraseña Sin Salt (Severidad: Media)

**Ubicación:** `UsersService.java` — método de login; `UsersEntity.java` — campo `password`  
**Descripción:** Las contraseñas se almacenan como hash BLAKE2b sin salt por usuario. BLAKE2b es una función de hash criptográfico general, no un KDF diseñado para contraseñas. El hash es determinista: dos usuarios con la misma contraseña tendrán el mismo hash.  
**Impacto:** Un atacante con acceso de lectura a la base de datos puede usar tablas rainbow o ataques de diccionario precomputados para recuperar contraseñas.  
**Recomendación:** Usar Argon2id con salt aleatorio por usuario en el servidor. Alternativamente, enviar la contraseña en texto plano sobre HTTPS y hacer el hash en el servidor con bcrypt o Argon2id.

### Hallazgo 2 — Sin Autenticación ni Autorización en Endpoints (Severidad: Alta)

**Ubicación:** Todos los controllers  
**Descripción:** Ningún endpoint requiere autenticación. No existen JWT, sesiones, ni ningún mecanismo que valide que el solicitante es quien dice ser. Cualquier usuario puede consultar `GET /api/files/shared/{userId}` con el ID de otro usuario y obtener sus archivos compartidos.  
**Impacto:** Un usuario malintencionado con cuenta en el sistema puede acceder a los metadatos y texto cifrado de archivos de cualquier otro usuario.  
**Recomendación:** Implementar autenticación con JWT en todos los endpoints protegidos. Validar en el servidor que el `userId` de la solicitud coincide con el usuario autenticado en el token.

### Hallazgo 3 — Credenciales de Base de Datos en Texto Plano (Severidad: Alta)

**Ubicación:** `src/main/resources/application.properties`  
**Descripción:** Las credenciales de la base de datos de producción (URL, usuario y contraseña de Supabase) están en texto plano en el archivo de configuración versionado en el repositorio.  
**Impacto:** Cualquier persona con acceso al repositorio puede conectarse directamente a la base de datos de producción.  
**Recomendación:** Usar variables de entorno o un gestor de secretos (Vault, AWS Secrets Manager) para credenciales de producción. No versionar el archivo `application.properties` con credenciales reales.

### Hallazgo 4 — Sin Validación de Tamaño ni Tipo de Archivo (Severidad: Baja)

**Ubicación:** `FilesController.java` — endpoint `POST /api/files/share`  
**Descripción:** El backend acepta cualquier archivo hasta 50 MB sin validar el tipo de contenido ni realizar sanitización del nombre de archivo.  
**Impacto:** Posibilidad de almacenar contenido no deseado o abusar del almacenamiento del servidor.  
**Recomendación:** Validar el nombre de archivo para prevenir path traversal. Considerar limitar los tipos de archivo aceptados si el caso de uso lo permite.

### Hallazgo 5 — Sin Paginación en Endpoints de Listado (Severidad: Baja)

**Ubicación:** `UsersController.java`, `FilesController.java`  
**Descripción:** Los endpoints `GET /api/users` y `GET /api/files/shared/{userId}` retornan todos los registros sin límite ni paginación.  
**Impacto:** Con muchos usuarios o archivos, las respuestas pueden volverse muy grandes, degradando el rendimiento y pudiendo causar timeouts o errores de memoria.  
**Recomendación:** Implementar paginación con parámetros `page` y `size` en los endpoints de listado.

### Hallazgo 6 — Endpoint de Prueba Expuesto (Severidad: Informativa)

**Ubicación:** `HelloController.java` — `GET /api/hola`  
**Descripción:** Existe un endpoint de prueba (`/api/hola`) que retorna "hola desde spring". No representa un riesgo de seguridad directo, pero expone información sobre el stack tecnológico.  
**Recomendación:** Eliminar endpoints de prueba antes de un despliegue en producción.

### Tabla Resumen

| # | Hallazgo | Severidad | Estado |
|---|---------|----------|--------|
| 1 | Hash de contraseña sin salt | Media | Abierto |
| 2 | Sin autenticación ni autorización en endpoints | Alta | Abierto |
| 3 | Credenciales de base de datos en el repositorio | Alta | Abierto |
| 4 | Sin validación de tipo/nombre de archivo | Baja | Abierto |
| 5 | Sin paginación en endpoints de listado | Baja | Abierto |
| 6 | Endpoint de prueba expuesto | Informativa | Abierto |

---

*Documento generado para Entrega Final — Bóveda Digital Segura*  
*Fecha: Mayo 2026*
