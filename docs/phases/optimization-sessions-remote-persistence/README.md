# Remote Persistence Foundation for Optimization Sessions

## Objetivo

Preparar el límite de traducción entre el dominio durable local
`Optimization Session v2` y una futura fila remota de Supabase.

Esta fase:

- audita el contrato existente;
- propone una fila remota en `snake_case`;
- incorpora un adapter remoto puro;
- incorpora un Remote Repository con cliente abstracto inyectado;
- conserva compatibilidad con la migración local v1 → v2;
- no conecta Supabase;
- no crea SQL, sincronización ni Realtime.

## Arquitectura

```text
Optimization Session v2
↓
Remote Adapter puro
↓
Fila remota propuesta
↓
Remote Repository
↓
Cliente abstracto inyectado
↓
Supabase / RLS / Realtime (pendientes)
```

El Adapter remoto reutiliza el Adapter durable existente. No replica validación,
migración ni reglas del dominio.

El Remote Repository solo coordina operaciones y obliga a que toda fila entre o
salga mediante el Remote Adapter.

## Contrato durable local real

Fuente:

`src/lib/optimization-session/session.js`

### Campos

| Campo | Contrato | Responsabilidad |
|---|---|---|
| `type` | Requerido; valor `optimization-session` | Tipo de dominio |
| `contractVersion` | Requerido; valor actual `2` | Versión del contrato |
| `id` | Requerido; texto opaco | Identidad durable |
| `executionId` | Requerido | Identidad de una ejecución |
| `workspaceId` | Requerido | Aislamiento por workspace |
| `quoteId` | Requerido | Referencia a Quote |
| `materialId` | Requerido | Referencia al material |
| `createdAt` | Requerido; ISO canónico | Creación |
| `createdBy` | Requerido | Actor creador |
| `updatedAt` | Requerido; ISO canónico | Última transición |
| `engineVersion` | Requerido; texto o número finito | Contrato del motor |
| `inputSignature` | Requerido | Firma de la entrada optimizada |
| `status` | Requerido | Estado de la sesión |
| `configuration` | Requerido; objeto escalar, puede estar vacío | Referencias de configuración |
| `candidateIds` | Requerido; arreglo único y ordenado, puede estar vacío | Referencias a candidatos |
| `recommendedCandidateId` | Opcional; `null` o ID presente en `candidateIds` | Recomendación |
| `selectedCandidateId` | Opcional; `null` o ID presente en `candidateIds` | Selección |
| `proposalId` | Opcional; `null` o referencia | Proposal |
| `summary` | Requerido y derivado | Resumen de referencias y estado |
| `metadata` | Requerido; objeto escalar, puede estar vacío | Metadata estable |
| `version` | Requerido; entero positivo | Versión optimista |
| `lastModifiedBy` | Requerido | Actor de la última modificación |
| `revision` | Requerido; coincide con `audit.length` | Secuencia de dominio |
| `audit` | Requerido; arreglo no vacío | Auditoría de transiciones |

Los campos opcionales son referencias anulables. No se omiten ni se sustituyen
por valores inventados durante la conversión remota.

### Identidad y UUID

El dominio trata todos los identificadores como texto opaco.

Si el consumidor proporciona un UUID como `id`, `executionId`, `workspaceId`,
`quoteId`, `materialId`, `createdBy` o `lastModifiedBy`, el Adapter lo preserva
exactamente.

El dominio también admite identidades legacy. Cuando no recibe `id`, genera:

```text
optimization-session:<hash-determinista>
```

Por esta razón, convertir hoy `id` en una columna PostgreSQL `uuid` rompería
sesiones existentes. El tipo remoto propuesto es `text`. Una futura adopción
obligatoria de UUID requerirá una migración de identidad separada.

### Versionado y timestamps

- `contractVersion` identifica la forma del dominio; actualmente es `2`.
- `version` inicia en `1` y participa en optimistic versioning mediante
  `expectedVersion`.
- `revision` aumenta con cada transición del dominio.
- `createdAt` y `updatedAt` son ISO canónicos.
- `createdAt` no cambia.
- `updatedAt` corresponde al último evento de `audit`.
- `lastModifiedBy` identifica al actor de la última modificación.

La migración v1 → v2:

- preserva `id`, referencias, timestamps y auditoría;
- recibe `workspaceId` desde el contexto explícito;
- inicia `version` en `1` si no existe;
- deriva `lastModifiedBy` desde `createdBy` si no existe;
- vuelve a validar el contrato completo.

### Estados válidos

| Estado | Condición |
|---|---|
| `open` | Sesión creada o reabierta |
| `selected` | Requiere `selectedCandidateId` |
| `proposed` | Requiere selección y `proposalId` |
| `closed` | Cierre explícito |

Eventos válidos de auditoría:

- `created`;
- `candidate-selected`;
- `proposal-linked`;
- `reopened`;
- `closed`.

## Verificación de no duplicación

La sesión almacena únicamente:

