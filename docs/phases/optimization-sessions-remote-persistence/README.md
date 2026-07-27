# Remote Persistence Foundation for Optimization Sessions

## Objetivo

Preparar el límite de traducción entre el dominio durable local
`Optimization Session v2` y una futura fila remota de Supabase.

Esta fase:

- audita el contrato existente;
- propone una fila remota en `snake_case`;
- incorpora un adapter remoto puro;
- incorpora un Remote Repository con cliente abstracto inyectado;
- implementa el Supabase Client Adapter para ese contrato abstracto;
- define la tabla remota `optimization_sessions` mediante una migración SQL;
- implementa RLS por membresía activa de workspace;
- conserva compatibilidad con la migración local v1 → v2;
- no conecta todavía el cliente compartido ni un backend real;
- no implementa sincronización ni Realtime.

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
Supabase Client Adapter
↓
Supabase SDK inyectado
↓
Tabla definida por migración
↓
RLS por workspace
↓
Conexión / Sync Engine / Realtime (pendientes)
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

Tabla definida:

`optimization_sessions`

La definición física vive en:

`supabase/migrations/20260726171722_create_optimization_sessions.sql`

La migración no se aplicó a un backend durante esta fase.

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
| `candidate_ids` | `jsonb` | No | `candidateIds` |
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

`engine_version` usa `jsonb` porque el contrato local admite número o texto y
el round trip debe conservar su tipo. `candidate_ids` usa `jsonb` para mantener
el arreglo remoto sin coerciones y validarlo estructuralmente.

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

## Supabase Client Adapter

Archivo:

`src/lib/optimization-sessions/supabaseClient.js`

Fábrica:

```text
createOptimizationSessionSupabaseClient({
  supabase,
  workspaceId,
  tableName = 'optimization_sessions',
})
```

La dependencia Supabase se inyecta. El Adapter no importa ni crea el cliente
global, no depende de React y no conoce el modelo local de Optimization
Session.

Flujo:

```text
Remote Repository
↓
Supabase Client Adapter
↓
Supabase SDK
```

### Contrato implementado

La fábrica devuelve un objeto congelado con:

```text
insert(row)
update(row, expectedVersion)
selectOne(sessionId)
selectMany(filters)
delete(sessionId)
```

Cada operación devuelve exactamente:

```text
{ data, error }
```

Las filas permanecen en `snake_case`. La conversión entre fila y dominio
continúa perteneciendo exclusivamente al Remote Adapter.

### Aislamiento por workspace

El `workspaceId` se fija al construir el Adapter.

- toda consulta aplica `workspace_id = workspaceId`;
- `insert` y `update` rechazan filas sin `workspace_id`;
- una fila o filtro de otro workspace se rechaza antes de consultar;
- `selectOne`, `update` y `delete` usan `workspace_id + id`;
- las respuestas también se verifican contra el workspace inyectado;
- el Adapter nunca corrige ni sustituye un workspace recibido.

Este control es defensa en profundidad de aplicación. No sustituye RLS.

### Versionado optimista

`update(row, expectedVersion)` exige:

```text
row.version === expectedVersion + 1
```

La escritura se limita en una sola consulta mediante:

```text
id
workspace_id
version = expectedVersion
```

Cero filas actualizadas se interpreta como conflicto de versión. No se ejecuta
un `SELECT` previo y no se realiza una escritura incondicional.

### Filtros y orden

`selectMany()` admite:

- `quote_id`;
- `material_id`;
- `execution_id`;
- `status`;
- `created_by`;
- `last_modified_by`;
- `contract_version`;
- `version`;
- aliases camelCase equivalentes requeridos por el Remote Repository.

Los filtros desconocidos y los aliases contradictorios se rechazan. El orden
es determinista:

```text
updated_at DESC
id ASC
```

### Errores normalizados

| Código | Significado |
|---|---|
| `OPTIMIZATION_SESSION_SUPABASE_CLIENT_INVALID` | Configuración inyectada inválida |
| `OPTIMIZATION_SESSION_SUPABASE_INPUT_INVALID` | Fila, ID, filtro o versión inválidos |
| `OPTIMIZATION_SESSION_SUPABASE_QUERY_FAILED` | Fallo devuelto o lanzado por el SDK |
| `OPTIMIZATION_SESSION_SUPABASE_VERSION_CONFLICT` | La escritura condicionada no actualizó una fila |
| `OPTIMIZATION_SESSION_SUPABASE_NOT_FOUND` | La sesión no existe en el workspace |
| `OPTIMIZATION_SESSION_SUPABASE_WORKSPACE_MISMATCH` | Workspace cruzado |
| `OPTIMIZATION_SESSION_SUPABASE_RESPONSE_INVALID` | Cardinalidad o forma de respuesta inválida |

Los errores del SDK conservan código, mensaje, detalles y hint útiles dentro
del error normalizado.

## Tabla `optimization_sessions`

Propósito: materializar exclusivamente el contrato de fila remota de
Optimization Sessions, sin almacenar candidatos, hojas, piezas ni geometría.

Archivo:

`supabase/migrations/20260726171722_create_optimization_sessions.sql`

