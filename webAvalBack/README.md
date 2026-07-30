# Backend — Flujo de Aprobaciones con Firma Digital Concatenada
 
Backend serverless (AWS Lambda + API Gateway + DynamoDB + S3) para la Prueba Técnica Fullstack Senior de AVAL Asset Management. Implementa un flujo de aprobación de solicitudes de compra con firma digital concatenada (hash chain), verificación OTP y generación de evidencia en PDF.
 
---
 
## 📋 Tabla de contenidos
 
1. [Arquitectura](#-arquitectura)
2. [Stack tecnológico](#-stack-tecnológico)
3. [Instalación y despliegue](#-instalación-y-despliegue)
4. [Documentación de la API](#-documentación-de-la-api)
5. [Supuestos y decisiones de arquitectura](#-supuestos-y-decisiones-de-arquitectura)
6. [Mejoras implementadas](#-mejoras-implementadas)
7. [Mejoras propuestas](#-mejoras-propuestas-no-implementadas)
8. [Testing](#-testing)
9. [URLs de despliegue](#-urls-de-despliegue)
10. [Cómo probar el flujo completo](#-cómo-probar-el-flujo-completo)
11. [Lecciones aprendidas / hallazgos técnicos](#-lecciones-aprendidas--hallazgos-técnicos)
---
 
## 🏗️ Arquitectura
 
Arquitectura por capas con **dominio aislado de AWS** (no es hexagonal estricta, es una decisión propia por simplicidad, manteniendo el principio de separación de responsabilidades que pide el enunciado):
 
```
src/
├── domain/              # Lógica de negocio pura. CERO dependencias de AWS.
│   ├── maquinaEstados.js    # Validación de turno y transiciones de estado
│   ├── hashChain.js         # Firma digital concatenada (hash chain SHA-256)
│   ├── otp.js                # Generación, hash y decisión de OTP (reutilizar/generar/bloquear)
│   ├── validacionSolicitud.js
│   └── mailer.js             # Construcción del contenido de correos simulados
│
├── application/         # Casos de uso. Orquestan domain/ + infrastructure/
│   ├── crearSolicitud.js
│   ├── resolverAprobacion.js
│   ├── verificarOtp.js
│   ├── firmarSolicitud.js
│   ├── obtenerEvidenciaPdf.js
│   ├── listarSolicitudes.js
│   ├── obtenerDetalleSolicitud.js
│   └── listarMockMails.js
│
├── infrastructure/       # Adaptadores a AWS (DynamoDB, S3, PDF)
│   ├── dynamoClient.js
│   ├── pdfGenerator.js
│   └── repositories/
│       ├── solicitudesRepository.js
│       ├── aprobadoresRepository.js
│       ├── otpsRepository.js
│       ├── sessionTokensRepository.js
│       ├── mockMailsRepository.js
│       ├── pdfStorageRepository.js
│       └── transaccionesRepository.js
│
└── handlers/             # Adaptadores Lambda (API Gateway ↔ casos de uso)
    ├── health.js
    ├── solicitudes.js
    ├── mockMail.js
    ├── approve.js
    ├── otp.js
    ├── firmar.js
    ├── evidencia.js
    ├── detalleSolicitud.js
    └── httpHelper.js         # Helper compartido de respuestas HTTP + CORS
```
 
**Regla de la arquitectura:** `domain/` nunca importa nada de AWS ni de `infrastructure/`. Esto permite testear toda la lógica de negocio crítica (máquina de estados, hash chain, decisión de OTP) sin mocks de ningún tipo — ver sección [Testing](#-testing).
 
### Diagrama de componentes
 
```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              API Gateway (REST, prefijo /api/v1, explícito)      │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS Lambda (Node.js 22.x)                   │
│   handlers/  →  application/  →  domain/ + infrastructure/        │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
       │  DynamoDB   │ │      S3     │ │  CloudWatch │
       │ 4 tablas    │ │  PDFs       │ │    Logs     │
       └─────────────┘ └─────────────┘ └─────────────┘
```
 
---
 
## 🛠️ Stack tecnológico
 
| Área | Tecnología | Justificación |
|---|---|---|
| Runtime | Node.js 22.x (JavaScript puro) | AWS Lambda no ofrece runtime de Node 24 aún; JS puro por eficiencia de tiempo |
| IaC / Despliegue | AWS SAM | Nativo AWS, `sam local` permite probar Lambdas sin desplegar, ciclo build/deploy reproducible |
| Base de datos | DynamoDB (multi-tabla) | Ver justificación detallada en [Supuestos](#-supuestos-y-decisiones-de-arquitectura) |
| Almacenamiento de PDFs | S3 (bucket privado) | Acceso exclusivamente vía URL prefirmada, nunca público |
| Generación de PDF | pdf-lib | Construcción de documentos en memoria, adecuado para Lambda |
| Pruebas | Jest + aws-sdk-client-mock | Cobertura ≥60% verificada (ver [Testing](#-testing)) |
| Build de Lambdas | esbuild (vía SAM) | AWS SDK marcado como *external* (ya viene en el runtime de Lambda) |
 
---
 
## 🚀 Instalación y despliegue
 
### Requisitos previos
 
- **Node.js 22+** (recomendado usar el mismo major que el runtime de Lambda)
- **Docker** (para `sam build --use-container` y `sam local`)
- **AWS SAM CLI** ([instalación](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- **AWS CLI** configurado con un usuario IAM (`aws configure`) con permisos para crear Lambda, DynamoDB, S3, API Gateway, IAM Roles y CloudFormation
> **Nota de entorno:** este proyecto se desarrolló en WSL2/Ubuntu, no en Windows nativo. Se recomienda el mismo entorno para evitar incompatibilidades de binarios nativos (p. ej. `esbuild` instala un binario específico por plataforma).
 
### Instalación de dependencias
 
```bash
cd backend
npm install
```
 
`dependencies` (viajan en el bundle de producción): `pdf-lib`.
`devDependencies` (el AWS SDK v3 se marca *external* en el build porque ya viene preinstalado en el runtime de Lambda — no se empaqueta, se usa solo en desarrollo/tests): `@aws-sdk/*`, `jest`, `aws-sdk-client-mock`, `aws-sdk-client-mock-jest`, `eslint`, `prettier`, `esbuild`.
 
### Build y despliegue
 
```bash
# Construir dentro de un contenedor idéntico al runtime real de Lambda
sam build --use-container
 
# Primera vez: modo guiado (crea samconfig.toml)
sam deploy --guided
 
# Despliegues posteriores
sam deploy
```
 
Al finalizar, `sam deploy` muestra automáticamente los **Outputs** con la URL base de la API y el endpoint de health check (declarados explícitamente en la sección `Outputs:` del `template.yaml`).
 
### Probar en local (antes de desplegar)
 
```bash
sam local start-api
# En otra terminal:
curl http://127.0.0.1:3000/api/v1/health
```
 
---
 
## 📝 Documentación de la API
 
El contrato completo está en **`openapi.yaml`** (OpenAPI 3.0), incluyendo request/response schemas, códigos de error y el security scheme del header `X-Firma-Token`. Se puede visualizar en [Swagger Editor](https://editor.swagger.io/) pegando el contenido del archivo.
 
### Endpoints (prefijo `/api/v1`)
 
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/solicitudes` | Crear solicitud de compra (3 aprobadores) |
| GET | `/solicitudes?solicitante_email=` | Listar solicitudes de un solicitante, con resumen de aprobadores |
| GET | `/solicitudes/{solicitud_id}` | Detalle de una solicitud + estado de sus aprobadores |
| GET | `/approve?solicitud_id=&approver_token=` | Resolver token del aprobador, generar/reutilizar OTP |
| POST | `/otp/verify` | Validar OTP (requiere `approver_token`), emite `firma_token` de un solo uso |
| POST | `/solicitudes/{solicitud_id}/aprobadores/{orden}/firmar` | Aprobar/Rechazar (header `X-Firma-Token`) |
| GET | `/solicitudes/{solicitud_id}/evidencia.pdf` | Redirige (302) a URL prefirmada del PDF en S3 |
| GET | `/mock-mail` | Lista de correos simulados enviados |
 
---
 
## 📌 Supuestos y decisiones de arquitectura
 
### 1. Modelo DynamoDB: Multi-tabla
 
**Justificación:** siendo el primer proyecto con DynamoDB, se optó por multi-tabla por claridad y menor curva de aprendizaje. Los patrones de acceso son simples y directos (`GetItem` por PK, `Query` por PK+SK, lookup por GSI) — no hay accesos que requieran combinar entidades heterogéneas en una sola consulta, que es donde single-table design aporta más valor. Se documenta single-table como evolución para escala masiva (ver [Mejoras propuestas](#-mejoras-propuestas-no-implementadas)).
 
**Tablas:**
 
| Tabla | PK | SK | GSI | TTL |
|---|---|---|---|---|
| `Solicitudes` | `solicitud_id` | — | `gsi_solicitante_email` | — |
| `Aprobadores` | `solicitud_id` | `orden` (1-3) | `gsi_token` | — |
| `OTPs` | `solicitud_id` | `orden` | — | `expira_en` (limpieza) |
| `SessionTokens` | `firma_token` | — | — | `expira_en` (limpieza) |
| `MockMails` | `mail_id` | — | — | — |
 
`orden` se usa como SK en `Aprobadores` (no el email) para: (1) proteger PII, no usarla como clave; (2) que `Query` devuelva los aprobadores ya ordenados por turno de firma, sin reordenar en código; (3) permitir que un mismo email tenga distintos roles en distintas solicitudes.
 
### 2. Firma Digital Concatenada (Hash Chain)
 
Cada firma incluye el hash de la firma anterior, formando una cadena inmutable:
 
```
hash_firma_N = SHA256(datosSolicitud_canonico + hashAnterior + nombre_N + timestamp_N)
```
 
- **Bloque génesis** (aprobador orden 1): `hashAnterior = SHA256(datosSolicitud_canonico + "GENESIS")`.
- **Serialización canónica**: los datos de la solicitud se serializan con orden de campos fijo (no se serializa directo el ítem leído de DynamoDB, que no garantiza orden de atributos).
- **Verificación**: `verificarCadena()` recalcula la cadena completa desde los datos almacenados; si algún dato fue alterado, el hash correspondiente deja de coincidir y todos los posteriores también fallan — la manipulación es matemáticamente detectable.
- **Orden de firma:** secuencial (1 → 2 → 3), validado en `domain/maquinaEstados.js` antes de permitir cualquier acción.
### 3. Seguridad del flujo OTP
 
- **`approver_token` obligatorio en `/otp/verify`**: se valida contra el GSI de `Aprobadores` **antes** de comparar el código OTP. Esto evita que un tercero ataque el factor débil (OTP de 6 dígitos, ~20 bits de entropía) sin poseer el link del aprobador (`approver_token`, UUID v4, ~122 bits de entropía) — corrige un hallazgo de seguridad detectado durante el desarrollo (ver [Lecciones aprendidas](#-lecciones-aprendidas--hallazgos-técnicos)).
- **`firma_token` de un solo uso**: emitido por `/otp/verify`, requerido en el header `X-Firma-Token` para `/firmar`. Se invalida con `ConditionExpression: usado = false` (garantiza uso único incluso ante condiciones de carrera). Se eligió una tabla DynamoDB en vez de JWT stateless precisamente porque un token de un solo uso requiere invalidación explícita tras su consumo.
- **TTL vs. validación real**: el TTL de DynamoDB en `OTPs` y `SessionTokens` es **solo limpieza automática** — el borrado por TTL no es inmediato (puede tardar minutos u horas). La validez real siempre se valida en código comparando `expira_en` (epoch en **segundos**) contra el tiempo actual.
- **Límite de intentos vs. generaciones**: máx. 3 intentos fallidos por OTP; al regenerar un OTP, `intentos` se reinicia a 0 (tope efectivo: 9 intentos). El límite duro real es el de **generaciones** (máx. 3 por aprobador) — al agotarlas, el aprobador queda bloqueado (429), y ese es el límite anti-fuerza-bruta genuino.
- **Deadlock resuelto**: un OTP con intentos agotados (`intentos >= 3`) se trata como "no vigente" y se regenera consumiendo una generación, en vez de bloquear al usuario legítimo con un código inservible durante 3 minutos. La razón de fondo: si se reutilizara ese OTP agotado, el aprobador recibiría un `200` ("usa el OTP enviado") sobre un código que de todas formas devuelve `429` en cualquier intento — quedaría bloqueado sin explicación hasta que expirara el TTL. Al tratarlo como agotado, el único bloqueo real y explicable es el de las 3 generaciones. Ver `domain/otp.js::decidirAccionOtp`.
### 4. Máquina de estados
 
```
PENDIENTE → (3 firmas) → FIRMAS_COMPLETAS → (PDF generado con éxito) → COMPLETADA
PENDIENTE → (cualquier rechazo) → RECHAZADA
```
 
`FIRMAS_COMPLETAS` es un estado transitorio deliberado: las 3 firmas están registradas, pero el PDF aún no. Solo si la generación y subida del PDF a S3 tienen éxito, la solicitud pasa a `COMPLETADA` con su `pdf_key`. Si el PDF falla, la solicitud permanece en `FIRMAS_COMPLETAS` (nunca queda `COMPLETADA` sin evidencia), y la firma en sí ya quedó registrada correctamente. Este comportamiento está probado tanto en tests automatizados como observado en producción real (ver [Lecciones aprendidas](#-lecciones-aprendidas--hallazgos-técnicos)).
 
### 5. Integridad con escrituras condicionales
 
Todas las transiciones de estado críticas usan `ConditionExpression` de DynamoDB para prevenir condiciones de carrera:
 
- Firmar/rechazar: solo si `estado_firma = PENDIENTE`.
- Consumir `firma_token`: solo si `usado = false`.
- Incrementar generaciones de OTP: solo si `num_otp_generados < 3`.
- Incrementar intentos de OTP: solo si `intentos < 3`.
- Transición de estado de la Solicitud: solo si el estado previo es el esperado.
### 6. Monto
 
Se maneja como número entero (pesos colombianos, sin decimales). Si se requirieran decimales, se recomienda usar centavos (entero) o un string validado, para evitar problemas de precisión de punto flotante.
 
---
 
## ✅ Mejoras implementadas
 
Decisiones que van más allá del alcance mínimo del enunciado:
 
- **Versionado de API** (`/api/v1/...`): todos los endpoints van bajo un prefijo versionado explícito, permitiendo evolucionar el contrato (`/api/v2/`) sin romper clientes existentes.
- **Escritura atómica en creación de solicitud** (`TransactWriteCommand`): la solicitud y sus 3 aprobadores se crean en una única transacción DynamoDB — o se crean los 4 ítems, o ninguno. Evita el estado parcial que ocurriría con escrituras secuenciales si una fallara a mitad de camino (por ejemplo, un timeout de red creando el 3er aprobador).
---
 
## 🔭 Mejoras propuestas (no implementadas)
 
El enunciado premia argumentar mejoras en términos de escalabilidad, seguridad, UX y mantenibilidad:
 
- **Autenticación real**: hoy `GET /solicitudes?solicitante_email=` lista por email sin autenticación — cualquiera con un email vería esas solicitudes. Se propone Amazon Cognito o JWT con autorización por propietario.
- **Single-table design**: migrar las 5 tablas a una sola con PK/SK compuestas y GSIs, para escala masiva y menos round-trips.
- **Orquestación con Step Functions**: coordinar firma → generación de PDF → cierre con reintentos automáticos ante fallo, en vez del manejo de errores actual dentro del caso de uso.
- **Desbloqueo de aprobador**: hoy, al agotar las 3 generaciones de OTP, el bloqueo es permanente (sin flujo de desbloqueo). Se propone un mecanismo de reenvío por el solicitante o expiración temporal del bloqueo.
- **Rate limiting / WAF en API Gateway**: proteger los endpoints públicos ante abuso.
- **Vigencia del link de aprobación**: el `approver_token` es un UUID sin expiración — el link sigue siendo válido indefinidamente mientras la solicitud esté `PENDIENTE`. Se asume aceptable porque el acceso real está protegido por el OTP y por la validación de turno; como mejora se propone darle vigencia (por ejemplo, 7 días) con reenvío bajo demanda, para reducir la ventana de exposición si el correo llegara a filtrarse.
- **Notificaciones reales**: reemplazar el mock-mail por Amazon SES u otro proveedor SMTP.
- **Helper de respuestas ya extraído** (`httpHelper.js`): se refactorizó la duplicación original de `HEADERS_CORS` en cada handler hacia un módulo compartido — se documenta aquí porque fue una mejora aplicada durante el desarrollo, no parte del diseño original.
---
 
## 🧪 Testing
 
```bash
npm test              # correr todos los tests
npm run test:coverage # correr con reporte de cobertura
npm run test:watch    # modo watch
```
 
**Cobertura actual:** 76.9% statements · 79.3% branches · 71.9% functions · 76.8% lines (umbral configurado: 60% en las 4 métricas — falla el comando si no se cumple).
 
**101 tests en 12 suites**, con tres estrategias de testing según la capa (arquitectura por capas reflejada también en la estrategia de pruebas):
 
| Capa | Estrategia | Cobertura |
|---|---|---|
| `domain/` | Funciones puras, **sin mocks** — datos de entrada, aserciones sobre la salida | ~100% |
| `infrastructure/repositories/` | `aws-sdk-client-mock` — intercepta el SDK de AWS sin tocar la nube real | ~80% |
| `application/` (casos de uso principales) | `jest.mock()` de los repositorios | ~76-94% |
 
Se excluye `src/handlers/**` de la cobertura (`collectCoverageFrom` en `package.json`): son adaptadores delgados (parsean el `event`, llaman al caso de uso, formatean la respuesta) sin lógica de negocio propia; toda la lógica real está cubierta en `domain/` y `application/`.
 
**Tests que valen la pena señalar** porque verifican correcciones de diseño específicas encontradas durante el desarrollo:
 
- `otp.test.js` / `resolverAprobacion.test.js`: verifican el caso límite del deadlock OTP resuelto (intentos agotados **y** generaciones agotadas simultáneamente → `BLOQUEADO`, no un intento de regenerar una 4ª vez).
- `verificarOtp.test.js`: verifica que el código OTP **nunca se compara** si el `approver_token` no es válido primero (`expect(otpsRepo.obtenerOtp).not.toHaveBeenCalled()`).
- `firmarSolicitud.test.js`: verifica que un fallo en la generación del PDF deja la solicitud en `FIRMAS_COMPLETAS`, nunca en `COMPLETADA` sin `pdf_key`.
- `hashChain.test.js`: verifica que alterar el hash de una firma intermedia, o incluso solo alterar el nombre de un aprobador (sin tocar el hash directamente), es detectado por `verificarCadena()`.
- `otpsRepository.test.js`: verifica explícitamente que `expira_en` se guarda en **segundos**, no milisegundos (test creado tras corregir ese bug — ver Lecciones aprendidas).
---
 
## 🌐 URLs de despliegue
 
- **API base:** `https://l77ui6z9f2.execute-api.us-east-1.amazonaws.com/Prod`
- **Health check:** `https://l77ui6z9f2.execute-api.us-east-1.amazonaws.com/Prod/api/v1/health`
- **Región:** us-east-1
- **Stack de CloudFormation:** `webaval-back-dev`
---
 
## 🔄 Cómo probar el flujo completo
 
Requiere `curl` o Postman. Reemplaza `{BASE_URL}` por la URL de despliegue.
 
**1. Crear una solicitud:**
```bash
curl -X POST {BASE_URL}/api/v1/solicitudes \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Compra de laptops",
    "descripcion": "20 laptops para el equipo",
    "monto": 15000000,
    "solicitante_email": "juan.perez@empresa.com",
    "solicitante_nombre": "Juan Pérez",
    "aprobadores": [
      { "nombre": "María Gómez", "email": "maria.gomez@empresa.com", "rol": "Jefe de Departamento" },
      { "nombre": "Carlos Ruiz", "email": "carlos.ruiz@empresa.com", "rol": "Director Financiero" },
      { "nombre": "Ana Torres", "email": "ana.torres@empresa.com", "rol": "Gerente General" }
    ]
  }'
```
Guarda el `solicitud_id` de la respuesta.
 
**2. Ver los correos simulados y tomar el `approver_token` del primer aprobador (orden 1):**
```bash
curl {BASE_URL}/api/v1/mock-mail
```
 
**3. Resolver el token y generar el OTP:**
```bash
curl "{BASE_URL}/api/v1/approve?solicitud_id={SOLICITUD_ID}&approver_token={TOKEN}"
```
 
**4. Volver a `/mock-mail` para tomar el código OTP recién generado, y verificarlo:**
```bash
curl -X POST {BASE_URL}/api/v1/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"solicitud_id": "{SOLICITUD_ID}", "orden": 1, "approver_token": "{TOKEN}", "codigo": "{CODIGO_OTP}"}'
```
Guarda el `firma_token` de la respuesta.
 
**5. Firmar (aprobar):**
```bash
curl -X POST {BASE_URL}/api/v1/solicitudes/{SOLICITUD_ID}/aprobadores/1/firmar \
  -H "Content-Type: application/json" \
  -H "X-Firma-Token: {FIRMA_TOKEN}" \
  -d '{"accion": "APROBAR"}'
```
 
**6. Repetir los pasos 2-5 para orden 2 y orden 3.** Al firmar el orden 3, la respuesta debe indicar `"solicitud_estado":"COMPLETADA"`.
 
**7. Descargar el PDF de evidencia:**
```bash
curl -v {BASE_URL}/api/v1/solicitudes/{SOLICITUD_ID}/evidencia.pdf
```
Sigue la URL prefirmada del header `Location` (válida 5 minutos) en el navegador.
 
> ⚠️ Ventanas de tiempo: el OTP expira en 3 minutos, el `firma_token` en 5 minutos. Realiza cada paso sin demoras prolongadas.
 
---
 
## 🔍 Lecciones aprendidas / hallazgos técnicos
 
Documentado deliberadamente porque son errores reales encontrados y corregidos durante el desarrollo, no solo el resultado final:
 
- **`token` es palabra reservada en DynamoDB.** `KeyConditionExpression: "token = :t"` fallaba en producción con `ValidationException`, aunque `sam validate --lint` pasaba sin problema (el linter valida CloudFormation, no las expresiones de DynamoDB embebidas en el código). Se corrigió con un alias (`ExpressionAttributeNames: {"#tok": "token"}`). Se agregó un test específico (`aprobadoresRepository.test.js`) para que este bug no se reintroduzca sin ser detectado.
- **Dependencia circular en CloudFormation.** Intentar inyectar la URL del propio API Gateway como variable de entorno de una Lambda que a la vez es una ruta de ese mismo API produce un ciclo (`Función → necesita → API → necesita → Permiso → necesita → Función`). Se resolvió derivando la URL base **en runtime**, leyendo `event.headers.Host` y `event.requestContext.stage` dentro del handler, en vez de depender de una referencia de CloudFormation en tiempo de despliegue.
- **TTL de DynamoDB en milisegundos en vez de segundos.** Un primer borrador calculaba `expira_en = Date.now() + 180000`; DynamoDB TTL espera epoch en **segundos**, no milisegundos — con ese valor, el TTL nunca habría expirado realmente (una fecha miles de años en el futuro). Corregido a `Math.floor(Date.now()/1000) + 180`, con un test dedicado a evitar la regresión.
- **Deadlock entre reglas de negocio.** La regla "reutilizar OTP vigente" y la regla "bloquear tras 3 intentos fallidos" se contradecían: un OTP con intentos agotados pero aún no expirado se seguía "reutilizando", dejando al aprobador legítimo bloqueado con un código inservible durante toda la ventana de 3 minutos. Resuelto definiendo `esOtpVigente()` como `no expirado Y con intentos disponibles`, y agregando el orden de precedencia correcto en `decidirAccionOtp()`.
- **AWS CLI y Docker en WSL2 requieren configuración explícita de permisos** (grupo `docker`) y no vienen preinstalados junto con SAM CLI — documentado por si el proyecto se reproduce en un entorno limpio.