- `candidateIds`;
- `recommendedCandidateId`;
- `selectedCandidateId`;
- `proposalId`;
- firmas, referencias escalares, status y auditoría.

No almacena:

- candidatos completos;
- hojas;
- geometría;
- posiciones;
- piezas colocadas;
- piezas no colocadas;
- resultados completos del Smart Cut Engine;
- remanentes.

`configuration` y `metadata` solo aceptan valores escalares. El dominio rechaza
objetos o arreglos anidados, por lo que tampoco pueden ocultar resultados
físicos. El Adapter remoto rechaza cualquier columna ajena a su allowlist.

## Contrato remoto propuesto

Tabla futura sugerida:

`optimization_sessions`

Esta tabla aún no existe. Los tipos siguientes son una propuesta contractual,
no una migración SQL.

| Columna | Tipo PostgreSQL propuesto | Nulable | Origen local |
|---|---|---:|---|
| `id` | `text` | No | `id` |
| `execution_id` | `text` | No | `executionId` |
| `workspace_id` | `text` | No | `workspaceId` |
| `quote_id` | `text` | No | `quoteId` |
| `material_id` | `text` | No | `materialId` |
| `created_at` | `timestamptz` | No | `createdAt` |
| `created_by` | `text` | No | `createdBy` |
| `updated_at` | `timestamptz` | No | `updatedAt` |
| `engine_version` | `jsonb` | No | `engineVersion` |
| `input_signature` | `text` | No | `inputSignature` |
| `status` | `text` | No | `status` |
| `configuration` | `jsonb` | No | `configuration` |
| `candidate_ids` | `text[]` | No | `candidateIds` |
| `recommended_candidate_id` | `text` | Sí | `recommendedCandidateId` |
| `selected_candidate_id` | `text` | Sí | `selectedCandidateId` |
| `proposal_id` | `text` | Sí | `proposalId` |
| `summary` | `jsonb` | No | `summary` derivado |
| `metadata` | `jsonb` | No | `metadata` |
| `version` | `integer` | No | `version` |
| `last_modified_by` | `text` | No | `lastModifiedBy` |
| `revision` | `integer` | No | `revision` |
| `audit` | `jsonb` | No | `audit` |
| `contract_version` | `integer` | No | `contractVersion` |

`type` no se copia: la tabla fija el tipo de entidad.

`engine_version` se propone como `jsonb` porque el contrato local admite número
o texto y el round trip debe conservar su tipo. Esta decisión debe confirmarse
en la fase SQL.

## Remote Adapter

Archivo:

`src/lib/optimization-sessions/remoteAdapter.js`

API:

```text
optimizationSessionToRemoteRow(session)
optimizationSessionFromRemoteRow(row)
```

Ambas funciones devuelven:

```text
{ data, error }
```

Responsabilidades:

- traducir `camelCase` ↔ `snake_case`;
- preservar identidad, workspace, Quote y material;
- preservar versiones, timestamps y actores;
- crear copias independientes;
- reutilizar validación e hidratación oficiales;
- aceptar migración compatible v1 → v2;
- rechazar filas incompletas;
- rechazar columnas no autorizadas;
- exponer errores estructurados;
- no inventar valores ausentes.

No importa Supabase, React, Repository ni Smart Cut Engine.

### Errores remotos

| Código | Significado |
|---|---|
| `OPTIMIZATION_SESSION_REMOTE_INVALID_SESSION` | El dominio local es inválido |
| `OPTIMIZATION_SESSION_REMOTE_INVALID_ROW` | La fila está incompleta o no hidrata |
| `OPTIMIZATION_SESSION_REMOTE_UNEXPECTED_FIELD` | La fila contiene columnas ajenas |

## Remote Repository

Archivo:

`src/lib/optimization-sessions/remoteRepository.js`

Única exportación:

```text
createRemoteOptimizationRepository(client)
```

API pública:

```text
create(session)
update(session, expectedVersion)
get(sessionId)
list(filters)
remove(sessionId)
```

Todas las operaciones son asíncronas y devuelven:

```text
{ data, error }
```

Las excepciones del cliente se capturan y se devuelven como `error`. El
Repository no deja excepciones del transporte sin controlar.

### Responsabilidades

- validar sesiones mediante el Remote Adapter;
- validar IDs, filtros y `expectedVersion`;
- convertir Session → fila antes de escribir;
- convertir fila → Session después de leer o escribir;
- preservar identidad, workspace, Quote, versiones, timestamps y actores;
- entregar copias independientes al cliente;
- propagar errores del cliente;
- rechazar respuestas con forma inválida;
- rechazar filas inválidas dentro de listados;
- coordinar optimistic versioning sin modificar el dominio.

No contiene reglas de Optimization Session ni reglas físicas.

### Contrato del cliente abstracto

El cliente se inyecta. Debe implementar:

| Operación | Entrada | `data` exitosa |
|---|---|---|
| `insert(row)` | Fila remota completa | Fila insertada |
| `update(row, expectedVersion)` | Fila nueva y versión remota esperada | Fila actualizada |
| `selectOne(sessionId)` | Identidad opaca | Fila encontrada |
| `selectMany(filters)` | Objeto plano de filtros escalares | Arreglo de filas |
| `delete(sessionId)` | Identidad opaca | Fila eliminada |

