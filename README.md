# Bóveda Digital — API Backend

Servicio REST desarrollado en Spring Boot que actúa como servidor de almacenamiento para la Bóveda Digital. Gestiona usuarios, archivos cifrados, shares de claves y firmas digitales. **No realiza operaciones criptográficas propias** — toda la criptografía ocurre en el cliente (frontend).

---

## Descripción del Proyecto

El backend es el punto de almacenamiento y distribución del sistema. Sus responsabilidades son:

- Registrar usuarios y almacenar sus claves públicas (X25519 y Ed25519)
- Autenticar usuarios por nombre de usuario y contraseña
- Recibir y almacenar archivos cifrados junto con sus shares de claves y firmas digitales
- Servir archivos cifrados y metadatos a los destinatarios autorizados
- Registrar errores reportados por el frontend

El servidor nunca ve contenido en texto plano ni claves simétricas sin cifrar. Toda la confidencialidad está garantizada por el cliente.

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────┐
│                  Cliente (Navegador)                 │
│         Cifra, firma y descifra localmente           │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS / REST
┌───────────────────────▼─────────────────────────────┐
│               Spring Boot API (este servicio)        │
│                                                     │
│  AuthController   FilesController   UsersController  │
│       │                 │                 │          │
│  UsersService      FilesService           │          │
│       │                 │                 │          │
│  UsersDAO         FilesDAO           FileSharesDAO   │
│       │                 │                 │          │
└───────┼─────────────────┼─────────────────┼─────────┘
        │                 │                 │
┌───────▼─────────────────▼─────────────────▼─────────┐
│              PostgreSQL (Supabase)                   │
│   users   files   file_shares   error_logs           │
└─────────────────────────────────────────────────────┘
```

**Capas de la aplicación:**

| Capa | Paquete | Responsabilidad |
|------|---------|----------------|
| Controller | `controller/` | Recibe peticiones HTTP, valida entrada, retorna JSON |
| Service | `services/` | Lógica de negocio, ensamblado de respuestas |
| DAO/Repository | `dao/` | Acceso a base de datos vía Spring Data JPA |
| Entity | `entity/` | Modelos de base de datos con anotaciones JPA |
| Config | `config/` | Configuración de CORS |

---

## Instalación

### Requisitos Previos

- Java 17+
- Maven 3.8+
- PostgreSQL (o acceso a la instancia Supabase configurada)

### Configuración

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd boveda-digital-api

# Compilar el proyecto
./mvnw clean install

# Ejecutar
./mvnw spring-boot:run
```

El servidor inicia en `http://localhost:8080`.

### Variables de Configuración

Editar `src/main/resources/application.properties`:

```properties
# Base de datos PostgreSQL
spring.datasource.url=jdbc:postgresql://<host>:<puerto>/postgres
spring.datasource.username=<usuario>
spring.datasource.password=<contraseña>

# Almacenamiento de archivos
files.storage.path=uploads

# Tamaño máximo de archivo
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=50MB
```

---

## Endpoints de la API

### Autenticación — `/api/auth`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Registrar nuevo usuario |
| `POST` | `/api/auth/login` | Iniciar sesión |

**Registro — Body:**
```json
{
  "name": "Juan",
  "last_name": "Pérez",
  "username": "juanperez",
  "email": "juan@ejemplo.com",
  "password": "hash_blake2b_en_hex",
  "public_key": "clave_publica_x25519_hex",
  "signing_public_key": "clave_publica_ed25519_hex"
}
```

**Login — Body:**
```json
{
  "username": "juanperez",
  "password": "hash_blake2b_en_hex"
}
```

---

### Usuarios — `/api/users`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/users` | Listar todos los usuarios con sus claves públicas |

**Respuesta:** Lista de usuarios (sin contraseñas), incluyendo `public_key` y `signing_public_key` para cifrado y verificación de firmas.

---

### Archivos — `/api/files`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/files/share` | Subir archivo cifrado con shares |
| `GET` | `/api/files/shared/{userId}` | Listar archivos compartidos con un usuario |
| `GET` | `/api/files/shared/download/{fileId}` | Descargar contenido binario de un archivo |

