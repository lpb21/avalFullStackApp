# Flujo de Aprobaciones con Firma Digital Concatenada
 
Prueba Técnica Fullstack Senior — AVAL Asset Management (Grupo Aval).
 
Aplicación completa de aprobación de solicitudes de compra con firma digital concatenada (hash chain), verificación por OTP y generación de evidencia en PDF. Backend 100% serverless en AWS; frontend en React con arquitectura de microfrontends (Module Federation).
 
---
 
## 🌐 En vivo
 
| | URL |
|---|---|
| **Frontend** | https://d17ikmoptxcbe1.cloudfront.net |
| **Backend (API)** | https://l77ui6z9f2.execute-api.us-east-1.amazonaws.com/Prod |
| **Health check** | https://l77ui6z9f2.execute-api.us-east-1.amazonaws.com/Prod/api/v1/health |
 
---
 
## 📂 Estructura del repositorio
 
```
.
├── webAvalBack/          Backend — AWS Lambda, API Gateway, DynamoDB, S3
│   └── README.md         Arquitectura, API, decisiones, testing, despliegue
│
├── webAvalFront/          Frontend — React + Module Federation
│   ├── README.md          Arquitectura, vistas, testing, despliegue
│   └── aprobador/         Microfrontend remoto (vista de aprobación)
│
└── openapi.yaml             Contrato OpenAPI de la API (para importar en Swagger Editor / Postman)
```
 
Cada carpeta principal (`webAvalBack/`, `webAvalFront/`) tiene su propio README con el detalle completo: arquitectura, decisiones de diseño, cómo instalar y correr el proyecto, cómo desplegarlo, cobertura de tests, y una sección honesta de los problemas reales que aparecieron durante el desarrollo y cómo se resolvieron. Este documento es solo el punto de entrada.
 
---
 
## 🧭 Qué hace la aplicación
 
Un solicitante crea una solicitud de compra (título, descripción, monto) y elige 3 aprobadores con roles distintos. Cada aprobador recibe un link único, se verifica con un código de un solo uso (OTP), y decide si aprueba o rechaza. Cada aprobación queda encadenada criptográficamente con la anterior (hash chain), de forma que cualquier alteración posterior de los datos es detectable. Cuando los 3 aprobadores firman, se genera automáticamente un PDF de evidencia con el detalle completo y las firmas, almacenado de forma privada y accesible solo mediante una URL temporal.
 
---
 
## 🛠️ Resumen técnico
 
| | Backend | Frontend |
|---|---|---|
| Stack | Node.js, AWS Lambda, API Gateway, DynamoDB, S3, SAM | React 19, webpack 5 + Module Federation |
| Arquitectura | Por capas (`domain` / `application` / `infrastructure` / `handlers`), dominio aislado de AWS | Host + remote independientes, comunicados en tiempo de ejecución |
| Seguridad | Hash chain SHA-256, OTP con límites de intentos/generaciones, token de firma de un solo uso, TransactWriteCommand para atomicidad | — |
| Testing | Jest — 101 tests, cobertura ≥76% en las 4 métricas | Jest + React Testing Library — 20 tests, cobertura ≥72% en ambos proyectos |
| Despliegue | SAM (CloudFormation) | S3 + CloudFront (SAM) |
 
---
 
## 📸 Capturas de pantalla
 
**Crear solicitud**
![Formulario de creación de solicitud](./capturas/01-crear-solicitud.png)
 
**Solicitud creada**
![Confirmación de solicitud creada](./capturas/02-solicitud-creada.png)
 
**Vista del aprobador 1 — formulario**
![Pantalla inicial del primer aprobador](./capturas/03-aprobador-1-form.png)
 
**Vista del aprobador 1 — código OTP**
![Ingreso de código OTP del primer aprobador](./capturas/04-aprobador-1-codigo.png)
 
**Vista del aprobador 1 — estado de la solicitud**
![Detalle de la solicitud visto por el primer aprobador](./capturas/05-aprobador-1-estado-solicitud.png)
 
**Vista del aprobador 1 — firma registrada**
![Confirmación de firma registrada del primer aprobador](./capturas/06-aprobador-1-firma-registrada.png)
 
**Vista del aprobador 2 — formulario**
![Pantalla inicial del segundo aprobador](./capturas/07-aprobador-2-form.png)
 
**Vista del aprobador 2 — código OTP**
![Ingreso de código OTP del segundo aprobador](./capturas/08-aprobador-2-codigo.png)
 
**Vista del aprobador 2 — estado de la solicitud**
![Detalle de la solicitud visto por el segundo aprobador](./capturas/09-aprobador-2-estado-solicitud.png)
 
**Vista del aprobador 2 — firma registrada**
![Confirmación de firma registrada del segundo aprobador](./capturas/10-aprobador-2-firma-registrada.png)
 
**Vista del aprobador 3 — código OTP**
![Ingreso de código OTP del tercer aprobador](./capturas/11-aprobador-3-codigo.png)
 
**Vista del aprobador 3 — estado de la solicitud**
![Detalle de la solicitud visto por el tercer aprobador](./capturas/12-aprobador-3-estado-solicitud.png)
 
**Vista del aprobador 3 — firma registrada (solicitud completada)**
![Confirmación de firma registrada del tercer aprobador, con la solicitud ya completada](./capturas/13-aprobador-3-firma-registrada-COMPLETADA.png)
 
**Panel del solicitante**
![Panel del solicitante](./capturas/14-panel-solicitante.png)
 
**Consulta en el panel del solicitante**
![Búsqueda de solicitudes en el panel](./capturas/15-consulta-panel-solicitante.png)
 
**Detalle desde el panel del solicitante**
![Detalle de la solicitud completada, con el botón de descarga de PDF](./capturas/16-detalle-panel-solicitante.png)
 
**PDF de evidencia generado**
![PDF de evidencia con las 3 firmas y sus hashes encadenados](./capturas/17-pdf-de-solicitud.png)
 
---
 
## 📖 Dónde seguir leyendo
 
- **[`webAvalBack/README.md`](./webAvalBack/README.md)** — la documentación completa del backend: los 9 endpoints, el modelo de datos, cómo se implementó la firma concatenada, las decisiones de seguridad, cómo correr los tests, y los problemas reales que se fueron encontrando y corrigiendo por el camino.
- **[`webAvalFront/README.md`](./webAvalFront/README.md)** — lo mismo para el frontend: por qué se dividió en host y remote, las vistas, el testing, el despliegue, y una lista honesta de los tropiezos de configuración (Babel, Module Federation, CORS) que costó bastante diagnosticar.
- **[`openapi.yaml`](./openapi.yaml)** — el contrato de la API en formato OpenAPI, listo para importar en Swagger Editor o Postman.