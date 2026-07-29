# Entidad Solicitud

```javascript
{
  solicitud_id: string (UUID)        // PK
  titulo: string
  descripcion: string
  monto: number                      // Entero (pesos colombianos, sin decimales)
  solicitante_email: string
  solicitante_nombre: string
  estado: 'PENDIENTE' | 'FIRMAS_COMPLETAS' | 'COMPLETADA' | 'RECHAZADA'
  fecha_creacion: number (timestamp)
  pdf_key: string (opcional)         // Key en S3 (presente solo en COMPLETADA)
}
```

> `FIRMAS_COMPLETAS` es un estado transitorio: las 3 firmas están registradas y el PDF se está generando. Solo tras generar el PDF con éxito se pasa a `COMPLETADA`.

# Entidad Aprobador

```javascript
{
  solicitud_id: string (UUID)        // PK
  orden: number (1-3)                // SK
  approver_id: string (UUID)
  nombre: string
  email: string
  rol: string
  token: string (UUID)               // GSI
  estado_firma: 'PENDIENTE' | 'FIRMADO' | 'RECHAZADO'
  fecha_firma: number (timestamp)    // null si no ha firmado
  hash_firma: string                 // hash encadenado (ver "Firma Digital Concatenada"); null si no ha firmado
  num_otp_generados: number          // por defecto 0, máximo 3
}
```

# Entidad OTP

```javascript
{
  solicitud_id: string (UUID)        // PK
  orden: number (1-3)                // SK
  codigo_hash: string                // SHA256 del código de 6 dígitos
  expira_en: number                  // timestamp en SEGUNDOS (epoch). TTL = now + 180s
  intentos: number                   // Contador de intentos fallidos (máx. 3 por OTP; se reinicia al regenerar)
}
```

# 🔗 Firma Digital Concatenada (Hash Chain)

La "firma digital concatenada" se implementa como una **cadena de hashes secuencial**: cada firma incluye el hash de la firma anterior, formando una cadena inmutable y verificable (chain of custody).

## Composición del hash

```text
hash_firma_N = SHA256(datosSolicitud_canonico + hashAnterior + nombre_N + timestamp_N)
```

Donde:
- **datosSolicitud_canonico**: serialización determinista de los datos de la solicitud (mismo orden de campos siempre).
- **hashAnterior**: para el aprobador con `orden = 1` es el bloque génesis; para los demás, el `hash_firma` del aprobador con `orden = N-1`.
- **nombre_N**: nombre del aprobador que firma.
- **timestamp_N**: `fecha_firma` del aprobador.

## Bloque génesis

El aprobador con `orden = 1` no tiene firma previa. Como semilla usa el hash de los datos de la solicitud:

```text
hashGenesis = SHA256(datosSolicitud_canonico)
```

Cadena completa:

```text
hash_firma_1 = SHA256(datosSolicitud + hashGenesis  + nombre_1 + timestamp_1)
hash_firma_2 = SHA256(datosSolicitud + hash_firma_1 + nombre_2 + timestamp_2)
hash_firma_3 = SHA256(datosSolicitud + hash_firma_2 + nombre_3 + timestamp_3)
```

## Serialización canónica

Para que la cadena sea re-verificable, `datosSolicitud` debe serializarse **siempre igual**. Se construye un objeto con orden de campos fijo (o se ordenan las claves con `Object.keys().sort()`) antes de aplicar SHA256. **No** se serializa directamente el ítem leído de DynamoDB, porque no garantiza el orden de atributos y rompería la verificación.

## Verificación de integridad

Al generar el PDF (y bajo demanda) se recomputa la cadena a partir de los datos almacenados. Si alguna firma fue alterada, todos los hashes posteriores dejan de coincidir → **la manipulación es detectable**.

# 🔄 Máquina de Estados

## Estados de la Solicitud

