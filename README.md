# Bóveda Digital — Frontend (React + Vite) & Backend (Spring Boot + Java 17 + Maven)

Este repositorio contiene dos aplicaciones separadas:

- **Backend**: Spring Boot (Java 17, Maven) — rama `boveda-digital-api/`
- **Frontend**: React + Vite (JavaScript) — rama `boveda-digital-frontend/`

---

## ✅ Prerrequisitos

Instala estas herramientas **antes** de comenzar:

- **Git**
- **Java 17 JDK**
- **Apache Maven** (3.8+)
- **Node.js** (LTS recomendado) y **npm**
- **IDE recomendado**
  - Backend: IntelliJ IDEA / Eclipse / VS Code (con extensiones Java)
  - Frontend: VS Code

Verifica versiones:
```bash
git --version
java -version
mvn -version
node -v
npm -v
```
# Cómo correr los entornos

> **Nota:** Es importante clonar el repositorio **dos veces** en dos rutas distintas:  
> - Un clon para el **frontend**  
> - Un clon para el **backend**

---

## 🟦 Cómo correr el backend

1. Abrimos el proyecto clonado usando IntelliJ, y nos cambiamos de main a la rama **`boveda-digital-api`**
2. Abrir la carpeta del proyecto clonado para el backend llamada  **`boveda-digital-api`** que se encuentra en el repositorio utilizando **IntelliJ IDEA**.
3. Navegar a la ruta: src/main/java/com.example.boveda_digital_api/
4. Dar clic derecho sobre el archivo y seleccionar **Run**.
5. Una vez iniciado, podremos visualizar el endpoint en: http://localhost:8080/api/hola

---

## 🟩 Cómo correr el frontend

1. Abrimos el proyecto clonado usando IntelliJ, y nos cambiamos de main a la rama **`boveda-digital-frontend`**
2. Abrir la carpeta **`boveda-digital-frontend`** del repositorio usando **Visual Studio Code**.
4. Abrir una terminal nueva dentro de VS Code.
5. Ejecutar los siguientes comandos:

```bash
npm install
npm run dev
```
5. Podremos visualizarlo en: http://localhost:5000