La migración crea `public.optimization_sessions` con las 23 columnas exactas
de `OPTIMIZATION_SESSION_REMOTE_FIELDS`. No agrega columnas auxiliares, por lo
que `select('*')` continúa siendo aceptado por el Remote Adapter estricto.

### Tipos y defaults

- las identidades y referencias usan `text` opaco para preservar UUIDs y IDs
  legacy deterministas sin coerción;
- los timestamps usan `timestamptz` y no tienen default: los envía el dominio;
- `engine_version`, `configuration`, `candidate_ids`, `summary`, `metadata` y
  `audit` usan `jsonb`;
- `version`, `revision` y `contract_version` usan `integer`;
- solo `configuration`, `candidate_ids`, `metadata`, `version` y
  `contract_version` tienen defaults estructurales seguros;
- los tres IDs de Recommendation, Selection y Proposal son anulables.

### Constraints

- `id` es primary key global;
- identidades, actores e `input_signature` obligatorios no pueden estar vacíos;
- `engine_version` conserva exclusivamente número o texto JSON;
- `status` admite `open`, `selected`, `proposed` y `closed`;
- `configuration`, `summary` y `metadata` deben ser objetos;
- `candidate_ids` y `audit` deben ser arreglos;
- `version >= 1`, `revision >= 1` y `contract_version in (1, 2)`;
- `revision` debe coincidir con `jsonb_array_length(audit)`.

No se añadieron Foreign Keys. El contrato durable admite identidades opacas,
mientras las tablas actuales de Workspace, Quote y Auth usan UUID. Forzar esas
relaciones en esta fase rompería compatibilidad. La integridad referencial
física debe resolverse en una migración explícita posterior, si el contrato de
identidad se restringe sin perder sesiones legacy.

### Índices y workspace

Todos los índices secundarios comienzan por `workspace_id`:

- `(workspace_id, updated_at desc, id asc)`;
- `(workspace_id, id, version)`;
- `(workspace_id, quote_id)`;
- `(workspace_id, material_id)`;
- `(workspace_id, execution_id)`;
- `(workspace_id, status)`;
- `(workspace_id, created_by)`;
- `(workspace_id, last_modified_by)`.

Los prefijos existentes cubren las búsquedas por workspace y
`workspace_id + id`; no se duplicaron con índices equivalentes. El índice
`workspace_id + id + version` soporta el update optimista condicionado sin
incrementos automáticos.

### Límites de esta entrega

La migración:

- define la tabla, pero no se aplicó a un backend real;
- dispone de una migración posterior que habilita RLS;
- no se conecta el cliente compartido a hooks o UI;
- no existe Sync Engine;
- no existe Realtime;
- no existe historial remoto.

## Límites

Esta fase no:

- aplica la migración a un proyecto Supabase;
- conecta el Adapter a la aplicación o a un proyecto Supabase real;
- crea un segundo cliente global;
- ejecuta queries contra un backend durante las pruebas;
- cambia el Repository local;
- procesa Offline Queue;
- implementa sincronización;
- resuelve conflictos remotos;
- implementa Realtime;
- modifica Quote;
- modifica Smart Cut Engine;
- modifica Fabricación.

## Pendientes para implementación Supabase

- validar y aplicar la migración en un entorno controlado;
- conectar la fábrica mediante el cliente compartido existente;
- integrar el cliente concreto detrás del Remote Repository;
- conservar el adapter remoto como único traductor;
- definir paginación y orden estable;
- definir recuperación y retry sin duplicar sesiones;
- verificar la configuración de exposición de Data API;
- no incluir geometría en payloads.

## Pendientes para SQL

- validar la migración contra una base local sin modificar datos reales;
- revisar Foreign Keys solo si el contrato de identidad deja de admitir texto
  legacy;
- verificar grants de Data API independientemente de RLS.

## RLS implementado

Archivo:

`supabase/migrations/20260726193125_secure_optimization_sessions_rls.sql`

La autorización reutiliza el contrato canónico
`private.has_workspace_permission(workspace_id, permission)`, respaldado por
`workspace_members`, membresías `active`, roles oficiales y `auth.uid()`.

Políticas:

- `optimization_sessions_select_member`: lectura con `view_workspace`;
- `optimization_sessions_insert_editor`: inserción con `manage_quotes`;
- `optimization_sessions_update_editor`: actualización con `manage_quotes`,
  protegida mediante `USING` y `WITH CHECK`;
- `optimization_sessions_delete_editor`: eliminación con `manage_quotes`.

Todas se limitan al rol `authenticated`. No existen políticas para `anon` ni
predicados globales `true`. Como `workspace_id` conserva el tipo remoto `text`,
las políticas validan primero su forma UUID y rechazan valores no canónicos
antes de invocar el helper UUID.

El trigger `optimization_sessions_prepare_update`, ejecutado antes de UPDATE,
rechaza exclusivamente cambios de `workspace_id`. No modifica columnas,
versiones, timestamps ni datos de negocio. Así impide mover una sesión incluso
cuando el actor tiene permisos en ambos workspaces.

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
