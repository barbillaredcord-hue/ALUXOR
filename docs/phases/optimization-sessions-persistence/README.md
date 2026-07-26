# Persistencia del dominio Optimization Sessions

## Proyecto

BRTuNegocio  
Workspace operativo: ALUXOR / BosqueReal

## Objetivo

Convertir Optimization Session en un dominio durable local del ERP, respetando todas las capas oficiales y sin modificar el Smart Cut Engine.

Esta fase incorpora persistencia local, versionado y contrato offline. No conecta Supabase, Realtime ni sincronización remota.

## Arquitectura implementada

```text
Source
↓
Adapter
↓
Repository
↓
Versioning
↓
Storage / Offline
↓
Hook
↓
Section
↓
Summary
↓
Business State (preparado, no conectado)
```

Ninguna capa superior contiene reglas propietarias de Optimization Session.

## Source

Archivo:

`src/lib/optimization-session/session.js`

Optimization Session continúa siendo propietario de:

- identidad;
- pertenencia a workspace, Quote, material y ejecución;
- candidatos referenciados;
- recomendación;
- selección;
- Proposal;
- status;
- auditoría;
- cierre y reapertura;
- inmutabilidad;
- validación del contrato.

El contrato durable v2 añade:

```text
workspaceId
version
lastModifiedBy
```

Se conservan:

```text
createdAt
updatedAt
createdBy
revision
audit
```

El dominio no conoce Repository, localStorage, React, Supabase, Realtime ni sincronización.

## Migración

El contrato transitorio v1 se migra de forma explícita a v2.

La migración:

- conserva `id`;
- conserva las referencias;
- conserva auditoría y timestamps;
- recibe `workspaceId` desde el contexto de almacenamiento;
- inicia `version` en `1` cuando no existe;
- deriva `lastModifiedBy` desde `createdBy` cuando no existe;
- vuelve a validar el contrato completo.

Los registros que no pueden migrarse se rechazan. No se corrigen silenciosamente.

## Adapter

Archivo:

`src/lib/optimization-session/adapter.js`

Flujos puros:

```text
Session → Storage Record
Storage Record → Session
Session → DTO
DTO → Session
Session → Summary
```

El DTO está preparado con nombres compatibles con una futura capa remota, pero no importa ni utiliza Supabase.

El Adapter:

- no modifica el dominio;
- no aplica reglas de UI;
- no persiste;
- no copia geometría;
- valida toda recuperación.

## Repository

Archivo:

`src/lib/optimization-session/repository.js`

Operaciones oficiales:

- `createSession`;
- `updateSession`;
- `deleteSession`;
- `getSession`;
- `getSessionsByQuote`;
- `getLatestSession`;
- `setActiveSession`;
- `closeSession`;
- `reopenSession`;
- `compareSessions`.

El Repository:

- usa Storage y Offline Queue mediante dependencias inyectables;
- devuelve `{ data, error }`;
- aplica versionado optimista;
- valida workspace y referencias;
- no contiene lógica de UI;
- no contiene reglas físicas;
- no importa Supabase;
- no implementa sincronización.

`setActiveSession` devuelve únicamente:

```text
activeSessionId
quoteId
materialId
```

Quote continúa siendo responsable de conservar `optimization.activeSessionId`. El Repository nunca guarda una copia de Quote ni una sesión dentro de Quote.

## Versioning

Archivo:

`src/lib/optimization-session/versioning.js`

Contrato:

- `version` inicia en `1`;
- toda actualización oficial exige `expectedVersion`;
- una actualización válida incrementa la versión;
- un conflicto devuelve `OPTIMIZATION_SESSION_VERSION_CONFLICT`;
- el desempate de recuperación usa `version`, `updatedAt` y `revision`;
- identidad, timestamps y actor permanecen bajo el contrato del dominio.

Realtime no forma parte de esta fase.

## Storage local

Archivo:

`src/lib/optimization-session/storage.js`

Clave:

```text
aluxor.optimizationSessions.<workspaceId>
```

Propiedades:

- aislamiento por workspace;
- envelope versionado;
- validación mediante Adapter;
- deduplicación por `id`;
- conservación de la versión más nueva;
- upsert;
- eliminación;
- reemplazo por workspace;
- migración de arreglos y contratos anteriores;
- recuperación segura frente a JSON corrupto;
- inmutabilidad.

No se crea una infraestructura paralela. Se conserva el patrón local utilizado por los dominios durables existentes.

## Offline Queue

Archivo:

`src/lib/optimization-session/offlineQueue.js`

Clave:

```text
aluxor.optimizationSessions.offlineQueue.<workspaceId>
```

Operaciones preparadas:

- `create`;
- `update`;
- `delete`;
- `set-active`;
- `close`;
- `reopen`.

Cada operación contiene únicamente:

- identidad determinista;
- tipo;
- workspace;
- `sessionId`;
- `expectedVersion`;
- fecha;
- actor;
- intentos.

No contiene Session completa, candidatos, geometría, hojas, piezas ni payload físico.

La cola solo preserva el contrato local. No procesa, sincroniza ni envía operaciones.

## Selectors

Archivo:

`src/lib/optimization-session/selectors.js`

Selectors puros:

- por ID;
- por Quote;
- por material;
- última sesión;
- sesiones abiertas.

El orden es determinista mediante `updatedAt`, `version` e `id`.

## Summary

Archivo:

`src/lib/optimization-session/summary.js`

El summary reutilizable expone:

- estado;
- cantidad de candidatos;
- seleccionado;
- recomendado;
- Proposal;
- `engineVersion`;
- última actualización;
- versión;
- referencias a workspace, Quote y material.

No incluye geometría.

El summary queda listo para Business State, pero esta fase no modifica ni conecta Business State.

## Hook

Archivo:

`src/hooks/useOptimizationSessions.js`

Responsabilidades:

- cargar el Repository local;
- exponer sesiones y summary;
- ejecutar operaciones oficiales;
- mantener error local;
- refrescar después de mutaciones.

No contiene reglas del dominio ni sincronización.

## Section

Archivo:

`src/sections/OptimizationSessionsSection.jsx`

Section presentacional reutilizable:

- lista sesiones;
- muestra status, candidatos, versión y actualización;
- expone callbacks para activar referencia, cerrar y reabrir;
- no se conecta todavía a navegación;
- no modifica Quote;
- no calcula optimizaciones.

## Quote

Quote sigue almacenando únicamente:

```text
optimization.activeSessionId
```

Los demás campos existentes de `optimization` pertenecen al contrato previo de Active Mode. No se añade una sesión completa, candidatos ni geometría.

## Fabricación

Sin cambios.

Fabricación continúa leyendo solamente el summary efectivo de optimización.

## Compatibilidad

Permanecen sin cambios:

- Legacy;
- Shelf;
- Best Fit;
- Smart Cut Engine;
- geometría;
- estrategias;
- evaluación;
- ranking;
- Proposal;
- Active Mode;
- Material Calculator;
- Fabricación.

## Fuera de alcance

No implementado:

- Supabase;
- Realtime;
- sincronización;
- remanentes;
- Inventario;
- IA;
- nuevas estrategias;
- nuevos algoritmos.

## Preparación remota

La siguiente integración podrá añadir un driver remoto detrás del Repository:

```text
Repository
↓
Supabase
↓
Realtime
↓
Workspace
```

El contrato interno de Optimization Session, Adapter, Versioning, Summary y Selectors no deberá modificarse para realizar esa conexión.

## Validación

Comandos obligatorios:

```text
npm test
npm run build
git diff --check
```

No realizar commit ni push sin autorización expresa.