```text
PENDIENTE → (3 firmas completas) → FIRMAS_COMPLETAS → (PDF generado con éxito) → COMPLETADA
PENDIENTE → (cualquier rechazo) → RECHAZADA
```

## Estados del Aprobador

```text
PENDIENTE → FIRMADO (registra fecha_firma + hash_firma)
PENDIENTE → RECHAZADO (registra fecha_firma)
```

## Validación de turno y estados bloqueantes

Un aprobador con `orden = N` solo puede firmar si:

> 1. La solicitud está en estado `PENDIENTE` (si está `RECHAZADA`, se bloquea con mensaje: "Esta solicitud ya fue rechazada").
> 2. Todos los aprobadores con `orden < N` tienen `estado_firma = 'FIRMADO'`.
> 3. El aprobador actual tiene `estado_firma = 'PENDIENTE'` (no puede firmar dos veces).

Si falla alguna condición, se devuelve el error correspondiente.

## Detección de finalización

Cuando el estado de un aprobador cambia:

1. Si **RECHAZADO** → Solicitud → `RECHAZADA` (fin).
2. Si **FIRMADO** → ¿los 3 están `FIRMADO`?
   - **No** → la solicitud sigue `PENDIENTE`.
   - **Sí** → Solicitud → `FIRMAS_COMPLETAS` → generar PDF → **si éxito**: `COMPLETADA` (+ `pdf_key`).

> **Orden correcto (alineado con el enunciado, pág. 2 punto 7):** "Al generarse el PDF, el estado pasa a Completada". Es decir, primero se genera el PDF y luego se marca `COMPLETADA`. Si la generación del PDF falla, la solicitud **permanece** en `FIRMAS_COMPLETAS` y el proceso se reintenta (idempotente); nunca queda `COMPLETADA` sin `pdf_key`.

# 🔒 Integridad de datos con ConditionExpression

Para evitar condiciones de carrera y duplicados, todas las actualizaciones críticas usarán `ConditionExpression` en DynamoDB:

- Al cambiar el estado de un aprobador a `FIRMADO`/`RECHAZADO`: se verifica que `estado_firma = 'PENDIENTE'`.
- Al pasar la solicitud a `FIRMAS_COMPLETAS`/`COMPLETADA`: se verifica el estado previo esperado.
- Al consumir el `firma_token`: se marca `usado = true` verificando `usado = false`.

Esto asegura que la firma, el consumo del token y la generación del PDF ocurran una sola vez, incluso si varios aprobadores completan su firma casi al mismo tiempo.

# 📝 Contratos de API (OpenAPI)

El contrato completo está en `fase1.yaml`. Todos los endpoints van bajo el prefijo versionado `/api/v1/`.

**Validación de OTP (seguridad):** `POST /api/v1/otp/verify` exige `approver_token` en el body, además de `solicitud_id`, `orden` y `codigo`. El `approver_token` se valida contra el GSI **antes** de comparar el OTP. Esto impide atacar el OTP de 6 dígitos (factor débil) sin poseer el link del aprobador, y evita que un tercero agote los intentos del aprobador legítimo (DoS).

**Autorización de firma:** `POST /api/v1/solicitudes/{solicitud_id}/aprobadores/{orden}/firmar` requiere el `firma_token` en el header `X-Firma-Token` (devuelto por `/api/v1/otp/verify`). Sin este token, la petición se rechaza (401).

El token se valida contra la tabla `SessionTokens`, verificando que:

1. El `firma_token` exista en la tabla.
2. Su `solicitud_id` coincida con el `{solicitud_id}` de la ruta.
3. Su `orden` coincida con el `{orden}` de la ruta.
4. `usado = false` (el token no ha sido consumido previamente).

Tras una firma exitosa, el token se marca con `usado = true` usando `ConditionExpression` (`usado = false`), garantizando un solo uso.

Ejemplo de petición:

```http
POST /api/v1/solicitudes/{solicitud_id}/aprobadores/{orden}/firmar
X-Firma-Token: uuid-del-token
Content-Type: application/json

{
  "accion": "APROBAR"
}
```

