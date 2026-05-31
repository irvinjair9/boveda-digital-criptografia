# ✅ Prerrequisitos

Instala estas herramientas **antes** de comenzar:

- **Git**
- **Java 17 JDK**
- **Apache Maven** (3.8+)
- **Node.js** (LTS recomendado) y **npm**
- **IDE recomendado**  
  - Backend: IntelliJ IDEA / Eclipse / VS Code (con extensiones Java)  
  - Frontend: VS Code

### Verifica las versiones instaladas:

```bash
git --version
java -version
mvn -version
node -v
npm -v
```

# Instalación — Bóveda Digital

## Requisitos

- [Java 17+](https://www.oracle.com/java/technologies/downloads/#java17)
- [Node.js 18+](https://nodejs.org/)

---

## 1. Crear directorios y clonar el repositorio

Crear dos carpetas separadas, una para cada parte del sistema:

```bash
mkdir frontend
cd frontend
git clone https://github.com/irvinjair9/boveda-digital-criptografia.git
cd boveda-digital-criptografia
git checkout boveda-digital-frontend
cd ..
cd ..

mkdir backend
cd backend
git clone https://github.com/irvinjair9/boveda-digital-criptografia.git
cd boveda-digital-criptografia
git checkout boveda-digital-api
```

---

## 2. Ejecutar el Backend

Desde la carpeta `backend/boveda-digital-criptografia`:

```bash
# Windows
mvnw.cmd spring-boot:run

# Linux / macOS
./mvnw spring-boot:run
```

---

## 3. Ejecutar el Frontend

Abrir una nueva terminal y desde la carpeta `frontend/boveda-digital-criptografia`:

```bash
npm install
npm run dev
```

Abrir en el navegador: **http://localhost:3000**

> El backend debe estar corriendo antes de usar la aplicación.