Cada operación debe devolver:

```text
{ data, error }
```

El cliente:

- decide cómo ejecutar el transporte;
- no devuelve modelos locales;
- no aplica el Remote Adapter;
- no recibe una instancia Supabase obligatoria;
- no asume tabla, SQL ni API concreta en esta fase.

`filters` permanece abstracto. El Repository lo copia y valida como un objeto
plano con valores escalares; la implementación futura definirá filtros
permitidos y su traducción al backend.

### Flujo

Escritura:

```text
Session
↓
Remote Repository
↓
Remote Adapter
↓
Remote Row
↓
Cliente abstracto
```

Lectura:

```text
Cliente abstracto
↓
Remote Row
↓
Remote Adapter
↓
Remote Repository
↓
Session
```

Ninguna ruta evita el Remote Adapter.

### Optimistic versioning

`update(session, expectedVersion)` exige:

```text
session.version === expectedVersion + 1
```

La sesión llega versionada desde las APIs oficiales del dominio local. El
Remote Repository no incrementa ni reescribe `version`.

El cliente futuro deberá actualizar únicamente cuando la versión remota sea
igual a `expectedVersion`. Una falta de coincidencia debe regresar como error
del cliente, nunca como escritura incondicional.

### Errores internos

| Código | Significado |
|---|---|
| `OPTIMIZATION_SESSION_REMOTE_CLIENT_INVALID` | Falta una operación del cliente |
| `OPTIMIZATION_SESSION_REMOTE_INPUT_INVALID` | ID, filtros o versión inválidos |
| `OPTIMIZATION_SESSION_REMOTE_RESPONSE_INVALID` | Respuesta o fila inválida |
| `OPTIMIZATION_SESSION_REMOTE_VERSION_CONFLICT` | El avance local no coincide con `expectedVersion` |

## Límites

Esta fase no:

- crea ni modifica tablas;
- conecta Supabase;
- implementa un cliente de transporte;
- ejecuta queries reales;
- cambia el Repository local;
- procesa Offline Queue;
- implementa sincronización;
- resuelve conflictos remotos;
- implementa Realtime;
- define políticas RLS;
- modifica Quote;
- modifica Smart Cut Engine;
- modifica Fabricación.

## Pendientes para implementación Supabase

- implementar las cinco operaciones del cliente abstracto;
- seleccionar explícitamente la tabla o schema remoto;
- devolver siempre `{ data, error }`;
- enviar la condición `expectedVersion` en updates;
- distinguir conflicto de versión, ausencia y fallo de red;
- filtrar siempre por `workspace_id`;
- conservar el adapter remoto como único traductor;
- definir paginación y orden estable;
- definir recuperación y retry sin duplicar sesiones;
- verificar la configuración de exposición de Data API;
- no incluir geometría en payloads.

## Pendientes para SQL

- confirmar nombre de tabla y tipos con datos reales;
- decidir si las identidades legacy continúan como `text`;
- definir primary key e índices;
- definir foreign keys solo cuando las tablas propietarias estén confirmadas;
- crear checks para status, versiones y revisión;
- definir defaults únicamente cuando no inventen datos de dominio;
- decidir si `summary` y `audit` se conservan como `jsonb`;
- habilitar RLS explícitamente;
- verificar grants de Data API independientemente de RLS.

## Pendientes para RLS

- derivar la identidad del usuario desde `auth.uid()`;
- validar membresía real del usuario en `workspace_id`;
- aplicar políticas de `select`, `insert`, `update` y `delete`;
- impedir cambiar `workspace_id` mediante update;
- impedir acceso cruzado entre workspaces;
- crear índices para columnas usadas por las políticas;
- probar usuarios autenticados, no miembros y sesiones expiradas.

No se acepta identidad enviada por el frontend como prueba de autorización.

## Pendientes para sincronización

- definir protocolo local/remoto mediante `version`;
- resolver optimistic conflicts de forma explícita;
- hacer idempotentes create, update y delete;
- confirmar orden entre `updated_at`, `version` y `revision`;
- procesar y retirar Offline Queue solo tras confirmación remota;
- definir recuperación después de interrupciones;
- impedir que un retry duplique una sesión.

## Pendientes para Realtime

- definir suscripción por workspace;
- validar cada payload Realtime con el Adapter remoto;
- evitar ecos y duplicados;
- reconciliar eventos con `version` y `revision`;
- no sustituir sincronización por entrega de eventos;
- no aplicar candidatos ni Proposal automáticamente.

## Compatibilidad

Permanecen sin cambios:

- Quote como fuente de verdad;
- `optimization.activeSessionId`;
- Repository local;
- Storage local;
- Offline Queue;
- Proposal;
- Active Mode;
- Fabricación;
- Smart Cut Engine;
- Shelf;
- Best Fit;
- geometría;
- evaluación y ranking.