# 🏗️ Diagrama de Arquitectura

```text
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐      │
│  │ Crear        │  │ Panel        │  │ Vista Aprobador    │      │
│  │ Solicitud    │  │ Solicitante  │  │ (OTP + Firmar)     │      │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘      │
│         │                 │                   │                  │
└─────────┼─────────────────┼───────────────────┼─────────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                 API Gateway (REST, prefijo /api/v1)              │
│  POST /solicitudes  GET /solicitudes  GET /approve               │
│  POST /otp/verify   POST /firmar      GET /evidencia.pdf         │
└─────────────────────────────────────────────────────────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS Lambda (Node.js)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Handlers (API Gateway adapters)             │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │           Casos de Uso (Application Layer)               │   │
│  │  CrearSolicitud · ValidarOTP · Firmar                   │   │
│  │  GenerarPDF · MockMail · VerificarHash                   │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │  Infrastructure: DynamoDB Repo · S3 Client · PDF Gen     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│    DynamoDB     │ │       S3        │ │   Step Functions    │
│  Solicitudes    │ │      PDFs       │ │  (Opcional para     │
│  Aprobadores    │ └─────────────────┘ │   orquestación)     │
│  OTPs           │                     └─────────────────────┘
│  SessionTokens  │
└─────────────────┘
```

# 📌 Supuestos y decisiones de seguridad

- **Versionado de rutas**: todos los endpoints van bajo `/api/v1/` (incluido `/api/v1/mock-mail`). El prefijo versionado permite publicar cambios incompatibles en un futuro `/api/v2/` sin afectar a los clientes del v1.
- **TTL en segundos**: todos los timestamps de expiración (OTP y firma_token) se manejan en segundos (epoch).
- **TTL vs validación**: el TTL de DynamoDB es solo limpieza; la validez del OTP se valida en código comparando `expira_en` con el timestamp actual.
- **Firma concatenada**: hash chain secuencial (ver sección "Firma Digital Concatenada").
- **Validación de OTP con approver_token**: `/api/v1/otp/verify` exige el `approver_token`, validado contra el GSI antes de comparar el OTP. Protege contra fuerza bruta y DoS de intentos.
- **Regeneración de OTP**: solo se genera un nuevo OTP si no existe uno vigente **con intentos disponibles**. Reutilizar el vigente evita consumir el límite por recargas accidentales; tratar como agotado el que ya gastó sus 3 intentos evita bloqueos temporales silenciosos.
- **Límite de intentos y generaciones**: máx. 3 intentos fallidos **por OTP**; al generar un OTP nuevo, `intentos` se reinicia a 0. Por tanto el tope efectivo es 3 × 3 = **9 intentos**. El límite duro real es el de **generaciones (3)**, que es la protección anti-fuerza-bruta y el **único** bloqueo definitivo (desbloqueo manual, ver "Mejoras Propuestas").
- **Códigos de error**: `429` para límites superados (generaciones en `/api/v1/approve`, intentos en `/api/v1/otp/verify`); `400` para datos inválidos, distinguidos por el campo `codigo` del Error.
- **Reporte al frontend**: `GET /api/v1/approve` devuelve `generaciones_restantes` para que la UI informe cuántos envíos quedan (el contador interno no se expone en el schema Aprobador).
- **Autorización en firma**: `firma_token` de un solo uso (~5 min) generado tras OTP válido, enviado en el header `X-Firma-Token`. La tabla SessionTokens permite invalidación explícita (`usado = true`).
- **Estado FIRMAS_COMPLETAS**: transitorio entre la 3ª firma y la generación exitosa del PDF; garantiza que nunca haya `COMPLETADA` sin `pdf_key`.
- **Escrituras condicionales**: previenen firmas duplicadas, reuso de token y generación de PDFs múltiples.
- **Monto**: número entero (pesos colombianos). Usar centavos o string si se requieren decimales.
- **Turno bloqueado por rechazo**: si la solicitud ya fue rechazada, ningún otro aprobador puede firmar.
- **Validación de turno**: secuencial, basada en `orden` y estados de los aprobadores anteriores.
- **Identificador de aprobador en la ruta**: se usa `{orden}` (el SK) en lugar de `{approver_id}`, para reflejar explícitamente la secuencialidad del turno.


