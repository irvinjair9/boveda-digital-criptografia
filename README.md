# Bóveda Digital — Frontend (React + Vite) & Backend (Spring Boot + Java 17 + Maven)

Este repositorio contiene dos aplicaciones separadas:

- **Backend**: Spring Boot (Java 17, Maven) — rama `boveda-digital-api/`
- **Frontend**: React + Vite (JavaScript) — rama `boveda-digital-frontend/`

## Roles asignados
- **Aguilar Pérez José Ramón**: Desarrollador de Algoritmos  
- **Carbajal Reyes Irvin Jair**: Project Manager  
- **Gómez Vázquez Juan Pablo**: Desarrollador Frontend  
- **Sánchez Calvillo Saida Mayela**: Testing / QA  

## Canales de comunicación
- Se estará trabajando por medio de llamadas de Google Meet, así como también nos estaremos comunicando por medio de un grupo de WhatsApp en caso de que los integrantes no puedan estar presencialmente.

---

# 🔬 Secure Digital Document Vault - Laboratorio

## 1. System Overview (Descripción General)

### ¿Qué problema resuelve nuestra bóveda?

En un entorno de laboratorio, la integridad de los resultados y la confidencialidad de las fórmulas son críticas. Este sistema evita que documentos sensibles sean leídos por personas no autorizadas o modificados malintencionadamente durante su envío entre investigadores.

### Funcionalidades principales:

- **Cifrado de archivos:** Protege el contenido para que solo el destinatario pueda leerlo.
- **Firmas digitales:** Permite verificar quién envió el documento y que este no ha sido alterado.
- **Gestión de llaves:** Almacena y protege las llaves del usuario mediante una contraseña.
- **Intercambio seguro:** Permite compartir un mismo archivo con múltiples colegas de forma protegida.

### Fuera de alcance:

- Seguridad física de las computadoras del laboratorio.
- Recuperación de archivos si el usuario olvida su contraseña maestra.

---
---

## 2. Diagrama de Arquitectura 

```mermaid
flowchart LR

  %% ===== ENTORNO CONFIABLE USUARIO =====
  subgraph TRUSTED_USER[Confiable - Entorno del Usuario]
    direction TB
    U[Usuario]
    UI[Aplicacion Vault Frontend]
    KS[Key Store Llaves Privadas Cifradas]
    SIGN[Modulo de Firma Digital]
    ENC[Modulo de Cifrado]
    VER[Verificacion de Firma]
    DEC[Modulo de Descifrado]
  end

  %% ===== ENTORNO CONFIABLE BACKEND =====
  subgraph TRUSTED_BACKEND[Confiable - Servicio Vault]
    direction TB
    API[Backend Vault API]
  end

  %% ===== ENTORNO NO CONFIABLE =====
  subgraph UNTRUSTED[No Confiable - Almacenamiento y Red]
    direction TB
    SP1[ ]:::invisible
    SP2[ ]:::invisible
    ST[(Almacenamiento Local o Remoto)]
    NET[[Transporte por Red]]
  end

  classDef invisible fill=transparent,stroke=transparent,color=transparent;

  PK[Llaves Publicas de Destinatarios]
  C[Contenedor de Archivo Cifrado]

  %% ===== FLUJO DE CREACION =====
  U --> UI
  UI --> KS
  KS --> SIGN
  UI --> SIGN
  SIGN --> ENC
  PK --> ENC
  ENC --> C
  C --> API
  API --> ST
  API --> NET

  %% ===== FLUJO DE RECEPCION =====
  NET --> UI
  ST --> API
  API --> UI
  UI --> VER
  VER --> DEC
  KS --> DEC
  DEC --> UI
