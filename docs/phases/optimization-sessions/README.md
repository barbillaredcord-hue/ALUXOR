# Optimization Sessions

## Proyecto

ALUXOR / BRTuNegocio  
Workspace operativo: ALUXOR / BosqueReal

## Estado

Implementación de contratos puros. Sin persistencia, repository, storage, offline, Supabase, Realtime ni sincronización.

## Objetivo

Optimization Session representa una ejecución completa del Smart Cut Engine con identidad, trazabilidad y ciclo de vida propios. Organiza referencias a candidatos, recomendación, selección y Proposal sin copiar resultados físicos.

No es un wrapper del motor. Es el límite de dominio que permite validar pertenencia, registrar transiciones, reabrir una ejecución, compararla y prepararla para persistencia posterior.

## Arquitectura

```text
Quote
↓
Optimization Session
↓
Candidates
↓
Recommendation
↓
Proposal
↓
Quote
↓
Production
↓
Fabrication
```

Reglas:

- Quote continúa siendo la fuente de verdad persistente.
- El Smart Cut Engine no conoce Optimization Sessions.
- La sesión no ejecuta ni modifica el motor.
- La sesión no modifica Quote ni aplica Proposal automáticamente.
- Proposal y Active Mode conservan sus contratos actuales.
- Fabricación continúa consumiendo únicamente el summary efectivo.
- Quote añade solamente `optimization.activeSessionId` como referencia opcional de sesión.
- Los campos existentes de `optimization` permanecen por compatibilidad con Active Mode.

## Contrato v1

```text
session:
  type
  contractVersion
  id
  executionId
  quoteId
  materialId
  createdAt
  createdBy
  updatedAt
  engineVersion
  inputSignature
  status
  configuration
  candidateIds
  recommendedCandidateId
  selectedCandidateId
  proposalId
  summary
  metadata
  revision
  audit
```

### Identidad

`executionId` identifica una ejecución concreta. Es obligatorio porque dos ejecuciones pueden compartir Quote, material e input.

Si el consumidor no proporciona `id`, el dominio deriva uno determinista desde:

- `quoteId`;
- `materialId`;
- `executionId`;
- `inputSignature`;
- `createdAt`.

El dominio no usa `Date.now()`, `Math.random()`, UUID aleatorio ni estado global. `createdAt`, `updatedAt`, `createdBy` y el identificador de ejecución siempre llegan explícitamente.

Una futura capa Repository podrá proporcionar un `id` durable sin cambiar el resto del contrato.

## Referencias

La sesión conserva únicamente:

- IDs de candidatos;
- ID recomendado;
- ID seleccionado;
- ID de Proposal;
- firma de entrada;
- versión del motor;
- referencias escalares de configuración y metadata.

No conserva:

- candidatos completos;
- geometría;
- hojas;
- posiciones;
- piezas colocadas;
- piezas no colocadas;
- remanentes;
- resultados duplicados del motor.

`configuration` y `metadata` admiten solamente propiedades escalares. Los arreglos u objetos anidados se rechazan para impedir que se oculten copias de geometría o candidatos.

## Estados

| Status | Significado |
|---|---|
| `open` | Ejecución creada o reabierta. |
| `selected` | Existe un candidato seleccionado. |
| `proposed` | Existe un Proposal ligado al candidato seleccionado. |
| `closed` | La sesión fue cerrada explícitamente. |

Cambiar el candidato seleccionado invalida la referencia de Proposal anterior dentro de la sesión. No modifica el Proposal original ni Quote.

## Auditoría

Cada transición aumenta `revision` y agrega un evento inmutable con:

- secuencia;
- tipo;
- fecha explícita;
- actor;
- `candidateId` cuando corresponde;
- `proposalId` cuando corresponde.

Eventos v1:

- `created`;
- `candidate-selected`;
- `proposal-linked`;
- `reopened`;
- `closed`.

La auditoría registra referencias y transiciones, no datos físicos.

## Summary

El summary se deriva únicamente del contrato de la sesión:

- cantidad de candidatos;
- recomendación;
- selección;
- Proposal;
- presencia de cada referencia;
- status.

No replica métricas físicas. Las métricas continúan perteneciendo al candidato producido por Smart Cut.

## API pública

Archivo público:

`src/lib/optimization-session/index.js`

Funciones:

- `createOptimizationSession()`;
- `createOptimizationSessionFromResult()`;
- `createOptimizationSessionId()`;
- `validateOptimizationSession()`;
- `validateOptimizationSessionReference()`;
- `selectOptimizationSessionCandidate()`;
- `linkOptimizationSessionProposal()`;
- `closeOptimizationSession()`;
- `reopenOptimizationSession()`;
- `compareOptimizationSessions()`;
- `serializeOptimizationSession()`;
- `deserializeOptimizationSession()`.

Todas son puras. Ninguna muta sus entradas.

## Integración con Quote

API oficial:

`applyQuoteMaterialOptimizationSessionReference()`

Esta función:

- crea una nueva versión inmutable de Quote;
- conserva todos los campos previos;
- escribe únicamente `optimization.activeSessionId`;
- permite retirar la referencia mediante `null`;
- no almacena la sesión;
- no altera candidatos, Proposal ni Active Mode.

`applyQuoteMaterialOptimization()` preserva la referencia activa cuando recibe cambios Legacy o Smart Cut que no la reemplazan explícitamente.

Las cotizaciones Legacy que no contienen `activeSessionId` mantienen exactamente su forma anterior.

## Integridad

El dominio valida:

- identidad de sesión, ejecución, Quote y material;
- fecha y actor explícitos;
- versión del motor;
- firma de entrada;
- IDs únicos y ordenados;
- pertenencia de recomendación y selección;
- correspondencia entre Proposal y candidato seleccionado;
- status;
- summary derivado;
- secuencia de auditoría;
- revision;
- ausencia de campos ajenos al contrato;
- pertenencia de la sesión a Quote y material.

Los errores son estructurados y no se corrigen silenciosamente.

## Serialización

La serialización usa un orden canónico de campos y es determinista.

La deserialización:

- analiza JSON;
- valida el contrato completo;
- reconstruye una sesión inmutable;
- rechaza datos inválidos.

No constituye persistencia. Solo prepara el contrato para futuras capas.

## Compatibilidad

Permanecen sin cambios:

- Smart Cut Engine;
- geometría;
- estrategias Shelf y Best Fit;
- evaluación;
- ranking;
- selección del motor;
- Proposal;
- Active Mode;
- Material Calculator;
- Fabricación;
- fallback Legacy Shelf.

## Fuera de alcance

Esta fase no implementa:

- Repository;
- Storage;
- Offline;
- Supabase;
- Realtime;
- sincronización;
- remanentes;
- Inventario;
- IA;
- persistencia de historial.

## Preparación futura

El contrato queda listo para incorporar posteriormente, sin modificar el Smart Cut Engine:

```text
Optimization Session
↓
Repository
↓
Versioning
↓
Storage / Offline
↓
Supabase / Realtime
```

La persistencia futura deberá almacenar la sesión y sus referencias. Los candidatos y la geometría deberán conservar un propietario definido fuera de este contrato antes de habilitar persistencia durable.

## Validación de la fase

Validación obligatoria:

```text
npm test
npm run build
git diff --check
```

No realizar commit ni push sin autorización expresa.