# 🗄️ Diseño de tablas DynamoDB

## Justificación del modelo multi-tabla

Se elige **multi-tabla** por claridad y menor curva de aprendizaje (primer proyecto con DynamoDB). Los patrones de acceso son simples y directos: `GetItem` por PK (Solicitud), `Query` por PK+SK (Aprobadores/OTPs de una solicitud) y lookup por GSI (`token` → aprobador; `solicitante_email` → solicitudes). No hay accesos que requieran combinar entidades heterogéneas en una sola consulta, que es donde single-table aporta más valor. Se documenta **single-table design** como evolución para escala masiva (ver "Mejoras Propuestas"). Es una decisión informada, no una limitación.

## Tabla: Solicitudes

```text
Nombre: Solicitudes
PK: solicitud_id (string)
Atributos: titulo, descripcion, monto, solicitante_email, solicitante_nombre, estado, fecha_creacion, pdf_key
GSI: solicitante_email → PK (para listar por solicitante, evita Scan)
```

`monto`: entero (pesos colombianos, sin decimales). Si se requieren decimales, usar centavos (entero) o string validado.

## Tabla: Aprobadores

```text
Nombre: Aprobadores
PK: solicitud_id (string)
SK: orden (number)
Atributos: approver_id, nombre, email, rol, token, estado_firma, fecha_firma, hash_firma, num_otp_generados
GSI: token → PK (para buscar por token de aprobación)
```

## Tabla: OTPs

```text
Nombre: OTPs
PK: solicitud_id (string)
SK: orden (number)
Atributos: codigo_hash (string), expira_en (number, SEGUNDOS), intentos (number)
TTL: expira_en (segundos) — SOLO limpieza automática. La validez se valida en código.
```

### Comportamiento de generación de OTP (`GET /api/v1/approve`)

- Si el aprobador tiene un OTP vigente (no expirado) **y con intentos disponibles** (`intentos < 3`), se **reutiliza**.
- Si no hay OTP, si expiró, **o si el vigente ya agotó sus 3 intentos**, se genera uno nuevo, se **reinicia** `intentos` a 0 y se **incrementa** `num_otp_generados`.
- El límite de 3 generaciones se valida **antes** de crear uno nuevo; si se supera, se responde **429**.
- La respuesta incluye `generaciones_restantes` para la UI.

> **Por qué un OTP con intentos agotados cuenta como no vigente:** si se reutilizara, el aprobador recibiría un `200` ("OTP enviado") sobre un código que ya devuelve `429` a cualquier intento, y quedaría bloqueado hasta que expirara el TTL sin explicación. Al tratarlo como agotado, el único bloqueo real es el de generaciones, tal como se documenta abajo.

El contador de generaciones vive en la tabla `Aprobadores` (no en el ítem OTP), porque el ítem OTP se sobrescribe en cada regeneración y perdería la cuenta.

### Interacción entre los dos límites

- **Intentos** (máx. 3): fallos al ingresar un OTP concreto → `429` en `/api/v1/otp/verify`.
- **Generaciones** (máx. 3): cada OTP nuevo reinicia `intentos`, así que el tope efectivo de intentos es **9**.
- Agotar los intentos de un OTP **no** bloquea temporalmente: el aprobador puede pedir uno nuevo de inmediato (consumiendo una generación), porque un OTP con `intentos = 3` se considera agotado y no se reutiliza.
- El **único** bloqueo definitivo es agotar las **3 generaciones**.

### Configuración de TTL en DynamoDB