**Compartir archivo — Multipart Form:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `file` | Archivo | Contenido cifrado del archivo |
| `filename` | String | Nombre original del archivo |
| `owner_id` | Long | ID del propietario |
| `shares` | String (JSON) | Lista de shares: `[{"user_id": 1, "encrypted_symmetric_key": "hex"}]` |
| `iv` | String | Vector de inicialización (nonce) |
| `signature` | String | Firma Ed25519 del contenedor (hex) |
| `signer_id` | Long | ID del firmante |
| `signing_public_key` | String | Clave pública Ed25519 del firmante |

**Respuesta de archivos compartidos:** Incluye metadatos del archivo, clave simétrica cifrada para el destinatario, todos los shares (para verificar la firma) y la clave pública del firmante.

---

### Registro de Errores — `/api/error-logs`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/error-logs` | Registrar un error del frontend |

---

## Modelo de Datos

### Tabla `users`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | BIGINT (PK) | Identificador del usuario |
| `name` | VARCHAR | Nombre |
| `last_name` | VARCHAR | Apellido |
| `username` | VARCHAR (único) | Nombre de usuario |
| `email` | VARCHAR | Correo electrónico |
| `password` | VARCHAR | Hash de contraseña (BLAKE2b) |
| `public_key` | TEXT | Clave pública X25519 (hex) |
| `signing_public_key` | TEXT | Clave pública Ed25519 (hex) |

### Tabla `files`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID (PK) | Identificador del archivo |
| `owner_id` | BIGINT (FK) | Usuario propietario |
| `filename` | VARCHAR | Nombre original del archivo |
| `file_content` | BYTEA | Contenido cifrado |
| `iv` | VARCHAR | Nonce utilizado en el cifrado |
| `signature` | TEXT | Firma Ed25519 del contenedor |
| `signer_id` | BIGINT (FK) | Usuario que firmó |
| `signer_signing_public_key` | TEXT | Clave Ed25519 del firmante |
| `created_at` | TIMESTAMP | Fecha de creación |

### Tabla `file_shares`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID (PK) | Identificador del share |
| `file_id` | UUID (FK) | Archivo referenciado |
| `user_id` | BIGINT (FK) | Usuario destinatario |
| `encrypted_symmetric_key` | TEXT | Clave simétrica cifrada con X25519 del destinatario |
| `created_at` | TIMESTAMP | Fecha de creación |

### Tabla `error_logs`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | BIGINT (PK) | Identificador del log |
| `module` | VARCHAR | Módulo donde ocurrió el error |
| `public_message` | TEXT | Mensaje de error público |
| `internal_reason` | TEXT | Razón técnica interna |
| `details` | TEXT | Detalles completos del error |
| `created_at` | TIMESTAMP | Fecha de registro |

---

## Supuestos de Seguridad

- **El cliente es responsable de toda la criptografía.** El backend almacena únicamente datos ya cifrados y nunca opera sobre texto plano.
- **Las claves públicas se distribuyen con confianza en el servidor.** Los clientes deben verificar identidades por canal externo.
- **HTTPS en producción.** Las credenciales y datos sensibles solo deben transmitirse sobre conexiones cifradas.
- **La contraseña se recibe ya hasheada.** El frontend envía el hash BLAKE2b; el servidor compara directamente.

---

## Limitaciones Conocidas

- **Sin autenticación por token.** Los endpoints no requieren JWT ni sesión autenticada — cualquier usuario puede consultar archivos de otro si conoce el ID.
- **Sin autorización de acceso a archivos.** No se valida que el `userId` en `/files/shared/{userId}` corresponda al usuario autenticado.
- **Contraseñas almacenadas como hash sin salt.** BLAKE2b sin salt es determinista; vulnerable a tablas rainbow si la base de datos es comprometida.
- **Sin eliminación de archivos.** No existe endpoint para borrar archivos o shares.
- **Sin paginación.** Los endpoints de listado retornan todos los registros sin límite.
- **Archivos almacenados en base de datos (BYTEA).** Archivos grandes pueden degradar el rendimiento de PostgreSQL.

---

## Dependencias Principales

| Dependencia | Versión | Propósito |
|-------------|---------|-----------|
| Spring Boot | 4.0.2 | Framework principal |
| Spring Data JPA | (incluido) | ORM y acceso a datos |
| Spring Web | (incluido) | REST API |
| PostgreSQL Driver | (incluido) | Conexión a base de datos |
| Jackson Databind | (incluido) | Serialización JSON |
| Java | 17 | Lenguaje |

---

**Versión:** 1.0.0  
**Última actualización:** Mayo 2026
