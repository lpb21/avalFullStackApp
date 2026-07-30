# Frontend — Flujo de Aprobaciones con Firma Digital Concatenada
 
Este es el frontend de la Prueba Técnica Fullstack Senior para AVAL Asset Management: una aplicación en React, dividida en dos microfrontends que se comunican con Module Federation, que consume el backend serverless documentado en `backend/README.md`.
 
---
 
## 📋 Contenido
 
1. [Arquitectura](#-arquitectura)
2. [Stack tecnológico](#-stack-tecnológico)
3. [Instalación y ejecución](#-instalación-y-ejecución)
4. [Vistas implementadas](#-vistas-implementadas)
5. [Decisiones y supuestos](#-decisiones-y-supuestos)
6. [Testing](#-testing)
7. [Despliegue](#-despliegue)
8. [Cómo probar el flujo completo](#-cómo-probar-el-flujo-completo)
9. [Lo que aprendimos por el camino](#-lo-que-aprendimos-por-el-camino)
10. [Mejoras propuestas](#-mejoras-propuestas)
---
 
## 🏗️ Arquitectura
 
El frontend se divide en un **host** y un **remote**, comunicados con **Module Federation** (nativo de webpack 5, sin ningún paquete adicional). Cada uno es un proyecto Node independiente, con su propio `package.json` y su propio ciclo de build.
 
```
frontend/
├── (host — "shell")
│   package.json
│   webpack.config.js          → consume el remote "aprobador"
│   babel.config.json
│   src/
│     index.js                 → import("./bootstrap") — solo esto
│     bootstrap.js             → aquí sí vive el arranque real de React
│     App.jsx                  → rutas + carga del remote
│     services/api.js          → cliente axios hacia el backend
│     pages/
│       CrearSolicitud.jsx
│       PanelSolicitante.jsx
│       DetalleSolicitud.jsx
│
└── aprobador/ (remote)
    package.json
    webpack.config.js          → expone su App.jsx hacia el host
    babel.config.json
    src/
      index.js
      bootstrap.js
      App.jsx                  → cargando → otp → detalle → resultado
      services/api.js
```
 
**¿Por qué separar el host del remote así?** Porque son dos mundos distintos con formas de acceso distintas. El host es el "mundo del solicitante": tiene navegación, crea solicitudes, hace seguimiento. El remote es el "mundo del aprobador": no tiene navegación propia, se llega a él únicamente por el link que trae el correo de aprobación, con los datos necesarios en la URL. Es la frontera más natural que había en el sistema, y de paso deja abierta la puerta a que en un escenario real cada parte se despliegue y evolucione por su cuenta.
 
### Cómo se cargan uno al otro en tiempo real
 
```
┌─────────────────────────┐        ┌──────────────────────────┐
│   HOST                    │        │  REMOTE "aprobador"       │
│                          │        │                           │
│  App.jsx                 │        │                           │
│    lazy(() =>            │──────▶ │  remoteEntry.js           │
│      import(             │        │  (el "menú" de qué        │
│      "aprobador/App"))   │◀────── │   expone el remote)       │
│                          │        │                           │
│  React + ReactDOM        │◀──────▶│  React + ReactDOM         │
│  (compartidos, una       │        │  (compartidos, una        │
│   sola instancia)        │        │   sola instancia)         │
└─────────────────────────┘        └──────────────────────────┘
```
 
---
 
## 🛠️ Stack tecnológico
 
| Área | Tecnología | Nota |
|---|---|---|
| UI | React 19.2.8 | El enunciado pedía "17+"; usamos la más reciente disponible |
| Routing | React Router 7 (solo en el host) | El remote es una sola pantalla con estados internos, no necesita rutas |
| Cliente HTTP | axios | Una instancia por proyecto, apuntando al mismo backend |
| Build | webpack 5 + Module Federation | Module Federation ya viene incluido en webpack, no hace falta instalar nada extra |
| Transpilación | Babel 7 | Ver la sección de aprendizajes — Babel 8 dio bastante guerra |
| Testing | Jest + React Testing Library | Cobertura por encima del 60% en ambos proyectos |
 
---
 
## 🚀 Instalación y ejecución
 
### Lo que necesitas antes
- Node.js 18 o superior (se desarrolló con Node 22-24)
- Que el backend esté desplegado y accesible (ver `backend/README.md`) — la URL base está en `src/services/api.js` de cada proyecto
### Host
 
```bash
cd frontend
npm install
npm run start     # http://localhost:3001
```
 
### Remote (en otra terminal, al mismo tiempo)
 
```bash
cd frontend/aprobador
npm install
npm run start     # http://localhost:3002
```
 
**Los dos tienen que estar corriendo a la vez** para que el host pueda cargar la vista de aprobación — si el remote no está levantado, el host sigue funcionando para todo lo demás, pero la carga del componente remoto falla.
 
### Build de producción
 
```bash
NODE_ENV=production npm run build   # en cada proyecto por separado
```
 
El `NODE_ENV=production` es importante: activa el `publicPath` correcto para el remote y la URL de producción con la que el host busca al remote (en desarrollo usan `localhost` con puertos distintos; en producción, rutas relativas al mismo dominio).
 
---
 
## 📄 Vistas implementadas
 
| Vista | Dónde vive | Ruta | Qué hace |
|---|---|---|---|
| Crear Solicitud | Host | `/` | El formulario de creación: título, descripción, monto, datos del solicitante, y 3 aprobadores con su rol (elegido de una lista, no escrito libre) |
| Panel del Solicitante | Host | `/panel` | Buscas por tu email y ves tus solicitudes, con el estado de cada una y cuántos aprobadores ya firmaron |
| Detalle de Solicitud | Host | `/solicitudes/:id` | El detalle completo, el estado de cada aprobador, y el botón de descarga del PDF cuando la solicitud ya está completada |
| Vista del Aprobador | Remote | (se llega por el link del correo, no por navegación) | OTP → detalle de la compra → Aprobar o Rechazar → resultado |
 
---
 
## 📌 Decisiones y supuestos
 
- **Un host y un solo remote**, no dos remotes separados. El panel del solicitante y el shell comparten el mismo flujo de navegación; separarlos habría sido complicar algo que no lo necesitaba.
- **El remote no usa React Router.** Siempre se llega a él por un link externo con parámetros en la URL (`solicitud_id`, `approver_token`), que se leen directamente con `URLSearchParams`. Toda la navegación interna (OTP → detalle → resultado) es simplemente un estado dentro del mismo componente.
- **La descarga del PDF es un `<a href>` normal, no una llamada de axios.** El endpoint de evidencia responde con una redirección (302) a una URL temporal de S3. Un link normal deja que el navegador siga esa redirección solo; hacerlo con axios habría significado manejar el header de redirección a mano, sin ganar nada.
- **Los roles de los aprobadores se eligen de un `<select>`**, no se escriben. Así evitamos desde el frontend el mismo problema que ya habíamos resuelto en el backend: que dos roles "distintos" en realidad sean el mismo texto con mayúsculas o espacios distintos.
- **Cada proyecto tiene su propia copia de `services/api.js`.** Son dos proyectos independientes que no comparten `node_modules` ni código; duplicar un archivo de pocas líneas es más simple que meter un paquete compartido solo para esto.
---
 
## 🧪 Testing
 
```bash
npm test              # correr los tests
npm run test:coverage # con reporte de cobertura
```
(Los mismos comandos funcionan en `frontend/` y en `frontend/aprobador/` — cada proyecto tiene su propia configuración de Jest.)
 
**Host:** 93.3% de sentencias, 84.4% de ramas, 89.5% de funciones, 95.1% de líneas cubiertas — 15 tests repartidos en 4 archivos (`App`, `CrearSolicitud`, `PanelSolicitante`, `DetalleSolicitud`).
 
**Remote:** 91.2% de sentencias, 72.2% de ramas, 92.9% de funciones, 90.8% de líneas — 5 tests que recorren los 4 estados del flujo del aprobador: link inválido, token inválido, verificación de OTP, y firma completa (verificando incluso que el header `X-Firma-Token` se envía con el valor correcto).
 
Ambos quedan bien por encima del 60% que exige el proyecto.
 
**Un par de cosas interesantes de cómo probamos esto:**
- Para testear el host sin depender de que el remote esté corriendo, usamos `jest.mock("aprobador/App", ..., { virtual: true })` — le decimos a Jest que confíe en que ese módulo existe, aunque solo Module Federation sepa resolverlo en tiempo real.
- El test de la firma en el remote no solo revisa que el resultado sea el esperado: también verifica que la llamada HTTP llevó el header correcto. Es la forma de confirmar, sin tener que probarlo a mano cada vez, que el token de firma viaja como debe.
---
 
## 🌐 Despliegue
 
El frontend está desplegado en AWS con **S3 + CloudFront**: un solo bucket privado y una sola distribución de CloudFront sirven tanto el host (en la raíz) como el remote (bajo `/aprobador/`). El bucket nunca es accesible directamente — todo el tráfico pasa por CloudFront, que es quien tiene permiso de leerlo (vía Origin Access Control).
 
- **Frontend:** https://d17ikmoptxcbe1.cloudfront.net
- **Backend (API):** https://l77ui6z9f2.execute-api.us-east-1.amazonaws.com/Prod
La infraestructura está descrita en `template.yaml` (SAM) en la raíz del proyecto, y se despliega igual que el backend:
 
```bash
sam build
sam deploy --guided   # primera vez
sam deploy            # las siguientes
```
 
Después de crear la infraestructura, cada build se sube con:
 
```bash
NODE_ENV=production npm run build   # en frontend/
aws s3 sync dist/ s3://<bucket>/ --delete
 
cd aprobador
NODE_ENV=production npm run build
aws s3 sync dist/ s3://<bucket>/aprobador/ --delete
```
 
Una decisión que vale la pena explicar: las rutas de React Router (como `/panel` o `/solicitudes/:id`) no existen como archivos reales en S3 — es React quien las resuelve del lado del navegador. Por eso la distribución de CloudFront está configurada para responder cualquier 403 o 404 sirviendo `index.html` de todas formas, dejando que React tome el control desde ahí. Sin eso, recargar la página estando en `/panel` daría un error en vez de la vista esperada.
 
---
 
## 🔄 Cómo probar el flujo completo
 
1. Abre el frontend, completa el formulario de "Crear solicitud" con 3 aprobadores y roles distintos.
2. Ve al panel, busca con el email que usaste como solicitante, y confirma que la solicitud aparece ahí.
3. Consulta `GET /api/v1/mock-mail` en el backend para ver los correos simulados. Ahí vas a encontrar, para cada aprobador, un cuerpo de correo con un link de aprobación — pero **ese link apunta directo al backend** (algo como `https://l77ui6z9f2.execute-api.../api/v1/approve?solicitud_id=...&approver_token=...`), no a esta interfaz. Es un detalle conocido, explicado más abajo.
4. De ese link, toma solo los dos valores que trae en la URL — `solicitud_id` y `approver_token` — y arma tú mismo la dirección de la vista de aprobador, reemplazándolos aquí:
```
   https://d17ikmoptxcbe1.cloudfront.net/aprobador/?solicitud_id=<SOLICITUD_ID>&approver_token=<APPROVER_TOKEN>
```
 
   (En desarrollo, usa `http://localhost:3002/?solicitud_id=...&approver_token=...` en su lugar.)
5. Abre esa URL — se te va a pedir un código de verificación, que se generó (o reutilizó) automáticamente al entrar.
6. Vuelve a consultar `/mock-mail` para conseguir el código, ingrésalo, y verifica.
7. En la pantalla de detalle, decide: Aprobar o Rechazar.
8. Repite los pasos 3 a 7 para el segundo y el tercer aprobador. Al firmar el tercero, la solicitud queda completada.
9. Vuelve al detalle desde el panel — ya debería verse el estado `COMPLETADA` y el botón para descargar el PDF de evidencia.
 
Este recorrido se probó completo, paso a paso, tanto en desarrollo como ya desplegado en AWS.
 
### Sobre el link que trae el correo simulado
 
El correo simulado lo genera el backend, y el link que arma apunta a su propia URL (el endpoint `/api/v1/approve`), no a la del frontend — porque el backend no tiene forma de saber, por sí solo, en qué dominio vive la interfaz que lo consume. Para esta prueba se dejó así intencionalmente, documentado como una limitación conocida en vez de resuelto a medias: la corrección natural sería que el backend conociera la URL del frontend (por ejemplo, vía una variable de entorno) y armara el link ya apuntando ahí directamente, de forma que abrir el correo lleve a la pantalla sin ningún paso manual. Queda anotado en las mejoras propuestas.
 
---
 
## 🔍 Lo que aprendimos por el camino
 
Vale la pena dejar esto anotado con honestidad, porque varios de estos problemas costaron bastante más tiempo diagnosticarlos que arreglarlos, y son el tipo de cosas que uno solo aprende tropezando con ellas.
 
**Babel 8 no estaba listo para esto.** La primera instalación trajo `@babel/core` en su versión 8, una versión muy reciente que todavía no termina de encajar bien con el resto del ecosistema. El síntoma era que ningún `import`/`export` se transformaba, sin importar qué configuración le pusiéramos. La solución fue bajar a Babel 7, que es la que todo el mundo usa y con la que todo está probado.
 
**`.babelrc` no se estaba resolviendo de forma confiable.** Lo cambiamos por `babel.config.json`, que aplica su configuración a todo el proyecto de forma más predecible, sin depender de en qué carpeta exacta lo detecte Babel.
 
**El `package.json` decía "commonjs" y Babel quería portarse como si fuera ES modules.** Con `"type": "commonjs"` declarado, webpack exige `require()`; pero Babel, en su modo automático, decidía no tocar los `import`/`export` porque asumía que el entorno ya los soportaba. Dos supuestos razonables por separado, que chocaban entre sí. Se resolvió diciéndole a webpack que tratara esos archivos como módulos automáticamente (sin fijarse en lo que dijera el `package.json`), y a Babel que no tocara el sistema de módulos en absoluto — dejando que cada uno hiciera solo lo que le correspondía.
 
**React 19 ya no perdona los componentes sin `import React`.** Hacía falta activar explícitamente el "runtime automático" de JSX en Babel; de otra forma, cualquier componente con JSX fallaba con `React is not defined`.
 
**Module Federation exige un punto de entrada que solo haga un import asíncrono.** Si el `index.js` importa React directamente y de forma síncrona, Module Federation no alcanza a negociar qué versión compartida de React usar antes de que ese código se ejecute, y todo revienta con un error bastante críptico. La solución conocida: `index.js` solo hace `import("./bootstrap")`, y el código real vive en `bootstrap.js`.
 
**El servidor de desarrollo bloqueaba sus propios archivos entre puertos distintos.** `webpack-dev-server` manda por defecto un header de seguridad que restringe el uso de sus archivos al mismo origen exacto. Como el host y el remote corren en puertos distintos, el navegador los trataba como orígenes distintos y bloqueaba la carga del remote — aunque el archivo existiera y respondiera perfecto por `curl`. Se resolvió configurando ese header explícitamente para permitir el acceso cruzado, algo que solo hace falta en desarrollo.
 
**El backend nunca había sido probado desde un navegador real.** Todas las pruebas anteriores se habían hecho con `curl`, que no aplica ninguna política de CORS — por eso el problema quedó invisible hasta la primera vez que el frontend intentó hablar con la API. El navegador manda una petición previa de verificación antes de cualquier POST, y el backend no la estaba respondiendo con los permisos correctos. Se corrigió configurando CORS explícitamente en el API Gateway del backend.
 
**Jest necesitaba una configuración de Babel distinta a la de webpack, en el mismo archivo.** Lo que hacía funcionar el build de producción rompía los tests, porque Jest corre sobre Node puro y necesita que los módulos se transformen de verdad. Se resolvió con una sección de configuración que Babel activa solo cuando detecta que está corriendo bajo Jest.
 
**El entorno de pruebas no traía dos funciones que React Router necesita.** Sin ellas, cualquier test que usara `react-router-dom` fallaba de entrada. Se agregaron con un pequeño archivo de configuración que carga antes de que arranque el entorno de pruebas.
 
---
 
## 🔭 Mejoras propuestas
 
- **Que el correo simulado enlace directo al frontend**, no al backend. Hoy hay que tomar el `solicitud_id` y el `approver_token` del link que trae el correo y armar la URL de la vista de aprobador a mano (ver la sección de arriba). La corrección natural es que el backend conozca la URL del frontend (por ejemplo, vía variable de entorno) y construya el link ya apuntando ahí, para que abrir el correo lleve directo a la pantalla, sin ningún paso manual de por medio.
- **Mover la URL del backend a una variable de entorno**, en vez de tenerla fija en el código — así se podría apuntar a distintos entornos (desarrollo, pruebas, producción) sin tocar el código fuente.
- **Un visor del correo simulado dentro del frontend.** Hoy hay que consultar el endpoint de mock-mail directamente para conseguir los códigos y los links; una vista simple lo mostraría sin salir de la aplicación.
- **Un contador visible de cuánto tiempo queda** antes de que expire el código OTP o el permiso de firma, en vez de que el usuario solo se entere al recibir un error.
- **Restringir el acceso entre orígenes a un dominio específico**, en vez de permitir cualquiera, tanto en el backend como en el servidor de desarrollo del remote.