- `expira_en` almacena el timestamp de expiración en **segundos** (epoch).
- Al crear un OTP: `expira_en = Math.floor(Date.now() / 1000) + 180` (3 minutos).
- El TTL está activado apuntando a `expira_en` para que DynamoDB elimine el ítem pasado ese tiempo (solo limpieza).
- **Validación en código**: siempre se compara `expira_en` con `Math.floor(Date.now() / 1000)`. Nunca se confía en la ausencia del ítem como indicador de expiración, porque el borrado por TTL no es inmediato (puede tardar minutos u horas).

```javascript
// Ejemplo de creación de OTP
const otp = {
  solicitud_id: solicitudId,
  orden: orden,
  codigo_hash: sha256(codigo),
  expira_en: Math.floor(Date.now() / 1000) + 180, // 3 minutos en SEGUNDOS
  intentos: 0
}
```

## Tabla: SessionTokens (token de firma de un solo uso)

```text
Nombre: SessionTokens
PK: firma_token (string UUID)
Atributos: solicitud_id (string), orden (number), usado (boolean), expira_en (number, SEGUNDOS)
TTL: expira_en (segundos) — 5 minutos de validez. Igual que en OTPs, solo limpieza:
     la vigencia se valida en código comparando con el timestamp actual.
```

Almacena tokens de un solo uso generados tras validar el OTP (`/api/v1/otp/verify`). El token se devuelve como `firma_token` y debe enviarse en el header `X-Firma-Token` al llamar a `/api/v1/solicitudes/{solicitud_id}/aprobadores/{orden}/firmar`.

**Justificación de tabla vs JWT**: un token de un solo uso requiere invalidación explícita tras su uso. Un JWT stateless no puede invalidarse fácilmente (salvo listas negras, que también requieren estado). Por eso se usa una tabla DynamoDB, que permite marcar `usado = true` con `ConditionExpression` (`usado = false`) para garantizar un único uso, con TTL automático para limpieza.

# 🚀 Mejoras Propuestas

El enunciado (pág. 4) premia argumentar mejoras en términos de escalabilidad, seguridad, UX y mantenibilidad. Se marca su estado.

- **Versionado de API (implementado)**: se adoptó `/api/v1/` como prefijo explícito en todos los endpoints, para poder evolucionar el contrato (un futuro `/api/v2/`) sin romper clientes existentes.
- **Autenticación real (propuesto)**: hoy `GET /api/v1/solicitudes?solicitante_email=` lista por email sin autenticación — cualquiera con un email vería esas solicitudes. Se propone auth (p. ej. Amazon Cognito / JWT) y autorización por propietario.
- **Single-table design (propuesto)**: migrar a tabla única con PK/SK compuestas y GSIs para escala masiva y menos round-trips; se mantiene multi-tabla en el alcance actual por simplicidad (ver justificación abajo).
- **Orquestación con Step Functions (propuesto)**: coordinar firma → generación de PDF → cierre, con reintentos automáticos ante fallo del PDF (resuelve de forma robusta el estado `FIRMAS_COMPLETAS`).
- **Desbloqueo de aprobador (propuesto)**: tras agotar las 3 generaciones de OTP el aprobador queda bloqueado; se propone un flujo de desbloqueo (reenvío por el solicitante o expiración temporal del bloqueo).
- **Vigencia del link de aprobación (propuesto)**: el `approver_token` es un UUID sin expiración — el link sigue siendo válido indefinidamente mientras la solicitud esté `PENDIENTE`. Se asume aceptable porque el acceso real está protegido por el OTP y por la validación de turno. Como mejora se propone darle vigencia (p. ej. 7 días) con reenvío bajo demanda, reduciendo la ventana de exposición si el correo se filtra.
- **Rate limiting en API Gateway / WAF (propuesto)**: proteger endpoints públicos ante abuso.
- **Notificaciones reales (propuesto)**: reemplazar `mock-mail` por Amazon SES u otro proveedor SMTP.