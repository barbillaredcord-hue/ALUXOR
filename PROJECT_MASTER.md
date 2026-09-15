# BRTuNegocio

> Documento maestro de identidad, dirección, arquitectura y estado del producto.

- **Workspace operativo actual:** ALUXOR / BosqueReal
- **Etapa activa:** Etapa III — ERP operativo
- **Fase oficial:** 25.6C — Integración Recepción → Inventario; **COMPLETADA / CERRADA TÉCNICA Y OPERACIONALMENTE** hasta 25.6C.3.7. La validación autenticada en `ALUXOR QA` confirmó el flujo completo de compras, recepción, corrección física, proyección efectiva, Inventario, Realtime, reload, offline/online e idempotencia.
- **Última actualización:** 09/08/2026

## 1. Identidad del proyecto

**BRTuNegocio** es el producto que evoluciona hacia un ERP comercializable para talleres de aluminio, vidrio y carpintería. **ALUXOR / BosqueReal** es el workspace y negocio real donde el producto se desarrolla, valida y utiliza inicialmente. Los nombres están relacionados, pero no son sinónimos absolutos.

El proyecto nació como ALUXOR, se amplió para operar ALUXOR y BosqueReal y evolucionó conceptualmente hacia BRTuNegocio. Su propósito es coordinar el ciclo completo de una empresa de fabricación, reducir procesos manuales, conservar trazabilidad y permitir crecimiento sin mezclar la información de empresas distintas.

Usuarios objetivo:

- Propietarios y administradores del taller.
- Personal de cotización, producción, compras y almacén.
- Responsables de fabricación, instalación, entrega y seguimiento.
- Empresas de fabricación personalizada que necesiten un flujo operativo conectado.

## 2. Visión oficial

**BRTuNegocio será el sistema operativo de una empresa de fabricación.**

No solo cotizará y administrará. También deberá preservar conocimiento, documentar evolución, organizar crecimiento y asistir en la toma de decisiones. El proyecto y su trazabilidad operativa son el centro; las pantallas y módulos son capacidades al servicio de ese flujo.

## 3. Meta final

El flujo integral esperado es:

Cliente → Cotización → Optimización de corte (Legacy / Smart Cut) → Producción → Compras → Recepción → Inventario → Fabricación → Instalación → Entrega → Cobranza → Garantía → Historial → Análisis e IA

La meta no es acumular pantallas, sino conectar los dominios para que cada dato tenga propietario, identidad, historial y consumidores definidos.

## 4. Principios permanentes

- Negocio primero.
- Destinar como máximo 15–20% del tiempo al Centro del Proyecto y la FLDSMDFR, y como mínimo 80–85% a estabilidad y funcionalidad real.
- Primero hacerlo funcionar, después hacerlo mantenible y después elegante.
- La identidad visual nunca modifica reglas del dominio ni fuentes de verdad.
- El sistema visual se implementa como una capa transversal y progresiva.
- Los colores de marca no sustituyen los colores semánticos de éxito, advertencia, error e información.
- Ningún cambio visual debe alterar comportamiento, estructura de datos, permisos, persistencia o sincronización.
- La migración visual debe preservar inicialmente la apariencia y el comportamiento existentes.
- Las nuevas pantallas posteriores a 25.2E deberán utilizar la infraestructura visual oficial cuando resulte estable y apropiado.
- Los componentes visuales compartidos tendrán prioridad sobre estilos duplicados.
- La reutilización visual tendrá preferencia sobre la creación de nuevos estilos equivalentes.
- No crear Context sin una necesidad comprobada.
- No duplicar lógica de negocio ni fuentes de verdad.
- El folio es referencia comercial; el UUID es identidad canónica.
- Una empresa equivale a un workspace.
- `workspace_id` es permanente e inmutable para la entidad.
- Los datos de empresas distintas nunca se mezclan.
- Producción es la autoridad operacional una vez que existe una orden de trabajo.
- `Entregado` es un estado terminal de Producción y activa el modo de solo lectura del proyecto.
- El modo de solo lectura debe bloquear comandos de escritura; deshabilitar controles es únicamente su representación visual.
- Business State es un adapter derivado; no es una fuente persistente ni contiene reglas del dominio.
- Quote continúa siendo la fuente de verdad persistente de la entrada de material y de `activeSessionId`; Optimization Sessions es propietario durable de la identidad, referencias y summary de cada ejecución.
- Smart Cut calcula, compara, recomienda y propone; nunca aplica una optimización sin confirmación explícita.
- Las medidas comerciales nunca se reemplazan por piezas físicas. Las piezas sobredimensionadas se resuelven mediante propuestas explícitas y reversibles; la cobertura modular transforma una superficie comercial en piezas repetitivas de fabricación sin sustituir el diseño original.
- Shelf permanece como fallback oficial y garantiza continuidad Legacy.
- Fabricación consume el summary oficial de optimización; nunca recalcula geometría ni candidatos.
- Compras conserva lo solicitado y comprado; Recepción conserva únicamente los eventos de llegada y sus resultados.
- Compras y Recepción pueden iniciar correcciones, pero todas usan el mismo contrato canónico de Compras.
- Los valores actuales son corregibles; el pasado no se reescribe. Toda enmienda incrementa versión y agrega un evento append-only con autor, rol, módulo, motivo, valor anterior y valor nuevo.
- Solo Owner puede depurar historial mediante una RPC auditada; el frontend no ejecuta `DELETE` genérico sobre la trazabilidad.
- Recepción registra la aceptación física, pero no crea ni posee existencias: Inventario es propietario de `ENTRY_PURCHASE`, `REVERSAL`, movimientos y saldos derivados.
- Realtime reconcilia cambios y nunca origina escrituras; Sync permanece manual.
- Smart Cut permanece desacoplado de React, Supabase y los dominios del ERP.
- Las pantallas consumen información; no son fuentes de verdad.
- Cada sprint deja una mejora real y una actualización breve de continuidad.
- Ninguna función importante se considera cerrada sin funcionamiento, documentación, roadmap y pendientes derivados.

## 5. Arquitectura canónica

Contrato de evolución por dominio:

Source → Adapter → Repository → Versioning → Storage / Offline → Synchronization → Realtime → Hook → Section → Summary → Business State

| Capa | Responsabilidad |
|---|---|
| Source | Modelo, motor o colección propietaria del dominio. |
| Adapter | Traducción entre el modelo interno y formatos externos. |
| Repository | Acceso remoto y operaciones persistentes del dominio. |
| Versioning | Control de concurrencia, revisiones y resolución de cambios. |
| Storage / Offline | Copia local, cola offline y recuperación segura. |
| Synchronization | Coordinación explícita entre estado local, operaciones pendientes y persistencia remota. |
| Realtime | Entrega de cambios remotos; no sustituye versionado ni sincronización. |
| Hook | Orquestación React sin apropiarse de reglas del dominio. |
| Section | Interfaz y acciones del usuario. |
| Summary | Fuente reutilizable, pura e independiente de la interfaz. |
| Business State | Agregación derivada para consumidores transversales. |

Este contrato representa la arquitectura objetivo y ya existe de forma madura en Cotizaciones, Producción y Compras, con distinta profundidad. No implica que todos los dominios tengan todavía todas las capas.

Componentes verificados:

- **BR Engine:** reglas, cálculos, resumen económico e integración con optimización de corte.
- **Workflow Engine:** etapas y derivación canónica de estados; la autoridad operativa posterior a la OT reside en Producción.
- **Production:** motor, adapter, repository, storage, sincronización, versionado, Realtime y summary.
- **Purchases:** motor, adapter, repository, storage, cola offline, versionado, Realtime, selectors y summary. Distingue formalmente cantidad necesaria (`requiredQuantity`), ordenada (`orderedQuantity`/`quantity`), comprada (`purchasedQuantity`), recibida/aceptada y faltante. Sus colores no dependen de estado manual: Material Fulfillment deriva rojo para revisión/incidencia bloqueante, verde para totalmente recibido, azul para totalmente comprado pendiente de recepción, amarillo para compra parcial y gris para sin compra.
- **Review Requests de Compras:** dominio durable con Source → Adapter → Repository → Hook → Selectors → Realtime → UI. Incluye tabla, RLS, Realtime, bandejas Owner/Admin y Recepción, relación explícita `receptionId`, deep link, resaltado y autorización final separada. Las solicitudes son append-only, no modifican Compra ni Inventario directamente.
- **Reception:** motor puro, adapters, repositories local y remoto, versionado optimista, storage aislado por workspace, Pending Operations, Sync Engine manual, Supabase Client Adapter, Hook, Section, selectors, guards y summary implementados. La corrección de revisión trabaja exclusivamente la partida afectada; las demás partidas permanecen intactas y no se duplican recepciones. Solo la cantidad aceptada es fuente física para la integración idempotente con Inventario.
- **Inventory:** 25.6 implementó movimientos; 25.6A lotes, ubicaciones, transferencias, Kardex y snapshots derivados; 25.6B persistencia remota, RLS, RPC, Realtime, Sync manual y reconciliación; 25.6C integró Recepción mediante `ENTRY_PURCHASE` y `REVERSAL` idempotentes. Incluye Inventario General, distribución informativa por proyecto sin duplicar stock, materiales libres y “Otros” desde Inventory Summary y trazabilidad transversal. Los saldos, existencias, reservas, disponibilidad, Kardex y snapshots nunca se persisten: se derivan de movimientos.
- **Identity:** normalización, comparación y preservación canónica por UUID y workspace. `createUuid.js` es el generador seguro compartido por Cotizaciones y colas, pero Producción y Compras todavía conservan puntos de generación directa o inyectable que deben converger.
- **Integrity:** `runIntegrityAudit()` es la entrada pública explícita; combina auditor local estricto, auditor remoto autenticado de solo lectura, comparación local/remota, reporte consolidado, recomendaciones y readiness conservador.
- **Read Only:** `isProjectReadOnly()` pertenece al Production Engine y deriva únicamente de `Entregado`; los hooks de Cotización, Producción, Compras y Workspace rechazan mutaciones y las secciones existentes reflejan el mismo contrato sin duplicar pantallas.
- **Smart Cut Engine / Cut Optimizer:** motor físico determinista, congelado y compatible con Legacy. La UI comparativa, Proposal Application Layer y Active Mode están implementados. Optimization Sessions está completado como dominio durable local y remoto con Source, Adapter, Local Repository, Remote Adapter, Remote Repository, Supabase Client Adapter, Application Repository, Repository Provider, Versioning, Storage, Offline Queue, Pending Operations Repository, Connectivity Provider, Sync Engine manual, Realtime Subscription, Reconciliation, Hook, Section, Summary y Selectors. Su experiencia y ciclo de vida están consolidados mediante Working Input y Working State canónicos, dirty determinista, baseline sincronizada, `expectedVersion` estable y recuperación segura al abrir o reconciliar una sesión. La tabla `optimization_sessions`, sus políticas RLS, el trigger de inmutabilidad de `workspace_id`, el Broadcast privado por workspace y la conexión React mediante dependencias inyectadas están implementados. La creación, actualización repetitiva y eliminación de sesiones, la selección activa por material, la recuperación tras reconexión y la sincronización bidireccional entre ventanas están validadas operacionalmente. 25.5E añadió Oversize Resolution Engine y Modular Coverage Engine como capacidades externas al Smart Cut Engine: el primero resuelve piezas sobredimensionadas y el segundo transforma superficies modulares en piezas físicas repetitivas. Material Calculator y Quote aplican o revierten propuestas trazables; Smart Cut no divide piezas, no calcula coberturas y no conoce reglas comerciales: recibe únicamente piezas físicas ya resueltas mediante su fachada pública. Shelf, Best Fit, geometría, motor y Optimization Sessions permanecieron sin modificaciones. Quote conserva únicamente `material.optimization.activeSessionId`; no existe `isActive` como fuente paralela. Permanecen pendientes la sincronización automática, resolución avanzada de conflictos e historial remoto consolidado. Este cierre no declara finalizado el Smart Cut Optimizer completo.
- **Business State:** adapter central derivado y sin persistencia. Agrega summaries existentes, incluido Reception Summary, y expone proyecto, cliente, cotización, producción, compras, recepción, workflow, salud, riesgos, pendientes, actividad, alertas, indicadores, última actualización y read only sin apropiarse de los dominios.
- **Workspace:** aislamiento y permisos como contexto empresarial; el indicador permanente de workspace del sistema sigue pendiente.
- **Brand System:** infraestructura visual consolidada en 25.2E con tokens JavaScript y CSS, tema funcional, helpers, componentes `BR*`, clases de layout y capas separadas de accesibilidad e impresión.
- **Storage, Offline y Realtime:** implementados en los dominios durables, no todavía en todo el ERP.
- **Supabase:** persistencia remota de los dominios habilitados, bajo sesión y RLS existentes.
- **PM2 de desarrollo:** dependencia versionada y configuración local `ecosystem.config.cjs` verificadas para ejecutar `npm run start` como `aluxor-network`; no forma parte del runtime de producción.

Infraestructura remota implementada para Optimization Sessions:

```text
App
↓
useOptimizationSessions
↓
Application Repository
↓
Sync Engine
├── Local Repository
├── Pending Operations Repository
└── Remote Repository
    ↓
    Remote Adapter
    ↓
    Supabase Client Adapter
    ↓
    Supabase SDK
    ↓
    Tabla optimization_sessions + RLS
    ↓
    Trigger Broadcast privado por workspace
```

`repositoryProvider.js` es el punto único de composición. El Hook consume exclusivamente Application Repository; Application Repository delega en Sync Engine; y el Sync Engine coordina Local Repository, Pending Operations Repository, conectividad, Remote Repository y reconciliación Realtime. La suscripción utiliza un único canal Broadcast privado por workspace, valida filas mediante Remote Adapter y solo escribe en caché local cuando la comparación de versiones y operaciones pendientes lo permite. Realtime de Optimization Sessions sincroniza el contenido de las sesiones; Realtime de Cotizaciones sincroniza `material.optimization.activeSessionId` dentro de `form_data`. El adapter de cotizaciones conserva el formulario completo y `QuoteRepository.subscribeQuotes` entrega esos cambios sin retirar `form_data`. El dominio continúa dependiendo únicamente de contratos abstractos. Supabase es una implementación concreta, inyectable y sustituible, y la UI no lo importa directamente.

Infraestructura remota implementada para Inventario:

```text
Inventory Engine
↓
Adapter
↓
Local Repository
↓
Pending Operations
↓
Sync Engine
↓
Remote Repository
↓
Supabase Client Adapter
↓
Supabase
↓
Realtime
↓
Hook
↓
Selectors / Summary
↓
Business State
```

El Remote Adapter traduce el contrato remoto sin introducir una arquitectura paralela. La UI no importa Supabase; el Hook consume Application Repository y Business State consume únicamente Inventory Summary.

Durante una sesión abierta, `workingInput` es la única fuente de verdad editable. `workingState` coordina la baseline, la versión esperada, el dirty y los conflictos sin convertirlos en estado persistente paralelo. Material Calculator y Cut Optimizer reconstruyen su interfaz y su cálculo desde ese contrato: la selección aplicada se conserva al navegar, las sesiones legacy se normalizan al abrirse y una caché local incompleta puede recuperarse desde la sesión durable. La sesión abierta continúa siendo estado temporal de interfaz; la sesión activa continúa determinada exclusivamente por `material.optimization.activeSessionId` en Quote.

### Fuentes oficiales de verdad verificadas

| Contrato | Fuente oficial | Consumidores o representación |
|---|---|---|
| Estado comercial | `quote.status` / `estadoCotizacion`, limitado por Quote Adapter | Cotización, Historial y estado visible previo a una OT. |
| Estado operacional | `productionOrder.estado` y `PRODUCTION_STATUSES` | Workflow, Producción, summaries, Business State y estado visible del proyecto. |
| Necesidad del proyecto | `purchase_items.required_quantity`, dominio `requiredQuantity` | Requerimiento calculado al crear la compra; no se sobrescribe por cambios de Compra o Recepción. |
| Cantidad ordenada | `purchase_items.quantity`, alias `orderedQuantity` | Compromiso original de la partida. |
| Cantidad comprada | `purchase_items.purchased_quantity`, alias `purchasedQuantity` | Valor actual corregible mediante enmiendas versionadas; `purchasedAt` conserva su referencia temporal. |
| Cantidad aceptada | Recepciones durables activas, derivada como `acceptedQuantity` | Única cantidad que produce efectos físicos idempotentes en Inventario. |
| Cumplimiento material | `src/lib/purchases/materialFulfillment.js` | Deriva `purchasePendingQuantity`, `receptionPendingQuantity`, `projectMissingQuantity`, `surplusPurchasedQuantity`, `surplusReceivedQuantity`, `purchaseStatus`, `receptionStatus` y `globalMaterialStatus`. |
| Trazabilidad material | Eventos append-only y enmiendas de compra | Preserva UUID, workspace, proyecto, compra, partida, recepción, movimiento, actor, rol, módulo, motivo, valores anterior/nuevo y versión. |
| Recepción física | Contratos `receptions` y `reception_items`, ligados por UUID a Compra y sus partidas; migración, RLS, Broadcast y operación remota validados | Bandeja global, captura rápida y detallada, selectors, Reception Summary, Business State, Inicio, Compras, Producción, Inspector, Project Companion e Historial. Los acumulados, incidencias, eventos, notificaciones y estados `pending`, `partial`, `complete` y `rejected` son derivados. |
| Proyecto entregado | `isProjectReadOnly(productionOrder)` cuando el estado canónico es `Entregado` | Guardas de hooks, controles de secciones, Inspector, Historial y Business State. |
| Identidad técnica | UUID de `entity.id` dentro de `workspace_id` | Adapters, repositories, storage, relaciones y auditoría. El folio no participa como identidad. |
| Integridad | Colecciones locales reales y lecturas Supabase bajo RLS | `runIntegrityAudit()` y su reporte; Business State no es fuente de auditoría. |
| Estado empresarial transversal | Summaries de cada dominio agregados por `getBusinessState()` | FLDSMDFR y consumidores futuros; nunca se persiste como verdad paralela. |
| Medidas comerciales | Medidas originales conservadas por Quote | Representan el trabajo vendido. Las resoluciones de fabricación son derivadas reversibles y trazables; nunca reemplazan ni se mezclan con la lista principal de medidas. |
| Entrada persistente de optimización | Quote y su configuración de material | Smart Cut consume una copia normalizada, no muta la entrada y devuelve candidatos, diagnósticos y propuestas. |
| Entrada editable de una sesión abierta | `workingInput` canónico | Material Calculator y Cut Optimizer consumen la misma entrada. Conserva `selectedPieceIds`, `selectedCandidateId`, `strategy` y `pieceOrder`; baseline y Working State permiten detectar cambios reales sin una segunda fuente editable. |
| Resultado activo de optimización | `material.optimization.activeSessionId` en Quote | Es la única referencia canónica que determina qué Optimization Session alimenta la cotización. Material Calculator consume sus métricas activas; una referencia inexistente u obsoleta activa el fallback Legacy. |
| Existencias de Inventario | `public.inventory_movements` dentro del workspace | `ENTRY_PURCHASE` incrementa y `REVERSAL` compensa sin borrar. Inventory Engine, Selectors, Summary, Snapshot, Kardex, Business State e `InventorySection` derivan stock, reservado, disponible, lotes, ubicaciones y distribución; no se persisten saldos. |
| Branding activo | Recursos de `public/branding`, manifest, favicons, tokens y capas CSS oficiales | Login, shell, encabezado, PWA, documentos y adopción incremental de superficies. Los tokens del Design System son la referencia visual oficial desde 25.2E. |

Contrato de solo lectura:

Production `Entregado` → `isProjectReadOnly()` → rechazo de comandos en hooks → controles existentes de consulta sin edición.

No existe una pantalla alternativa ni un flag persistido de read only. La protección actual pertenece a la aplicación; no se añadió una constraint o política RLS específica para el estado `Entregado`.

## 6. Flujo operativo canónico

Cotización → Optimización de corte (Legacy / Smart Cut) → Producción → Compras → Recepción → Inventario → Fabricación → Instalación → Entrega

Reglas oficiales:

- Cada dominio conserva trazabilidad por UUID hacia el anterior.
- Ningún módulo reconstruye información que ya pertenece a otro dominio.
- Una vez creada la OT, Producción determina el estado operacional; Cotización conserva el contexto comercial.
- Recepción debe originarse en partidas de Compras.
- Una partida puede tener múltiples recepciones; cada evento conserva UUID, cantidades observadas, responsable, fecha, evidencia y versión propios.
- Recepción no duplica cantidades compradas ni posee stock. La reconciliación de Inventario convierte exclusivamente cantidades aceptadas en `ENTRY_PURCHASE` y compensa reversiones sin borrar historia.
- Inventario se construye sobre movimientos, no sobre cantidades editadas en pantalla. 25.6C conecta Recepción → Inventario de forma idempotente y trazable.
- El cumplimiento sigue la cadena `Necesario → Ordenado → Comprado → Recibido → Inventariado`: `purchasePendingQuantity = max(requiredQuantity - purchasedQuantity, 0)`, `receptionPendingQuantity = max(purchasedQuantity - acceptedQuantity, 0)` y `projectMissingQuantity = max(requiredQuantity - acceptedQuantity, 0)`.
- Una recepción puede estar completa respecto de lo comprado y, simultáneamente, conservar compra pendiente respecto de la necesidad del proyecto.
- Fabricación consume la orden y el plan de corte; no recalcula la optimización.
- Smart Cut no persiste por sí mismo, no modifica Quote directamente y no aplica propuestas automáticamente.
- Oversize Resolution divide de forma reversible una pieza físicamente incompatible; Modular Coverage transforma una superficie de duela, lambrín, tablilla, listón, deck o perfil equivalente en módulos repetitivos. Ambos conservan la medida comercial original y entregan a Smart Cut únicamente piezas físicas trazables.
- El modo Legacy usa Shelf. El modo Smart Cut usa únicamente un candidato activo y válido; ante obsolescencia o ausencia vuelve temporalmente a Legacy.
- Una orden con estado `Entregado` permanece consultable, pero no admite actualizaciones, nuevas compras, cambios de historial ni configuración del workspace desde el proyecto activo.
- Los summaries y fuentes reutilizables alimentan Business State.
- Dashboard consume Business State; Inspector integra de forma mínima Reception Summary y Project Companion conserva su integración transversal incompleta.

Flujo arquitectónico de optimización:

```text
Quote
↓
Optimization Session (dominio durable local y remoto implementado)
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

Optimization Session conserva durablemente la identidad de la ejecución, el Working Input serializado, las referencias de candidatos, la recomendación, la selección y el summary con métricas derivadas. No almacena candidatos completos, hojas, piezas ni geometría; esos resultados físicos continúan perteneciendo al Smart Cut Engine. Quote no copia la sesión y mantiene únicamente `material.optimization.activeSessionId`, referencia canónica y única para determinar qué sesión alimenta la cotización. La aplicación lee y escribe sesiones mediante Hook → Application Repository → Sync Engine; online utiliza Remote Repository y actualiza la caché local después de la confirmación remota, y offline utiliza Local Repository y Pending Operations Repository. Realtime de sesiones sincroniza INSERT, UPDATE y DELETE; Realtime de Cotizaciones integra el cambio de `activeSessionId` remoto en el formulario local y actualiza la interfaz aunque esa referencia sea el único campo modificado. Al eliminar una sesión activa, el flujo de Quote limpia la referencia correspondiente. La sincronización disponible continúa siendo manual mediante `syncPendingOperations()`; sincronización automática, resolución avanzada de conflictos e historial remoto consolidado permanecen pendientes.

## 7. Roadmap maestro por etapas

| Etapa | Objetivo | Estado | Componentes y condición de cierre |
|---|---|---|---|
| I — Fundación | Establecer aplicación, workspace, diseño, motores y pruebas base. | Completada | Base React/Vite, BR Engine, estructura por proyecto y pruebas. |
| II — Cotizador profesional | Operar cotizaciones reales con cálculo, historial, colaboración y persistencia. | Completada con evolución continua | Cotización durable, PDF, catálogo, offline, Realtime e identidad canónica. |
| III — ERP operativo | Conectar el flujo desde Cotización hasta Entrega. | En desarrollo | Producción, Compras, Recepción e Inventario tienen base durable; 25.6B implementó la persistencia remota de Inventario y validó operacionalmente creación y reversión. Brand System, Business State 2.0, Operational Center, Smart Cut Etapas 1–7 y persistencia remota de Optimization Sessions están consolidados. Faltan la integración automática de Inventario con otros dominios, remanentes, Fabricación durable, Instalación y Entrega. |
| IV — Inteligencia operativa | Convertir datos operativos en alertas, prioridades y decisiones. | Planeada | Business State 2.0 disponible; faltan consumidores dinámicos completos y trazabilidad de los dominios aún no durables. |
| V — Optimización industrial | Optimizar materiales, capacidad, tiempos y fabricación. | En desarrollo técnico adelantado | Smart Cut Engine, UI, Proposal y Active Mode tienen cierre técnico; Optimization Sessions completó persistencia local/remota, Sync Engine manual, Realtime por workspace, integración de referencia activa con Quote y consolidación de experiencia y ciclo de vida. Faltan sincronización automática, resolución avanzada de conflictos, historial remoto consolidado, remanentes e integración definitiva con Inventario. |
| VI — IA empresarial | Asistencia contextual basada en fuentes confiables. | Planeada | Datos durables, auditables y aislados por workspace. |
| VII — CRM | Administrar relación y seguimiento de clientes. | Planeada | Identidad de clientes, historial y comunicación conectados. |
| VIII — Comercial | Gestionar oportunidades, ventas y desempeño comercial. | Planeada | CRM y estados comerciales consolidados. |
| IX — Administración | Integrar cobranza, finanzas, control y reportes. | Planeada | Flujo operativo y comercial estable. |
| X — Ecosistema BR | Convertir BRTuNegocio en plataforma extensible y comercializable. | Planeada | Multiempresa endurecida, operación madura y gobierno del producto. |

No se asigna un porcentaje global: la madurez difiere por dominio y un promedio ocultaría la distancia entre una interfaz existente y un dominio durable.

## 8. Estado oficial de la Fase 25

### 25.0 — Auditoría y estabilización

**Estado:** completada.

Estabilizó la base antes de ampliar persistencia y relaciones.

### 25.1 — Dominio durable de Compras

**Estado:** completada.

El repositorio acredita motor, adapter, repository, storage, offline queue, versionado, Realtime, selectors, summaries y persistencia Supabase para Compras y sus partidas.

### 25.1G — Workflow canónico

**Estado:** completada el 22/07/2026.

Consolidó la autoridad operativa del proyecto y la derivación de estado entre Cotización, Producción y Compras.

### 25.2A — Identidad e idempotencia

**Estado:** completada el 22/07/2026, con convergencia técnica pendiente.

- UUID canónico normalizado y preservado en las entidades durables.
- Generación segura compartida mediante `createUuid.js` en Cotizaciones, colas offline y canales auxiliares.
- Folio conservado como referencia comercial.
- Identidad preservada en actualizaciones.
- Reintentos reutilizando UUID.
- Consultas por workspace + UUID.
- Eliminación de merges basados únicamente en folio.

Pendiente verificable: `productionEngine.js` todavía usa `crypto.randomUUID()` directamente y `purchaseEngine.js` conserva un `idFactory` con ese mismo valor por defecto. La infraestructura de identidad es canónica, pero la generación aún no está completamente centralizada.

### 25.2B — Auditoría integral no destructiva

**Estado:** completada el 22/07/2026.

- Auditoría de colecciones locales.
- Auditoría remota explícita y de solo lectura.
- Reporte consolidado y comparación local/remota.
- Detección de UUID faltantes, inválidos o duplicados.
- Detección de workspace faltante, referencias huérfanas y `workspace_mismatch`.
- Folios comerciales duplicados clasificados como advertencia.
- SQL preview con verificaciones activas y propuestas de DDL comentadas.

Esta fase preparó herramientas; no auditó todavía los datos reales ni activó restricciones.

### 25.2C — Auditoría real de integridad

**Estado:** COMPLETADA.

**Nombre oficial:** 25.2C — Integrity Audit.

**Fecha de cierre:** 2026-07-23.

**Objetivo cumplido:** demostrar operacionalmente la infraestructura oficial de auditoría antes de iniciar el hardening.

`runIntegrityAudit()` se ejecutó en una sesión autenticada sobre el workspace real `0fa9e274-4612-41e8-b751-63a2c21fb84b`, con almacenamiento local real, consultas Supabase autenticadas exclusivamente por `SELECT`, comparación local/remota y sin elevación de privilegios ni modificación de datos.

Resultado operacional:

- Estado: `READY WITH WARNINGS`.
- Critical: 0.
- Errors: 0.
- Warnings: 1.
- Info: 3.
- Registros locales: 12.
- Registros remotos: 15.

Readiness:

- `canAddNotNull: true`.
- `canAddUniqueIdentity: true`.
- `canAddForeignKeys: true`.
- `requiresLegacyRepair: false`.

El resultado habilita conceptualmente el hardening. No autoriza activar restricciones SQL sin respaldo, rollback documentado y validación adicional.

Hallazgo `duplicate_commercial_reference`:

- Folio: `ALX-20260722-001`.
- UUID `367d1fbc-d88b-4ee9-be66-2fa29a27188d`.
- UUID `463ffceb-f9ac-4fc5-8b71-93a9aee8a5ee`.
- Son registros distintos, con UUID canónicos y momentos de creación diferentes.
- No existe identidad duplicada, no deben fusionarse y el folio conserva su función de referencia comercial.
- El hallazgo corresponde al generador de folios, no bloqueó el cierre de 25.2C y su prevención quedó atendida en 25.2D. Los dos registros históricos no fueron borrados, fusionados ni renumerados: continúan siendo entidades distintas y válidas por UUID.

Diferencias informativas:

- Dos cotizaciones remotas no están presentes localmente.
- Un workspace remoto no está representado como colección local.
- Estas diferencias se clasifican como `INFO`; no demuestran corrupción ni bloquean el hardening.

Alcance durable auditado en 25.2C: `workspaces`, `quotes`, `productionOrders`, `purchases` y `purchaseItems`. Recepción se incorporó posteriormente como dominio durable en 25.5 e Inventario en 25.6B; Fabricación sigue siendo un dominio no durable. Business State quedó fuera de la auditoría por ser consumidor derivado y no fuente de verdad.

La evidencia estructurada se conserva fuera del repositorio como reporte JSON generado en `2026-07-23T05:29:16.280Z`.

### 25.2D — Hardening Operativo

**Estado:** COMPLETADA.

**Fecha de cierre:** 2026-07-23.

**Objetivo cumplido:** fortalecer reglas operativas, invariantes, aislamiento por workspace y resistencia ante colisiones sin ampliar módulos, modificar la experiencia de usuario ni alterar la arquitectura general.

#### Contrato definitivo de identidad

- El UUID continúa siendo la identidad canónica de cada entidad.
- El folio es únicamente una referencia comercial y nunca participa en la comparación de identidad.
- Dos entidades con UUID diferentes nunca se fusionan por compartir folio.
- El hardening no modificó UUID existentes.
- Un reintento por colisión conserva intacto el UUID original y modifica únicamente la referencia comercial candidata.
- `nextAvailableCommercialReference()` centraliza el cálculo compartido del siguiente folio disponible.

Este contrato atiende preventivamente el hallazgo `duplicate_commercial_reference` detectado durante 25.2C. No implica que los dos registros históricos del hallazgo hayan sido alterados.

#### Generador resiliente de folios comerciales

Cotizaciones, Producción y Compras utilizan el generador compartido. Antes de insertar, sus repositories consultan las referencias históricas del workspace, incluidas las pertenecientes a registros eliminados o inactivos. Si la referencia candidata ya existe, se incrementa hasta encontrar la siguiente disponible.

Cuando Supabase devuelve una colisión `23505`, el repository revalida la entidad por UUID y relación canónica, vuelve a consultar los folios del workspace, recalcula y reintenta. El flujo contempla múltiples dispositivos, sesiones simultáneas y estados locales incompletos; la colisión afecta al folio y nunca autoriza reemplazar el UUID.

Evidencia principal: `src/lib/identity/entityIdentity.js`, `src/lib/quotes/quoteRepository.js`, `src/lib/production/productionOrderRepository.js` y `src/lib/purchases/purchaseRepository.js`.

Este hardening es lógico y de repositories. No presenta el folio como una nueva restricción SQL ni declara cambios de esquema.

#### Invariantes operativas reforzadas

- Toda escritura durable se ejecuta dentro de un workspace válido.
- Una Cotización no puede actualizarse, eliminarse ni restaurarse sin contexto de workspace.
- Una escritura no puede modificar una entidad perteneciente a otro workspace.
- Una Orden de Producción requiere workspace y cotización relacionada.
- Una Compra requiere OT, workspace y cotización relacionada.
- Las relaciones se validan mediante UUID y contexto canónico.
- Las escrituras cruzadas entre workspaces y las relaciones faltantes se rechazan antes de persistir.

Son invariantes del dominio aplicadas en motores y repositories, no validaciones meramente visuales.

#### Guards del dominio

Los casos verificados en Cotización, Producción y Compras incluyen `WORKSPACE_MISMATCH` y `MISSING_WORKSPACE_ID`. La creación rechaza entidades cuyo workspace no coincide; las actualizaciones quedan acotadas por `workspace_id` y no pueden afectar filas de otro workspace. También se rechazan actualización de cotización sin workspace; OT sin workspace o cotización; compra sin OT, workspace o cotización; y eliminación o restauración de cotización sin workspace.

Después de una colisión `23505` se revalidan el UUID, el workspace y la relación canónica correspondiente antes de decidir entre idempotencia, entidad existente o incremento de folio. Estos códigos no se declaran como contrato universal de repositories ajenos a Cotización, Producción y Compras.

#### Continuidad del contrato read-only

`isProjectReadOnly()` continúa siendo la función canónica. Business State deriva `project.readOnly` y `project.mode` desde ella, y las mutaciones la utilizan directamente o mediante `canAdvanceProductionOrder()`. No se crearon implementaciones paralelas.

La protección sigue siendo por entidad y proyecto, no un bloqueo global del Historial. El ajuste previo de Historial eliminó el estado residual global sin debilitar la protección: los proyectos entregados siguen siendo consultables y exportables, pero no editables.

#### Resultado de 25.2D

La fase dejó folios comerciales resistentes a colisiones, mayor aislamiento por workspace, relaciones operativas protegidas, reintentos seguros ante concurrencia, guards previos a escritura, UUID preservado como identidad, read-only sin contratos paralelos y un núcleo preparado para continuar sin ampliar deuda técnica.

No se aplicaron restricciones SQL, Foreign Keys ni nuevos `NOT NULL`; tampoco se modificaron RLS ni Supabase Schema. Esas acciones futuras continúan requiriendo respaldo, rollback, ejecución incremental y auditoría posterior.

Validación de cierre:

- `npm test`: 48 archivos y 361 pruebas aprobadas.
- `npm run build`: correcto.
- `git diff --check`: correcto.
- Warning conocido: chunk de Vite superior a 500 kB; es informativo, no representa un fallo funcional ni bloquea el cierre.

### 25.2E — Brand System e infraestructura visual

**Estado:** completada.

Consolidó tokens JavaScript y CSS, el índice público de diseño, helpers y tema funcionales, los componentes `BR*` existentes y capas independientes para componentes, layout, accesibilidad e impresión. La adopción inicial mantuvo valores visuales equivalentes y no modificó dominio, contratos ni comportamiento operativo.

### 25.3 — Business State 2.0

**Estado:** cerrada e integrada en `main`.

**Fecha de cierre:** 24/07/2026.

**Commit oficial de cierre:**

- **Hash:** `660a217ba73f4845f68047d88ec551663f22d5cd`
- **Mensaje:** `feat(business-state): complete Phase 25.3 Business State 2.0`
- **Integración:** el commit forma parte de la rama `main`.

**Objetivo:**

Convertir `getBusinessState()` en el adapter central de lectura del ERP sin transformarlo en dominio, store o fuente persistente.

**Arquitectura:**

Dominios propietarios → Summaries existentes → Business State → Consumidores.

El flujo inverso queda prohibido. Business State no escribe, no persiste, no reconstruye información y no contiene reglas propietarias de Cotización, Producción, Compras o Workflow.

**Fuentes consumidas:**

- Summary de Cotización.
- Summary de Producción.
- Summary y selectors de Compras.
- Summary derivado de Workflow.
- Summaries existentes de clientes, finanzas, inventario, fabricación e historial cuando sus entradas están disponibles.
- `isProjectReadOnly()` como contrato canónico de proyecto entregado.

**Estado empresarial expuesto:**

- Proyecto y read only.
- Cliente.
- Cotización.
- Producción.
- Compras.
- Workflow.
- Salud empresarial.
- Riesgos.
- Pendientes.
- Actividad.
- Alertas.
- Indicadores.
- Última actualización.

**Summaries derivados del adapter:**

- Salud: `completed`, `attention`, `healthy` o `unavailable`, siempre acompañada por su fuente.
- Riesgos: ausencia verificable de cliente o materiales, OT pendiente y compras incompletas.
- Pendientes: atender OT, comprar material, recibir compras, continuar fabricación y completar instalación o entrega.
- Actividad: orden cronológico de las últimas actualizaciones publicadas por summaries existentes.
- Indicadores: venta, costo, utilidad, estado read only/editable, avance de compras y materiales comprados o pendientes.

Estos resultados se exponen directamente y también bajo `summaries.business` como contrato agrupado para consumidores futuros.

Si no existe una señal canónica suficiente, Business State no inventa el riesgo, pendiente o estado. Por ejemplo, “proyecto detenido” no se publica sin una fuente que lo determine.

**Consumidores preparados:**

- Dashboard.
- Inspector Inteligente.
- Project Companion.
- Centro del Proyecto.

No se migraron estas pantallas en 25.3. El Centro del Proyecto conserva su consumo parcial preexistente; la migración general corresponde a fases posteriores.

**Estado alcanzado:**

- Contrato funcional y sin estado global.
- Compatibilidad conservada para `company`, `status`, `project`, `indicators`, `summaries` y colecciones heredadas.
- Sin Context, Redux, Zustand, Providers, persistencia ni dominios nuevos.
- BR Engine, Workflow Engine, Identity, repositories, Supabase y Workspace no fueron modificados.

**Validación de cierre:**

- `npm test`: 48 archivos y 363 pruebas aprobadas.
- `npm run build`: correcto.
- `git diff --check`: correcto.
- Warning conocido: chunk de Vite superior a 500 kB; es informativo y no bloquea el cierre.

### Smart Cut Engine — cierre técnico de las Etapas 1–7

**Estado:** implementación técnica completada y motor congelado.

**Fecha de cierre técnico:** 26/07/2026.

**Relación con el roadmap funcional:**

Este trabajo es un adelanto técnico de optimización industrial. No renumera ni desplaza las fases funcionales: 25.4 continúa siendo Operational Center, 25.5 continúa siendo Recepción Durable y 25.6 continúa siendo Inventario por Movimientos. La carpeta documental `docs/phases/phase-25.6-smart-cut-engine/` fue la especificación operativa de esta implementación, pero su nombre no sustituye la numeración funcional oficial de este documento.

**Objetivo alcanzado:**

El Cut Optimizer evolucionó a un motor profesional de optimización física capaz de normalizar y validar entradas, respetar restricciones reales, producir candidatos deterministas, evaluarlos, recomendar una solución, presentarla para revisión y activar de forma reversible un candidato confirmado. La solución no crea un optimizador paralelo y conserva `optimizeCuts()` como fachada pública compatible.

#### Etapa 1 — Contrato Legacy protegido

- Se congeló mediante pruebas el contrato existente de `optimizeCuts()`.
- Se conservaron campos, aliases y comportamiento Legacy.
- Se protegió la inmutabilidad de objetos y arreglos de entrada.
- Se estableció el determinismo físico como requisito: misma entrada y configuración producen las mismas hojas, posiciones, rotaciones, piezas colocadas, piezas no colocadas, estrategia y métricas.
- `durationMs` permanece únicamente como telemetría y no participa en comparaciones ni selección.

#### Etapa 2 — Normalización, validación y geometría

- Se separaron módulos puros de normalización, validación y primitivas geométricas.
- La normalización expande cantidades de forma determinista, conserva trazabilidad mediante `sourceId` y aplica valores predeterminados compatibles.
- La validación clasifica errores y advertencias estructurados sin corregir silenciosamente errores físicos.
- La geometría comprueba límites, intersecciones, colisiones, separación por kerf, márgenes, regiones bloqueadas y reservadas, rotación, veta y encaje físico.
- Las entradas continúan siendo inmutables y los campos nuevos son aditivos.

#### Etapa 3 — Estrategias y candidatos

- Shelf fue extraída como estrategia independiente sin alterar su salida Legacy.
- Best Fit rectangular fue incorporada como segunda estrategia determinista.
- Un registro común ejecuta las estrategias en orden estable.
- El generador produce candidatos completos con `id`, estrategia, hojas, piezas colocadas, piezas no colocadas, validación, diagnósticos, summary, metadata, `valid` y `complete`.
- Toda pieza queda contabilizada exactamente una vez; ninguna desaparece ni se duplica.

#### Etapa 4 — Evaluación y selección

- Los candidatos se evalúan mediante métricas físicas deterministas.
- El ranking usa criterios estables y desempates explícitos.
- La selección distingue candidato ganador y recomendación sin alterar los candidatos.
- El resultado público incorpora ranking, recomendación y explicaciones de forma aditiva.
- Shelf continúa siendo la solución principal Legacy y el fallback oficial.

#### Etapa 5 — Comparación visual

- `SmartCutComparison` ofrece una UI reutilizable para revisar soluciones.
- La interfaz compara candidatos, diagnósticos, métricas y configuración física.
- La visualización de hojas y piezas permite verificar la propuesta sin modificar el motor.
- Material Calculator consume el mismo componente y el mismo resultado del motor.
- La comparación es una capa de presentación: no recalcula, no persiste y no aplica resultados.

#### Etapa 6 — Proposal Application Layer

- Proposal transforma una selección en una propuesta explícita e inmutable.
- Validator verifica identidad, coherencia, vigencia y forma de los cambios propuestos.
- Summary concentra el efecto operativo y económico sin reconstruir geometría.
- Transaction aplica cambios únicamente después de confirmación explícita.
- La aplicación es segura, atómica y basada en APIs oficiales de Quote.
- Smart Cut propone; Quote decide y conserva la propiedad persistente del dato.

#### Etapa 7 — Active Mode

- Se formalizó el estado de optimización del material:

```text
optimization:
  mode
  activeCandidateId
  proposalId
  engineVersion
  inputSignature
  status
```

- Legacy es el modo predeterminado y utiliza Shelf.
- Smart Cut consume un candidato previamente aplicado, existente, válido y compatible con la firma de entrada.
- El estado solo conserva `mode`, referencias, versión, firma y status; no duplica geometría, hojas ni candidatos.
- Los status oficiales son `pending`, `valid`, `obsolete` y `recalculation-required`.
- La firma determinista detecta cambios en piezas, dimensiones, kerf, márgenes, regiones o configuración.
- Un candidato inválido, inexistente u obsoleto nunca se reutiliza automáticamente.
- Quote vuelve temporalmente a Legacy hasta disponer de un candidato válido nuevo.
- Fabricación puede consumir el summary activo mediante APIs oficiales y mantiene Legacy por defecto.
- Los costos continúan usando las reglas actuales; únicamente cambia la fuente del summary cuando el candidato activo es válido.

#### Estado verificable del módulo

| Capacidad | Estado |
|---|---|
| Motor físico | Completo |
| UI comparativa | Completa |
| Proposal Application Layer | Completa |
| Active Mode | Completo |
| Persistencia | Completada en alcance local/remoto: Storage local, versionado, Offline Queue legacy, Remote Adapter, Remote Repository, Supabase Client Adapter, tabla SQL, RLS, trigger de workspace, conexión React, Pending Operations Repository y Sync Engine manual implementados |
| Optimization Sessions | Completado como dominio durable local/remoto, integrado con Cotización, consolidado en experiencia y ciclo de vida y validado bidireccionalmente por Realtime |
| Experiencia y ciclo de vida de Sessions | Consolidados: Working Input y Working State canónicos, sesión abierta separada de sesión activa, dirty determinista, baseline sincronizada, `expectedVersion` estable, guardado y actualización repetitiva, recuperación tras reconexión o caché incompleta y confirmación exclusiva ante conflictos remotos reales |
| Remanentes reutilizables | Pendientes |
| Historial remoto de optimizaciones | Pendiente |
| Sincronización | Sync Engine manual y Realtime bidireccional implementados; sincronización automática y resolución avanzada de conflictos pendientes |
| Realtime | Implementado y validado operacionalmente para crear, actualizar, eliminar y cambiar la referencia activa entre ventanas |
| Supabase | Client Adapter, tabla `optimization_sessions`, RLS, trigger de inmutabilidad de workspace y conexión desde la aplicación implementados |
| Integración definitiva con Inventario | Pendiente |

Smart Cut es actualmente uno de los módulos técnicamente más maduros del proyecto. Optimization Sessions es un dominio durable local y remoto con Remote Adapter, Remote Repository abstracto, Supabase Client Adapter inyectable, SQL, RLS, Application Repository, Sync Engine manual y Realtime desacoplado por workspace. Su integración con Cotización usa exclusivamente `material.optimization.activeSessionId`, y Material Calculator presenta las métricas de la sesión activa. Persistencia remota, CRUD Realtime, selección activa bidireccional y el ciclo completo de apertura, edición, guardado, actualización repetitiva, reconciliación y recuperación están consolidados. `strategy` representa únicamente la estrategia física (`shelf` / `best-fit`); `pieceOrder` representa únicamente el orden de alimentación (`largest-first` / `input-order`). Ambos se persisten por separado junto con `selectedPieceIds` y `selectedCandidateId`. Permanecen pendientes la sincronización automática, resolución avanzada de conflictos, historial remoto consolidado, remanentes e integración definitiva con Inventario. El motor físico permanece desacoplado y congelado, pero Smart Cut Optimizer completo no se declara finalizado.

La persistencia remota, el Sync Engine y esta integración no modificaron Smart Cut Engine, geometría, estrategias, candidatos, evaluación, selección, Proposal ni Active Mode. El cambio en Quote se limita al flujo oficial que persiste y reconcilia `material.optimization.activeSessionId`; no copia el contrato durable de la sesión ni los resultados físicos del motor.

#### Estado oficial de Optimization Sessions Remote Persistence

**Estado:** COMPLETADA en persistencia remota, sincronización manual, Realtime e integración de la referencia activa con Cotización.

Componentes verificados:

- Application Repository conserva la API pública y delega exclusivamente en Sync Engine.
- `repositoryProvider.js` compone Local Repository, Pending Operations Repository, Connectivity Provider, Remote Repository, Supabase Client Adapter y Sync Engine.
- Connectivity Provider usa `navigator.onLine` cuando existe y adopta offline como estrategia segura cuando no existe navegador.
- Pending Operations Repository persiste por workspace en `localStorage`, utiliza UUID para `operationId`, mantiene orden determinista y conserva estados `pending`, `failed` y `conflict`.
- La compactación implementada cubre `create + update`, `update + update`, `create + delete` y `update + delete` sin mezclar entidades ni workspaces.
- Online, create/update/delete confirman primero en Remote Repository y después actualizan la caché local.
- Offline, create/update/delete operan mediante Local Repository y registran la operación pendiente correspondiente.
- `syncPendingOperations()` comprueba conectividad, procesa secuencialmente, incrementa intentos reales, actualiza la copia local confirmada y conserva fallos o conflictos sin resolverlos automáticamente.
- La detección de conflictos utiliza `version`, `expectedVersion` y los errores de concurrencia existentes; conserva payload local y dato remoto disponible.
- La migración `20260726171722_create_optimization_sessions.sql` define la tabla e índices sin almacenar candidatos completos, hojas, piezas ni geometría.
- La migración `20260726193125_secure_optimization_sessions_rls.sql` habilita RLS, limita SELECT/INSERT/UPDATE/DELETE mediante `private.has_workspace_permission(...)` y añade el trigger `optimization_sessions_prepare_update` para impedir cambios de `workspace_id`.
- La migración `20260728120000_enable_optimization_sessions_realtime.sql` emite INSERT/UPDATE/DELETE mediante Broadcast privado en el topic del workspace y autoriza la recepción con `private.has_workspace_permission(..., 'view_workspace')`.
- La reconciliación valida filas con Remote Adapter, ignora eventos antiguos, duplicados y ecos, aplica únicamente cambios seguros a la caché y conserva conflictos en Pending Operations Repository sin llamar `syncPendingOperations()`.
- Quote conserva únicamente `material.optimization.activeSessionId`; no existe un campo `isActive` en Optimization Sessions.
- Realtime de Cotizaciones conserva `form_data` completo, integra cambios remotos de `activeSessionId` en el formulario local y actualiza la interfaz cuando esa referencia es el único cambio.
- Material Calculator consume las métricas derivadas de la sesión activa sin copiar el contrato de la sesión ni resultados físicos completos a Quote.
- Eliminar una sesión activa limpia `activeSessionId` mediante el flujo persistente y Realtime de Cotizaciones.
- La sesión abierta es estado temporal del Hook y puede ser distinta de la sesión activa; abrir no modifica Quote y marcar como activa no cambia la sesión abierta.
- `workingInput` y `workingState` son los contratos canónicos de edición: baseline y Working se sincronizan al abrir, guardar, actualizar y aceptar una revisión remota limpia.
- La firma editable se deriva de la serialización canónica, incluye la selección y configuración persistibles, excluye versionado, timestamps, auditoría y `durationMs`, y distingue de forma determinista **Sin cambios** de **Cambios sin guardar**.
- `expectedVersion` avanza con la baseline aceptada y permite actualizar repetidamente una sesión sin cerrarla ni recargarla.
- Actualizar solo opera sobre la sesión abierta, requiere cambios locales, usa Application Repository y limpia el estado dirty después de la confirmación. La confirmación de sobrescritura aparece únicamente ante un conflicto remoto real.
- Cambiar de sesión con cambios pendientes exige cancelar o descartar; no existe guardado automático, duplicación ni merge implícito.
- Realtime adopta una versión remota cuando el estado abierto está limpio; si existen cambios locales y una revisión remota realmente posterior a la baseline, preserva el borrador y muestra **Conflicto pendiente** sin escribir ni sincronizar automáticamente.
- La hidratación, el cambio de sesión y la creación limpian estados de conflicto obsoletos; la reconciliación entre ventanas y la recuperación después de reconexión no generan confirmaciones falsas.
- La apertura recupera `selectedPieceIds`, `selectedCandidateId`, `strategy` y `pieceOrder`, incluso para sesiones legacy o cuando la caché local está incompleta.
- Material Calculator y Cut Optimizer consumen `workingInput`; la selección aplicada sobrevive a la navegación y el cambio entre Shelf y Best Fit recalcula y actualiza inmediatamente el resultado visible.
- Si un candidato guardado deja de existir tras recalcular, se resuelve de forma determinista el candidato recomendado sin desactivar la validación física.

La fase no incluye sincronización automática, reintentos automáticos, Background Sync, merge, resolución avanzada de conflictos ni historial remoto consolidado.

#### Validación manual bidireccional

- Guardar una Optimization Session y verla en una segunda ventana sin recargar: correcto.
- Abrir la sesión remota desde la segunda ventana: correcto.
- Actualizar la sesión y recibir el cambio por Realtime: correcto.
- Marcar una sesión como activa y reflejar `activeSessionId` en ambas ventanas: correcto.
- Cambiar la sesión activa desde la segunda ventana y retirar la insignia anterior en la primera: correcto.
- Eliminar la sesión activa y limpiar la referencia en ambas ventanas: correcto.
- Confirmación de creación, actualización, eliminación y selección activa bidireccionales: correcta.
- Commit oficial de cierre: `6a61cfc` (`fix: synchronize active optimization session through realtime`), integrado y publicado en `origin/main`.

#### Validación del cierre técnico

- `npm test`: 90 archivos y 758 pruebas aprobadas en el estado final validado.
- `npm run build`: correcto.
- `git diff --check`: correcto, sin errores de whitespace.
- Realtime bidireccional validado operacionalmente en dos ventanas.
- Sin regresiones identificadas en compatibilidad Legacy, Quote, Material Calculator ni Fabricación.
- El Smart Cut Engine queda congelado después de las Etapas 1–7. Las siguientes fases deberán consumir sus APIs públicas sin modificar geometría, estrategias, evaluación o selección salvo una revisión arquitectónica explícita.

### Transición y fases posteriores de la Etapa III

| Orden | Fase o hito | Estado |
|---:|---|---|
| Histórico | 25.2C — Auditoría real de integridad | Completada |
| Histórico | 25.2D — Hardening Operativo | Completada |
| Histórico | 25.2E — Brand System e infraestructura visual | Completada |
| Histórico | 25.3 — Business State 2.0 | Cerrada e integrada en `main` mediante `660a217ba73f4845f68047d88ec551663f22d5cd` |
| 1 | Revisión final de Smart Cut, documentación, commit y push | Completada mediante `73349ce` (`feat(smart-cut): complete Smart Cut Engine architecture through Optimization Sessions`) |
| 2 | 25.4 — Operational Center | Completada mediante `3c7affb` (`feat(operations): add operational center and BR Material Studio`) |
| 3 | 25.5 — Recepción Durable | Completada y validada local y remotamente |
| 3B | 25.5B — Centro Operativo de Recepción | Implementada en código y validada automáticamente |
| 3C | 25.5C — Validación remota de Recepción | Completada e integrada en `main` mediante `751a074` |
| 3D | 25.5D — Eliminación Segura y Transversal de Órdenes de Producción | Completada, validada remotamente e integrada en `main` mediante `44e54fc` |
| 3E | 25.5E — Resolución Inteligente de Piezas Sobredimensionadas | COMPLETADA LOCALMENTE; incluye Oversize Resolution, Cobertura Modular, resolución reversible, trazabilidad, aplicación y reversión sin persistencia propia ni cambios al Smart Cut Engine |
| 4 | 25.6 — Inventario por Movimientos | Motor local implementado; existencias, reservas y disponibilidad se derivan exclusivamente de movimientos |
| 4A | 25.6A — Maduración del dominio de Inventario | COMPLETADA LOCALMENTE; lotes, ubicaciones, transferencias, Kardex, snapshots y selectores avanzados implementados |
| 4B | 25.6B — Persistencia remota de Inventario | IMPLEMENTADA Y VALIDADA OPERACIONALMENTE EN CREACIÓN Y REVERSIÓN |
| 4C | 25.6C — Integración Recepción → Inventario | COMPLETADA / CERRADA TÉCNICA Y OPERACIONALMENTE HASTA 25.6C.3.7 |
| 4C.2 | Consistencia Compras → Recepción → Inventario → Rentabilidad | IMPLEMENTADA Y VALIDADA |
| 4C.3 | Trazabilidad integral y enmiendas de compra | IMPLEMENTADA; validación multiusuario total pendiente |
| 4C.3.1 | Conflictos, Realtime y depuración Owner | IMPLEMENTADA; dos ventanas y RPC Owner validadas, UI con identidades independientes pendiente |
| 4C.3.2 | Índice de Recepción, Inventario General y recálculo de Compra | IMPLEMENTADA Y VALIDADA |
| 4C.3.3 | Necesario → Ordenado → Comprado → Recibido | IMPLEMENTADA Y VALIDADA |
| 5 | Optimization Sessions — nueva fase de Smart Cut | Completada |
| 6 | Optimization Sessions Remote Persistence, Realtime y referencia activa | Completada mediante `6a61cfc`; CRUD y `activeSessionId` validados bidireccionalmente |
| Recomendado | Consolidación de la experiencia y del ciclo de vida de Optimization Sessions | Completada y validada; no constituye una fase nueva |
| 7 | Remanentes reutilizables | Pendiente; depende de Sessions e Inventario |
| 8 | Fabricación Durable | Pendiente |
| 9 | Instalación y Entrega | Pendiente |
| 10 | ERP Operativo | Meta de cierre de la Etapa III |

Este orden es oficial. El adelanto técnico de Smart Cut no renumera Recepción Durable ni Inventario por Movimientos.

## 9. Estado real de los módulos

| Módulo | Clasificación verificable | Estado y límite actual |
|---|---|---|
| Cotización | Operativo y durable | Repository, offline queue, versionado, Realtime, Presence, historial e identidad canónica. Conserva únicamente `material.optimization.activeSessionId` como referencia activa canónica y la sincroniza entre ventanas mediante su propio Realtime. Sus comandos de edición, guardado, estado, eliminación e importación se bloquean cuando la OT relacionada está entregada. `useQuotes.js` y `QuoteSection.jsx` requieren reducción progresiva. |
| Producción | Operativo y durable, con evolución pendiente | Motor, storage, repository, Supabase, sincronización, Realtime, versionado y summary. `Entregado` es terminal. La eliminación segura transversal con autorización Owner, auditoría, limpieza de dependencias, tombstone y protección contra resurrección fue validada remotamente; permanecen la sincronización canónica completa, el historial transversal y las tarjetas operativas. |
| Compras | Operativo y durable | Persistencia local/remota, partidas, offline, Sync manual, Realtime, versionado y relaciones UUID. Distingue necesidad, ordenado, comprado y recibido; soporta precio actual, `purchasedAt`, enmiendas versionadas, `expectedVersion` e historial append-only. |
| Recepción | Operativo y durable; centro transversal validado | Engine y capas durables, índice único por proyecto, detalle completo, captura rápida/detallada, recepciones múltiples, incidencias, observaciones, historial y reversiones. Puede completar lo comprado mientras advierte faltante respecto de la necesidad; solo lo aceptado alimenta la reconciliación física con Inventario. |
| Inventario | Dominio durable local y remoto por movimientos | Movimientos locales/remotos, Inventario General, vista y distribución informativa por proyecto, historial, Kardex, materiales libres y “Otros”. `ENTRY_PURCHASE` incorpora y `REVERSAL` compensa idempotentemente; no persiste saldos ni duplica stock por proyecto. |
| Fabricación | Interfaz existente y fuente reutilizable; dominio incompleto | Consume el summary oficial Legacy o Smart Cut activo y válido sin recalcular geometría, candidatos ni costos. Respeta el modo de solo lectura; checklist, progreso y notas no son todavía un dominio durable. |
| Material Calculator | Operativo | Distingue medidas originales comerciales, resolución de fabricación derivada y Smart Cut. Incluye resolución inteligente, cobertura modular, recomendaciones, propuestas reversibles y trazabilidad. La UI anidada definitiva de “Resolución de fabricación” permanece pendiente. |
| Smart Cut Engine / Cut Optimizer | Motor congelado y dominio de sesiones durable local/remoto con Realtime | Motor, Shelf, Best Fit, candidatos, evaluación, ranking, selección, recomendación, UI comparativa, Proposal y Active Mode tienen cierre técnico. Optimization Session conserva identidad de ejecución, Working Input, referencias y summary sin duplicar candidatos completos ni geometría; Quote conserva únicamente `activeSessionId`. Source, Adapter, repositories, Supabase Client Adapter, Repository Provider, versionado, storage, colas, Sync Engine manual, Realtime, Hook, Section, Summary y Selectors están implementados. CRUD, selección activa y consolidación de experiencia y ciclo de vida están implementados. Oversize Resolution Engine y Modular Coverage Engine permanecen fuera del motor: Smart Cut no calcula coberturas, no divide piezas ni conoce reglas comerciales; únicamente optimiza las piezas físicas resultantes. Faltan sincronización automática, resolución avanzada de conflictos, historial remoto, remanentes e integración definitiva con Inventario; Smart Cut Optimizer completo no se declara finalizado. |
| Instalación | Pendiente como dominio | Existe como etapa, permiso y estado de workflow; no existe aún un dominio durable independiente. |
| Entrega | Estado terminal implementado; dominio de evidencia pendiente | `Entregado` existe en Producción, activa read only y se refleja como `Terminada` en Cotización. Faltan evidencia, firma y un dominio de cierre operacional independiente. |
| Historial | Operativo parcialmente | Cuenta con motor, summary, respaldo local y fundamentos remotos. Los proyectos entregados pueden abrirse y consultarse sin permitir cancelación, cambio de estado o eliminación. No equivale todavía a un historial transversal completo de todos los dominios. |
| Dashboard / Inicio | Operational Center implementado | Consume `businessState.projects`, summaries, indicadores y actividad; incluye la tarjeta Recepción derivada de Business State y ofrece tarjetas expandibles reutilizables sin convertir la UI en fuente de verdad. |
| Inspector Inteligente | Interfaz funcional parcial | Calcula riesgos y acciones desde Cotización y consume de forma mínima el progreso y las incidencias del Reception Summary recibido desde Business State. Para proyectos entregados conserva únicamente accesos de consulta. |
| Project Companion | Interfaz funcional parcial | Consume resumen, alertas y actividad de Recepción para el proyecto contextual. Su integración transversal continúa parcial y el consumo común completo de Business State permanece pendiente. |
| Centro del Proyecto | Estructura visual existente | La FLDSMDFR empresarial consume Business State solo con settings y orden activa, y muestra el modo editable/solo lectura. El resto continúa mayormente informativo o vacío y no sincroniza `PROJECT_MASTER.md`. |
| Business State | Adapter central derivado implementado | Consume summaries oficiales sin persistencia ni lógica propia. Dashboard consume exclusivamente Business State; Inspector y Companion todavía no lo consumen por completo. |
| Identity Infrastructure | Implementada con convergencia pendiente | Normaliza, compara y preserva UUID, detecta duplicados y separa folio de identidad. Producción y Compras aún no consumen exclusivamente `createUuid.js`. |
| Integrity Audit | Implementada y validada operacionalmente | `runIntegrityAudit()` auditó el workspace real con almacenamiento local y Supabase autenticado: `READY WITH WARNINGS`, sin errores ni deuda legacy bloqueante. Persiste una advertencia de folio comercial duplicado y tres diferencias informativas. |
| Workspace | Operativo y durable | Bootstrap RPC idempotente, membresías, roles, permisos, settings, branding, auditoría y Realtime bajo RLS. Las mutaciones de settings se bloquean durante un proyecto entregado; `is_system_workspace` sigue pendiente. |
| Brand System | Infraestructura visual implementada | Tokens JS/CSS, tema, helpers, componentes `BR*` y capas de layout, accesibilidad e impresión disponibles. La adopción operativa continúa siendo incremental. |

### Estado visual transversal

El Brand System quedó consolidado en 25.2E y se importa mediante las capas CSS oficiales. Los componentes y el índice público están disponibles para adopción incremental. Un módulo no se considera más operativo o durable por recibir mejoras visuales.

## 10. Pendientes funcionales prioritarios

### Tarjetas del Inicio

Estado registrado para su evolución:

- Cotización — Implementada.
- Producción — Implementada.
- Compras — Implementada.
- Recepción — Implementada desde Business State.
- Inventario — Implementada como vista derivada.
- Fabricación — Implementada como vista derivada.
- Historial — Implementada como vista derivada.
- Instalación — Pendiente.
- Entrega — Pendiente.

Las tarjetas implementadas muestran estados y conteos derivados de Business State, se expanden dentro de Inicio y permiten abrir el módulo correspondiente. Realtime y las tarjetas de los dominios todavía incompletos permanecen pendientes. No deben depender de textos fijos.

### Panel izquierdo

Compras, Recepción e Inventario ya tienen base durable. 25.6C alcanza 25.6C.3.7 con Review Requests, colores derivados, bandejas, deep link, autorización final separada y correcciones físicas append-only por `reception_item` implementados. 25.6C.3.7 está cerrada técnicamente; permanece QA operacional complejo.

### Recepción

- 25.5B convirtió la experiencia en un centro transversal del workspace sin duplicar responsabilidades de Compras ni adelantar Inventario.
- 25.5C cerró RLS, Broadcast, Realtime, reconexión y sincronización de Recepción contra la infraestructura remota real.
- 25.6C integró la aceptación física con movimientos de Inventario, conservando propietarios y trazabilidad.
- Pendiente para el cierre operacional total de 25.6C: validación autenticada QA, pruebas multiusuario, cross-workspace y Realtime en dos sesiones, con Inventario, Material Fulfillment, reversión, reload, idempotencia e historial completo.

### Smart Cut

Orden oficial de evolución del módulo:

```text
Optimization Sessions
↓
Remote Adapter
↓
Remote Repository
↓
Supabase Client Adapter
↓
Tabla optimization_sessions
↓
RLS
↓
Conexión desde la aplicación
↓
Sync Engine
✓ OPTIMIZATION SESSIONS REMOTE PERSISTENCE COMPLETADA

Realtime
✓ IMPLEMENTADO Y VALIDADO BIDIRECCIONALMENTE
↓
Integración activeSessionId con Cotización
✓ COMPLETADA
↓
Consolidación de la experiencia y del ciclo de vida de las sesiones de optimización
✓ COMPLETADA Y VALIDADA
↓
Resolución Inteligente de Piezas Sobredimensionadas y Cobertura Modular
✓ COMPLETADA LOCALMENTE
↓
Remanentes reutilizables
↓
Integración definitiva con Inventario
```

Remote Adapter, Remote Repository, Supabase Client Adapter, tabla SQL, RLS, trigger de protección de workspace, conexión desde la aplicación, Sync Engine manual, Realtime por Broadcast privado, integración de `activeSessionId` con Cotización, consolidación del ciclo de vida, Oversize Resolution y cobertura modular están implementados y validados en su alcance. Smart Cut continúa congelado y únicamente optimiza piezas físicas. Inventario por Movimientos tiene motor local, maduración 25.6A y persistencia remota 25.6B implementados; creación y reversión están validadas operacionalmente. Remanentes reutilizables será una integración industrial futura con Smart Cut, pero su propiedad durable pertenecerá exclusivamente a Inventario. Este orden no modifica las fases funcionales ni el roadmap general del ERP.

No se mantienen como pendientes del Smart Cut capacidades ya completadas de motor, geometría, estrategias, candidatos, evaluación, selección, UI, Proposal o Active Mode.

### Evolución prevista del dominio Optimization Sessions

Optimization Sessions evolucionará siguiendo el mismo contrato arquitectónico aplicado a Producción y Compras:

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
Synchronization
↓
Realtime
↓
Hook
↓
Section
↓
Summary
↓
Business State
```

Esta evolución incorpora persistencia y coordinación propias al dominio de sesiones, pero no convierte Smart Cut en propietario de datos empresariales. No modifica el Smart Cut Engine: el motor físico permanece congelado, determinista y desacoplado.

### Nueva cotización limpia

El reset atómico está implementado. Debe preservarse el contrato: cliente, medidas, materiales, accesorios y herrajes vacíos; números en cero; sin OT, compras, historial heredado ni estado anterior.

### Producción

Aunque su base durable existe, siguen abiertos:

- Validación operacional de la sincronización unidireccional canónica entre Cotización, Producción y Compras.
- Estado vivo y eventos Realtime sin canales duplicados.
- Tarjetas operativas por estado y resumen lateral de OT.
- Historial completo de cambios.
- Prevención de escrituras originadas por eventos remotos.

Ya implementados: eliminación segura transversal, autorización exclusiva Owner, auditoría destructiva, limpieza de dependencias y protección contra resurrección. Una orden `Entregado` no puede avanzar ni actualizarse desde el hook, y la aplicación bloquea comandos relacionados. No existe todavía una constraint específica de base de datos que convierta este bloqueo de aplicación en una regla durable frente a clientes externos.

### Bug conocido independiente

La sincronización bidireccional entre **Notas internas** y **Observaciones** puede restaurar el texto cuando el usuario lo elimina completamente. Debe corregirse en una fase separada, salvo que bloquee el trabajo activo.

## 11. Pendientes de arquitectura

- Mantener la evidencia operacional de 25.2C fuera del código y repetir la auditoría después de futuros endurecimientos de esquema o constraints.
- No iniciar reparación legacy mientras la evidencia no demuestre su necesidad; 25.2C concluyó con `requiresLegacyRepair: false`.
- Activar constraints únicamente después de validación adicional, respaldo y rollback documentado.
- Converger la generación UUID de Producción y Compras hacia `createUuid.js` sin regenerar identidades existentes.
- Evaluar en una fase futura si el estado terminal `Entregado` requiere enforcement adicional en base de datos; actualmente la protección es de motor, hooks y UI.
- Revisar y dividir `useQuotes.js`.
- Reducir `QuoteSection.jsx`.
- Revisar `useProduction.js`.
- Reducir `ProductionSection.jsx`.
- Optimizar el chunk principal de Vite, actualmente superior a 500 kB, sin mezclar ese trabajo con cambios funcionales.
- No introducir Context sin necesidad demostrada.
- Evitar lógica de negocio en componentes y fuentes de verdad duplicadas.
- Mantener una sola suscripción Realtime por workspace.
- Mantener la prohibición de escrituras remotas o nuevas operaciones pendientes provocadas por eventos Realtime.
- Conservar merge por UUID, `updatedAt` y `version`.
- Completar el contrato arquitectónico por dominio sin rediseñar módulos que puedan evolucionar incrementalmente.
- Definir sincronización automática y reintentos únicamente con política explícita de idempotencia.
- Diseñar una resolución explícita de operaciones `failed` y `conflict` sin merge automático.
- Mantener el dominio desacoplado de Supabase.
- Incorporar historial remoto consolidado manteniendo Quote como fuente de verdad de la entrada de material y de la referencia activa.
- Proteger credenciales y secretos exclusivamente fuera del frontend.
- No sustituir el análisis de relaciones por cascadas indiscriminadas.
- Delegar la propiedad durable de remanentes a Inventario; Smart Cut solo podrá consumirlos y proponer su uso.
- **Prioridad alta:** diseñar la UI definitiva de **Resolución de fabricación** manteniendo visibles únicamente las medidas originales y presentando las piezas derivadas en un acordeón expandible y contraíble bajo su pieza fuente. Debe conservar trazabilidad, permitir deshacer la resolución y distinguir sin ambigüedad diseño comercial y fabricación.

### Evolución pendiente de infraestructura visual

- Consolidar estilos legacy repetidos de forma incremental.
- Evitar dependencias entre CSS visual y reglas de negocio.
- Documentar excepciones y estilos legacy.
- Continuar la estrategia de migración por superficie.
- Conservar los selectores requeridos por pruebas y automatización.
- Verificar contraste, responsive e impresión.
- Reducir progresivamente estilos duplicados.
- Definir versión oficial del Design System.
- Mantener historial de cambios visuales.
- Preparar la futura Biblioteca Visual para consulta interna.

## 12. Fuentes reutilizables del ERP

Patrón oficial:

Módulo ERP → Fuente reutilizable → Business State → Inicio / Inspector / FLDSMDFR / Companion / Reportes

Las fuentes reutilizables no dependen de React, JSX, DOM ni componentes. Los cálculos permanecen dentro del dominio propietario.

| Orden | Dominio | Estado verificable |
|---:|---|---|
| 1 | Cotizaciones | Summary implementado y consumido por Business State. |
| 2 | Producción | Summary implementado y consumido. |
| 3 | Compras | Summary y selectors implementados y consumidos. |
| 4 | Inventario | Dominio durable local/remoto por movimientos; tabla, RLS, adapters, repositories, Sync, Realtime, reconciliación, Hook, selectors y Summary implementados. Creación y reversión validadas; offline completo, conflicto de versión y aislamiento manual específico implementados, pendientes de QA de Inventario según §16. Transferencia implementada técnicamente, con QA operacional diferida por alcance de producto; no bloquea 25.6. |
| 5 | Clientes | Summary derivado disponible; dominio propio pendiente. |
| 6 | Finanzas | Summary derivado disponible; dominio administrativo pendiente. |
| 7 | Fabricación | Summary y lectura del plan Legacy o del candidato Smart Cut activo y válido disponibles; Fabricación no recalcula la optimización. Persistencia operacional propia pendiente. |
| 8 | Recepción e Historial | Reception Summary implementado y consumido por Business State; Historial transversal completo pendiente. |
| 9 | Integración con Business State | Adapter 2.0 implementado con salud, riesgos, pendientes, actividad, alertas, indicadores, última actualización y read only. Consumidores completos pendientes. |
| 10 | Smart Cut | Summary físico, candidatos, ranking, recomendación, Proposal y resolución de Active Mode disponibles como fuentes puras. Optimization Sessions es durable local/remoto y dispone de Remote Adapter, Remote Repository, Supabase Client Adapter, tabla, RLS, conexión de aplicación, cola persistente, Sync Engine manual y Realtime por workspace. CRUD, `activeSessionId` y consolidación de experiencia y ciclo de vida están implementados; automatización e historial remoto permanecen pendientes. |

## 13. Centro del Proyecto

El Centro del Proyecto nació en Fase 23 como estructura de gobierno y memoria. Su alcance conceptual incluye:

- Dashboard.
- Roadmap.
- Pendientes y Pendientes ChatGPT.
- Ideas y decisiones.
- Arquitectura y documentación.
- Historial y visión.
- Estado y métricas del proyecto.
- Salud del proyecto.
- Próximo sprint.

Actualmente existen superficies para la FLDSMDFR empresarial y la FLDSMDFR del Sistema. La empresarial ya invoca `getBusinessState()` y puede mostrar el nombre del workspace, modo editable/solo lectura, pendientes, alertas e indicadores cuando recibe sus fuentes. Objetivos, roadmap, decisiones, historial documental y próximos pasos permanecen vacíos porque no existe una fuente canónica para ellos. `PROJECT_MASTER.md` es documentación manual y no sincroniza automáticamente con la UI.

Pendientes:

- Sustituir contenido fijo por datos estructurados.
- Implementar sincronización segura.
- Incorporar roadmap visual y gestor de pendientes.
- Registrar decisiones, salud y métricas reales.
- Hacer navegable la documentación sin convertir la UI en fuente de verdad.
- Incorporar una Biblioteca Visual de solo lectura basada en el Brand Book.
- Mostrar en esa biblioteca paleta, tipografías, espaciados, logos, componentes y estados.
- Mantener la documentación como fuente de verdad; la UI únicamente la presenta.
- No destinar a la Biblioteca Visual más tiempo del límite definido para el Centro del Proyecto.

También podrá mostrar:

- Versiones del logotipo.
- Colores oficiales.
- Componentes aprobados.
- Tokens activos.
- Historial del Brand System.
- Cambios entre versiones.

La Biblioteca Visual será únicamente de consulta. No será fuente de verdad.

El Centro no debe frenar el ERP, convertirse en dependencia del sistema visual ni consumir más del límite de tiempo establecido.

## 14. FLDSMDFR empresarial y FLDSMDFR del Sistema

### Empresarial

Pertenece a cada workspace y representa únicamente su negocio:

- Estado, objetivos y roadmap empresarial.
- Pendientes operativos y decisiones empresariales.
- Historial, indicadores y próximos pasos.
- Recomendaciones y origen de la información.

Business State será su adapter de lectura. No debe consultar componentes ni acceder a información de otro workspace.

### Sistema

Pertenece al desarrollo interno de BRTuNegocio y solo será visible en el workspace interno para propietarios autorizados:

- Arquitectura y deuda técnica.
- Decisiones técnicas y roadmap del software.
- Tests y estado del repositorio.
- Pendientes de desarrollo y salud técnica.

La información empresarial y la del Sistema nunca se mezclan.

Pendiente explícito: reemplazar la condición temporal

```js
settings.company_name === "ALUXOR / BosqueReal"
```

por el indicador permanente:

```text
is_system_workspace
```

Este cambio no forma parte de la actualización documental actual.

## 15. Decisiones vigentes

| Fecha | Decisión | Motivo | Estado |
|---|---|---|---|
| Pendiente de validación | No usar Context hasta comprobar una necesidad real. | Evitar complejidad y fuentes duplicadas. | Vigente |
| Pendiente de validación | El Centro del Proyecto no consumirá más de 15–20% del sprint. | Mantener prioridad en operación real. | Vigente |
| 22/07/2026 | Producción es autoridad operacional después de crear una OT. | Separar el estado comercial del estado operativo. | Implementada |
| 30/07/2026 | Recepción depende de partidas de Compras y es propietaria únicamente de lo recibido. | Preservar trazabilidad, permitir eventos parciales y evitar duplicar lo comprado o adelantar Inventario. | Implementada en 25.5 |
| 31/07/2026 | Compras consulta el estado recibido, pero Recepción es la única autoridad para confirmar físicamente cantidades aceptadas, dañadas, rechazadas y faltantes. | Evitar duplicidad funcional y conservar una sola fuente de verdad sobre la llegada de materiales. | Implementada en 25.5B |
| 31/07/2026 | Recepción debe operar como centro transversal del workspace y no quedar limitada al proyecto activo. | Permitir recibir materiales de cualquier compra o proyecto y convertir Recepción en un área operativa real. | Implementada en 25.5B |
| 31/07/2026 | Los eventos y notificaciones de Recepción serán vistas derivadas del dominio propietario, no copias editables en cada módulo. | Comunicar incidencias y resultados sin escrituras cruzadas ni fuentes duplicadas. | Implementada en 25.5B |
| 31/07/2026 | La eliminación definitiva de una Orden de Producción será un comando destructivo transaccional y transversal, no un DELETE directo desde la interfaz. | Evitar relaciones huérfanas, borrados parciales y reapariciones por almacenamiento local, sincronización o Realtime. | Implementada y validada remotamente en 25.5D |
| 31/07/2026 | Solo un propietario autenticado y con membresía activa podrá eliminar una OT; la RPC repetirá la autorización con `auth.uid()`. | El rol canónico del workspace es la autorización destructiva; no se almacenan contraseñas, secretos ni códigos adicionales en el frontend. | Implementada y validada remotamente en 25.5D |
| 01/08/2026 | Las medidas comerciales nunca se reemplazan por las piezas físicas. | Las dimensiones introducidas por el usuario representan el trabajo vendido al cliente. Las divisiones de fabricación, cobertura modular y piezas derivadas pertenecen exclusivamente a fabricación y deberán mostrarse anidadas bajo la pieza original mediante “Resolución de fabricación”, nunca mezcladas con la lista principal de medidas. | Vigente; integración visual anidada pendiente |
| 02/08/2026 | Inventario se basa exclusivamente en movimientos. | Garantizar trazabilidad y derivar stock, reservas, disponibilidad, lotes, ubicaciones, Kardex y snapshots sin persistir saldos editables. | Implementada local y remotamente en 25.6, 25.6A y 25.6B; creación y reversión validadas operacionalmente |
| 03/08/2026 | Compras y Recepción pueden iniciar correcciones, pero ejecutan un solo contrato canónico de Compras. | Evitar reglas paralelas y conservar una fuente única para cantidades y precios actuales. | Implementada en 25.6C.3 |
| 03/08/2026 | Los valores actuales son corregibles y el pasado no se reescribe. | Cada corrección incrementa versión y agrega trazabilidad append-only con actor, rol, módulo, motivo y valores anterior/nuevo. | Implementada en 25.6C.3 |
| 03/08/2026 | Solo Owner puede depurar historial mediante RPC auditada. | Impedir `DELETE` genérico desde frontend y conservar evidencia de la acción destructiva. | RPC validada; Owner UI real pendiente |
| 04/08/2026 | Necesario, ordenado, comprado y recibido son cuatro cantidades distintas. | Separar requerimiento, compromiso, compra vigente y aceptación física. | Implementada en 25.6C.3.3 |
| 04/08/2026 | Inventario reconoce únicamente cantidades aceptadas mediante movimientos. | Evitar que lo ordenado o comprado cree existencia física. | Implementada en 25.6C |
| 04/08/2026 | Recepción puede estar completa respecto de lo comprado mientras la compra sigue pendiente respecto de la necesidad. | Representar correctamente faltantes del proyecto sin falsificar el estado de recepción. | Implementada en 25.6C.3.3 |
| 26/07/2026 | Shelf seguirá siendo el fallback oficial. | Mantener continuidad total con cotizaciones Legacy y garantizar una optimización disponible ante candidatos ausentes u obsoletos. | Implementada |
| 26/07/2026 | No duplicar geometría. | El motor es la única autoridad del cálculo físico; Optimization Sessions conserva referencias y summary, mientras UI, Proposal, Quote y Fabricación solo consumen sus resultados. | Vigente |
| 26/07/2026 | No duplicar candidatos. | Active Mode y Optimization Sessions guardan referencias y estado, no copias paralelas de soluciones. | Vigente |
| 26/07/2026 | Quote sigue siendo la fuente de verdad persistente de la entrada de material y de la referencia activa. | Optimization Sessions posee durablemente cada ejecución; Smart Cut calcula y propone sin persistir geometría ni aplicar resultados automáticamente. | Vigente |
| 26/07/2026 | Optimization Sessions existirán antes que los remanentes reutilizables. | Dar identidad, trazabilidad y ciclo de vida a cada ejecución antes de relacionar sobrantes. | Implementada como dominio durable local y remoto |
| 26/07/2026 | Optimization Sessions evolucionará como dominio independiente. | Optimization Sessions conservará identidad, versionado, persistencia y sincronización propios sin convertir Smart Cut en propietario de datos empresariales. | Implementada con Sync Engine manual y Realtime por workspace; automatización pendiente |
| 26/07/2026 | El Remote Repository permanecerá desacoplado del proveedor. | El dominio dependerá únicamente de un contrato abstracto de cliente remoto. Supabase será una implementación concreta y sustituible. | Implementada |
| 26/07/2026 | Inventario será propietario de los remanentes. | Evitar un inventario paralelo dentro de Smart Cut y conservar la arquitectura por movimientos. | Pendiente de implementación |
| 26/07/2026 | Fabricación nunca recalculará la optimización. | Consumir el summary oficial evita divergencias físicas y económicas. | Implementada en el consumo actual |
| 26/07/2026 | Smart Cut permanecerá desacoplado del ERP. | El motor no conoce React, Quote, Fabricación, Supabase ni persistencia y solo expone resultados deterministas. | Vigente |
| 29/07/2026 | `material.optimization.activeSessionId` es la única referencia activa de Cotización. | Evitar `isActive` y otras fuentes paralelas; Realtime de sesiones sincroniza contenido y Realtime de Cotizaciones sincroniza la referencia. | Implementada y validada bidireccionalmente |
| 24/07/2026 | Business State es el adapter central de lectura y solo agrega summaries existentes. | Ofrecer una vista empresarial única sin apropiarse de datos, persistencia ni reglas de dominio. | Implementada en 25.3 |
| Pendiente de validación | FLDSMDFR empresarial y del Sistema nunca se mezclan. | Separar negocio y desarrollo interno. | Vigente |
| 22/07/2026 | UUID es identidad y folio es referencia comercial. | Evitar colisiones y merges incorrectos. | Implementada |
| 22/07/2026 | No activar constraints sin auditoría real. | Prevenir fallos o pérdida de continuidad por deuda legacy. | Vigente |
| 22/07/2026 | `Entregado` es terminal y activa el modo de solo lectura desde Production Engine. | Preservar el proyecto finalizado como evidencia histórica y evitar mutaciones posteriores. | Implementada en motor, hooks y UI |
| 22/07/2026 | El modo de solo lectura deriva únicamente del estado canónico de Producción. | Evitar flags paralelos y reglas repetidas por módulo. | Implementada |
| 22/07/2026 | `runIntegrityAudit()` es la entrada pública única de la auditoría 25.2C. | Garantizar una secuencia determinista de auditoría local, remota, comparación y reporte. | Implementada y validada operacionalmente |
| 22/07/2026 | Las pruebas con mocks no cierran 25.2C. | La readiness para 25.2D requiere evidencia de los datos reales bajo sesión y RLS reales. | Cumplida mediante auditoría real el 23/07/2026 |
| 23/07/2026 | Dos entidades con UUID distintos nunca se fusionan por compartir folio. | El folio es referencia comercial; la identidad canónica pertenece al UUID dentro del workspace. | Vigente |
| 23/07/2026 | Toda restricción SQL futura debe estar precedida por auditoría real, respaldo y rollback documentado. | Conservar continuidad operacional y evitar endurecer datos sin evidencia suficiente. | Vigente |
| 23/07/2026 | El siguiente folio comercial se calcula sobre referencias existentes del workspace y se reintenta ante colisión concurrente. | Evitar reutilización de folios sin convertirlos en identidad. | Vigente |
| 23/07/2026 | Toda escritura durable de Cotización, Producción y Compras debe validar workspace y relaciones canónicas antes de persistir. | Impedir escrituras cruzadas y entidades operativas huérfanas. | Vigente |
| 23/07/2026 | Una colisión `23505` de folio no autoriza regenerar ni reemplazar el UUID. | Preservar identidad, idempotencia y trazabilidad. | Vigente |
| 23/07/2026 | 25.2D cerró con hardening lógico y de repositories, no con restricciones SQL. | El SQL futuro requiere respaldo, rollback y ejecución incremental. | Vigente |
| Pendiente de validación | No rediseñar módulos que puedan completarse incrementalmente. | Reducir riesgo y conservar valor operativo. | Vigente |
| 25/07/2026 | Inicio opera como Centro de Operaciones mediante Business State. | Mostrar el estado real del flujo sin crear una fuente paralela. | Implementada en 25.4 |
| Pendiente de validación | Una función importante requiere operación, documentación, roadmap y pendientes derivados para cerrarse. | Evitar cierres únicamente visuales. | Vigente |
| 22/07/2026 | Implementar el Brand System en 25.2E, después de integridad y antes de Business State 2.0. | Evitar retrabajo visual en los nuevos módulos sin distraer la auditoría ni modificar lógica operativa. | Completada |
| 22/07/2026 | La identidad visual será una capa transversal separada de las reglas del dominio. | Preservar estabilidad, mantenibilidad y fuentes de verdad. | Vigente |
| 22/07/2026 | El Brand System adoptará una estrategia incremental por superficie. | Reducir riesgo y facilitar la validación visual. | Vigente |
| 22/07/2026 | Después de finalizar 25.2E, los cambios globales del sistema visual deberán pasar por revisión arquitectónica. | Evitar regresiones visuales y mantener consistencia. | Vigente |

Las fechas no verificables se mantienen como **Pendiente de validación**; no se atribuyen autores sin evidencia.

## 16. Estado de 25.6 y próximo sprint oficial

### 25.6 — Inventario por Movimientos

**Estado:** 25.6 COMPLETADA LOCALMENTE; 25.6A COMPLETADA LOCALMENTE; 25.6B IMPLEMENTADA Y VALIDADA OPERACIONALMENTE EN CREACIÓN Y REVERSIÓN. El cierre operacional de 25.6C no promueve automáticamente la fase general: permanecen como alcance futuro las integraciones de Fabricación durable, Instalación, Entrega y remanentes.

**Propósito:** construir un inventario durable cuya fuente de verdad sean movimientos y transacciones trazables. Las existencias no se editan como cantidades libres ni se sostienen mediante acumulados manuales; se derivan de entradas, salidas, reservas, liberaciones y correcciones, sin trasladar esa propiedad a Recepción ni a Smart Cut.

**Alcance actual de producto:** ALUXOR / BosqueReal opera con una sola sucursal. Las transferencias entre ubicaciones/sucursales no son requisito operacional de cierre de 25.6. Los movimientos normales y la acción `Inventario General → tarjeta de material → Movimiento` permanecen dentro del alcance actual. Este ajuste documental no cierra automáticamente 25.6.

**Transferencias — IMPLEMENTADA TÉCNICAMENTE / DIFERIDA POR ALCANCE DE PRODUCTO.** Se conserva la UI de transferencia en `InventorySection` y el recorrido `createInventoryTransfer → useInventory.createTransfer → Application Repository → Sync Engine → Remote Repository`. La infraestructura durable crea el par `TRANSFER_OUT` + `TRANSFER_IN` con `transferId` compartido, origen/destino, lote opcional y validación de stock; incluye persistencia/sincronización durable y Realtime de reconciliación. La acción de transferencia utiliza ese contrato, no la creación de un movimiento manual aislado. Su QA operacional completa queda diferida: no se declara fallida, eliminada ni validada manualmente.

**Destino futuro:** la transferencia durable se conserva como base técnica reutilizable para una edición empresarial/multi-sucursal, denominada provisionalmente **BRTuNegocio Empresa** o **BRTuNegocio Mediana-Grande**, sin nombre comercial definitivo. Ese alcance futuro puede contemplar múltiples sucursales y almacenes, stock por sede, transferencias entre ubicaciones e inter-sucursal, materiales en tránsito, permisos por sucursal/almacén, trazabilidad origen → destino y conciliación de inventario entre sedes. Estas capacidades futuras no se declaran implementadas por la existencia del contrato de transferencia.

**Pendientes reales para el cierre operacional de 25.6:** contraste del código y pruebas existentes con la evidencia documentada de 25.6B/25.6C; no constituye una nueva ejecución de QA.

| Punto | Clasificación | Evidencia y validación restante |
|---|---|---|
| Offline completo de Inventario | Implementado pendiente de QA | `inventoryStorage`, Pending Operations y `inventorySyncEngine` implementan persistencia local, cola y Sync manual; `inventoryRemoteSync.test.js` contempla creación offline, compactación y sincronización. 25.6C ya acredita reload y offline/online en Recepción → Inventario. Falta acreditar el recorrido completo específico de movimientos normales de Inventario: creación/reversión offline, conservación tras reload, reconexión y Sync sin duplicados. |
| Conflicto de versión | Implementado pendiente de QA | Versioning, Repository y Sync detectan conflictos; la cola conserva `conflict` y snapshot remoto, y el Hook expone conflictos. `inventoryInfrastructure.test.js` e `inventoryRemoteSync.test.js` contienen casos de versión obsoleta y conservación del conflicto. Falta QA autenticado con conflicto de Inventario provocado entre sesiones; el registro de conflictos 0 en 25.6C no valida ese escenario. Esta clasificación corresponde a detección y preservación, no afirma una UI de resolución implementada. |
| Aislamiento manual específico entre workspaces | Implementado pendiente de QA | Storage y pendientes se separan por workspace; Repository y Realtime filtran el workspace, con casos en `inventoryInfrastructure.test.js`. 25.6C ya documenta aislamiento QA/BosqueReal. Falta QA específico de Inventario al alternar workspaces con movimientos propios, pendientes offline y eventos Realtime, verificando que UI y sincronización no crucen datos. |

Los tres pendientes anteriores conservan el bloqueo de cierre operacional general; transferencia queda excluida de ese criterio. Se mantiene el cierre técnico y operacional ya documentado de 25.6C/25.6C.3.7.

Implementado en 25.6:

- Inventory Engine puro con 14 tipos oficiales de movimiento.
- Adapter, Repository local, Versioning, Storage y Pending Operations.
- Sync Engine y Realtime desacoplados.
- Hook, Selectors, Summary y consumo derivado en Business State.
- Stock, reservado y disponible calculados exclusivamente desde movimientos.

25.6A — Maduración del dominio, **COMPLETADA LOCALMENTE**:

- lotes y estados de calidad opcionales;
- ubicaciones físicas opcionales;
- transferencias vinculadas y validación de pares OUT/IN;
- Kardex determinista con saldos corridos;
- snapshots derivados únicamente en memoria;
- selectores avanzados por material, lote, ubicación, proyecto y referencias;
- compatibilidad con movimientos y summary legacy.

Validación local: 116 archivos y 996 pruebas aprobadas, build correcto, warning conocido de bundle superior a 500 kB y `git diff --check` limpio.

25.6B — Persistencia remota, **IMPLEMENTADA Y VALIDADA OPERACIONALMENTE EN CREACIÓN Y REVERSIÓN**:

- `public.inventory_movements` es la única fuente de verdad; `material_id` es `text` hasta que exista un UUID canónico común de material;
- conserva los 14 tipos oficiales y añade `REVERSAL` como tipo técnico; lotes y ubicaciones son opcionales, las transferencias comparten `transfer_id` y las reversiones usan `reversal_of_id`;
- las relaciones con Cotización, Producción, Compras y Recepción se validan dentro del workspace, sin FKs destructivas que impidan eliminar una OT de forma segura;
- RLS aplicada con `inventory_movements_select_member`, `inventory_movements_insert_manager` e `inventory_movements_update_manager`; no existe deliberadamente una política DELETE para usuarios autenticados;
- Broadcast privado por workspace mediante `inventory_movements_realtime_member` y trigger `inventory_movements_broadcast_changes`;
- triggers `inventory_movements_prepare_insert`, `inventory_movements_prepare_update` e `inventory_movements_validate_relations` aplicados remotamente;
- RPC `reverse_inventory_movement` y `create_inventory_transfer` aplicadas como `SECURITY INVOKER`: la sesión autenticada y RLS continúan controlando las operaciones;
- `authenticated` puede ejecutar ambas RPC y `private.inventory_movement_effect(text, numeric, jsonb)`; `anon` no dispone de esos permisos y `service_role` y `postgres` los conservan;
- la reversión conserva el original y crea un movimiento `REVERSAL`; la transferencia crea `TRANSFER_OUT` y `TRANSFER_IN` en una transacción; ambas operaciones son idempotentes según sus identificadores;
- Remote Adapter, Remote Repository, Supabase Client Adapter, Application Repository, Repository Provider, Connectivity Provider, Sync Engine concreto, Pending Operations por workspace, Realtime, reconciliación y Hook conectados;
- `InventorySection` conserva la vista legacy y añade una sección durable separada con formulario manual, movimientos confirmados, reversión, sincronización manual y estados de conexión, Realtime, pendientes y conflictos. No constituye todavía el Centro Operativo final de Inventario.

Migraciones aplicadas local y remotamente:

- `20260802072750_create_inventory_movements.sql`;
- `20260802132526_allow_inventory_movement_effect_execution.sql`;
- `20260802132932_allow_inventory_movement_effect_execution.sql`;
- `20260803013242_consolidate_purchase_reception_profitability.sql`;
- `20260803013633_index_receptions_reverted_by.sql`;
- `20260803073910_material_traceability_and_purchase_amendments.sql`;
- `20260803181739_fix_material_trace_owner_purge_result.sql`;
- `20260803181935_correct_material_trace_owner_purge_timestamp.sql`;
- `20260803182726_fix_purchase_amendment_reason_validation.sql`;
- `20260804015529_add_purchased_quantity_contract.sql`;
- `20260804015930_backfill_purchased_quantity_from_receptions.sql`;
- `20260804021415_fix_purchase_amendment_coalesce_contract.sql`;
- `20260804185534_add_required_quantity_contract.sql`.

Las dos migraciones de permisos son idénticas, redundantes, inocuas e idempotentes. Se conservan porque ambas forman parte del historial remoto; no corresponde eliminarlas ni usar `migration repair`.

Validación operacional confirmada en la aplicación real:

- creación remota, aparición inmediata en UI, actualización de Summary y movimientos confirmados con versión 1;
- conexión online, Realtime `Subscribed`, ausencia de operaciones pendientes y ausencia de conflictos en la prueba;
- reversión remota con creación de `REVERSAL`, conservación del original y retorno del saldo derivado a cero;
- el error previo `permission denied for function inventory_movement_effect` quedó resuelto mediante las migraciones de permisos aplicadas.

Validación del repositorio: `npm test` aprobó 123 archivos y 1162 pruebas; `npm run build` finalizó correctamente; bundle principal de 1,665.76 kB minificado y 446.54 kB gzip, con el warning conocido de chunk superior a 500 kB; `git diff --check` limpio. No hubo commit ni push y no se afirma que el working tree esté limpio.

### Fase 25.6C — Integración Recepción → Inventario

**Estado:** **COMPLETADA / CERRADA TÉCNICA Y OPERACIONALMENTE**. La subfase 25.6C.3.7 — Correcciones físicas reales de Recepción también queda **CERRADA TÉCNICA Y OPERACIONALMENTE**.

```text
Compras → Recepción → Inventory reconciliation → Inventory Summary → Business State → Dashboard
```

Implementado:

- creación determinista e idempotente de `ENTRY_PURCHASE` desde cantidades aceptadas;
- compensación mediante `REVERSAL`, sin eliminar movimientos ni reescribir historia;
- historial de recepciones, observaciones, incidencias, costos reales y rentabilidad;
- materiales “Otros” y libres derivados desde Inventory Summary;
- enmiendas de compra versionadas, `expectedVersion`, eventos append-only y depuración auditada exclusiva de Owner;
- índice operativo de Recepción, detalle por proyecto e Inventario General sin duplicar stock;
- `purchasedQuantity`, `purchasedAt`, `requiredQuantity` y `materialFulfillment.js` como contrato reutilizable;
- separación de pendientes de compra, recepción y necesidad del proyecto;
- Realtime validado en dos ventanas y migraciones locales/remotas alineadas.
- QA autenticado real en `ALUXOR QA`, proyecto `QA 25.6C.3.7 - Recepción Compleja`, con aislamiento QA/BosqueReal, reload, offline/online, Realtime y segundo Sync sin duplicación.
- Estados operacionales derivados: compra incompleta → `Esperando compras`; compra completa + recepción incompleta → `Esperando recepción`; compra y recepción completas sin incidencias → `Materiales disponibles`. `getPurchaseMaterialState()` usa Material Fulfillment/cantidades y no `item.status` legacy.
- Inventario por proyectos corregido: la cadena `Quote sourceId → Purchase Item sourceId → Purchase Item id → Inventory Movement metadata.purchaseItemId` reconoce Melamina requerida 10, disponible 20 y faltante 0; `hoja(s)` se normaliza a `hoja` y “Preparar compra” solo aparece con faltantes reales.

Evidencia final: 155 archivos de pruebas y 1364 pruebas aprobadas; `npm run build` correcto; `git diff --check` correcto; migraciones local/remoto alineadas hasta `20260810162557`. Persiste el warning conocido de bundle Vite superior a 500 kB, sin regresión. Sync permanece manual. No hubo commit ni push.

#### 25.6C.3.7 — Correcciones físicas reales de Recepción

**Estado:** **CERRADA TÉCNICA Y OPERACIONALMENTE**.

Problema resuelto: Recepción puede corregir datos físicos incorrectos sin mutar el `reception_item` original, borrar historia, modificar Compra directamente, crear recepciones artificiales, escribir Inventario desde la UI o perder trazabilidad multiusuario.

Ejemplo validado: `acceptedQuantity = 20` original, corrección física efectiva `20 → 8`; la proyección conserva `original = 20` y expone `effective = 8`.

Arquitectura final:

```text
Reception Item original
        ↓
Purchase Quantity Review
        ↓
Review / autorización Owner-Admin
        ↓
Reception Item Real Correction
        ↓
Proyección efectiva
        ↓
Recepción · Compras · Material Fulfillment · Inventario · Historial
        ↓
Realtime
        ↓
Estado operacional derivado
```

`DURABLE STATE ≠ OPERATIONAL STATE`: una Review puede conservar `correction_authorized` aunque ya no exista acción física pendiente. El pendiente se calcula exclusivamente mediante `isPurchaseQuantityReviewPhysicalActionPending()`, usando cantidades efectivas, relaciones exactas y recepción activa.

Subfases cerradas técnicamente:

- **25.6C.3.7A:** contrato append-only y proyección pura por `reception_item`.
- **25.6C.3.7B:** cantidades efectivas integradas en Reception Engine, selectors, summaries y costos.
- **25.6C.3.7C:** Material Fulfillment e Inventario integrados mediante compensaciones deterministas. Usa `CORRECTION OUTPUT` y `CORRECTION ENTRY`, nunca `REVERSAL` parcial. El delta es `desiredPhysicalQuantity - currentPhysicalQuantity` y la idempotencia es determinista.
- **25.6C.3.7D:** persistencia Supabase con tabla append-only, Adapter, Repository, Hook, RPC create/reverse, `expectedVersion`, idempotencia, RLS, Realtime INSERT y aislamiento por workspace.
- **25.6C.3.7E:** UI “Registrar datos reales” para cantidad aceptada real, motivo obligatorio, notas y datos físicos adicionales mediante `useReceptionItemRealCorrections.createCorrection()` y `create_reception_item_real_correction`.

La autorización física permite el caso `accepted = 10`, `requested = 8` mientras exista Review aprobada, `receptionId` explícita, recepción activa, relación exacta por workspace/Compra/partida/recepción y versión vigente.

Reviews: después de una corrección, `effectiveAcceptedQuantity <= requestedPurchasedQuantity` elimina la Review de las bandejas físicas, sin cambiar su estado durable ni eliminar historial. Si se revierte la corrección y vuelve a cumplirse `effectiveAcceptedQuantity > requestedPurchasedQuantity`, reaparece operacionalmente cuando su estado durable lo permite. `cancelled`, `completed`, `rejected` y recepciones revertidas nunca reaparecen.

Cancelación durable mediante `cancel_purchase_quantity_review_request`: Owner/Admin, transición append-only auditada, sin `DELETE`, `expectedVersion`, idempotencia, motivo obligatorio e historial preservado. Estados cancelables: `pending`, `approved`, `requires_reception_action`, `ready_for_final_approval` y `correction_authorized`. No se cancela una Review con correction física activa no revertida.

Inventario no modifica el `ENTRY_PURCHASE` original. Para `20 → 8`, conserva `ENTRY_PURCHASE 20` y produce `CORRECTION OUTPUT 12`, con existencia neta efectiva 8; repetir la reconciliación es no-op. Una recepción revertida no genera correcciones que la resuciten.

Realtime reconcilia por UUID/versión y nunca origina escrituras. `Correction INSERT` y reversal actualizan la proyección; `DELETE` de Review/correction proveniente exclusivamente del purge seguro elimina estado local y evita resurrección.

Purge seguro de OT: `delete_production_order_safely` elimina explícitamente, dentro de la transacción Owner-only auditada, en este orden:

```text
reception_item_real_corrections
        ↓
purchase quantity reviews
        ↓
reception_items
        ↓
receptions
        ↓
purchase_items
        ↓
purchases
        ↓
production order
```

No se añadió `ON DELETE CASCADE`.

Migraciones aplicadas y alineadas local/remoto:

- `20260806143018_reception_item_real_corrections.sql`
- `20260807091952_allow_purchase_quantity_physical_correction_authorization.sql`
- `20260808073358_cancel_purchase_quantity_review_request.sql`
- `20260808084500_extend_production_order_safe_delete_for_reception_corrections.sql`
- `20260810162557_create_workspace.sql`

Casos validados técnica y operacionalmente: escenario autenticado `ALUXOR QA` / `QA 25.6C.3.7 - Recepción Compleja`; compras incompletas → `Esperando compras`; compras completas con recepción incompleta → `Esperando recepción`; compras y recepción completas sin incidencias → `Materiales disponibles`; corrección física `20 → 8`; preservación del original `20`; corrección append-only; Material Fulfillment con faltante 2; `ENTRY_PURCHASE 20 + CORRECTION OUTPUT 12 = existencia 8`; segundo Sync no-op; Realtime `Subscribed`; reload y offline/online conservados; pendientes 0 y conflictos 0; aislamiento por workspace, cancelación durable, historial y ausencia de duplicados.

### VALIDACIÓN OPERACIONAL COMPLEJA — COMPLETADA

El escenario autenticado real en `ALUXOR QA` combinó varias partidas y recepciones, Review, autorización, correction, Realtime en segunda sesión, Inventario, Material Fulfillment, reaparición del pendiente, cancelación durable, aislamiento entre partidas, persistencia tras reload, ausencia de duplicados e historial completo.

Flujo oficial de revisión de reducción:

```text
Solicitud de revisión
↓
Owner/Admin revisa y aprueba revisión
↓
Recepción verifica físicamente y corrige únicamente la partida afectada
↓
Owner/Admin autoriza corrección final
↓
Compras modifica el purchasedQuantity autorizado
↓
Recepción queda consistente e Inventario permanece derivado
```

`approved` y `complete` no modifican Compra automáticamente. La autorización final se mantiene separada.

Deep Link y resaltado: la solicitud conserva `receptionId`; Owner asigna explícitamente la recepción correcta y Recepción abre exactamente ese UUID, hace scroll y aplica resaltado temporal, sin inferir primera ni última recepción. La UI puede resaltar recepción, partida o revisión pendiente sin alterar datos.

25.6C no conserva pendientes funcionales internos. Las capacidades futuras de Fabricación durable, Instalación, Entrega, remanentes, sincronización automática e historial remoto consolidado permanecen fuera de esta fase.

Secuencia posterior oficial:

```text
25.6 — Motor de Inventario por Movimientos
✓ IMPLEMENTADO LOCALMENTE
↓
25.6A — Maduración del dominio
✓ COMPLETADA LOCALMENTE
↓
25.6B — Persistencia remota
✓ IMPLEMENTADA Y VALIDADA EN CREACIÓN Y REVERSIÓN
↓
25.6C — Integración Recepción → Inventario
✓ COMPLETADA / CERRADA TÉCNICA Y OPERACIONALMENTE
25.6C.3.7 ✓ CERRADA TÉCNICA Y OPERACIONALMENTE
```

### Fase 25.4 — Operational Center

**Estado:** COMPLETADA.

**Resultado:** Inicio consume Business State como Centro Operativo sin crear una pantalla, ruta o fuente de verdad paralela.

Componentes verificados:

- selección automática y manual de proyecto en foco;
- `FocusSelector`, `FocusCard`, `ExpandableDashboardCard`, `BusinessIndicators` y `DashboardActivity`;
- tarjetas de Cotización, Producción, Compras, Inventario, Fabricación e Historial derivadas de Business State;
- una sola tarjeta expandida a la vez;
- navegación explícita después de revisar el contenido expandido;
- consumo de `businessState.projects`, summaries, indicadores y actividad.

La implementación quedó integrada mediante `3c7affb` (`feat(operations): add operational center and BR Material Studio`). Inspector Inteligente, Project Companion y Centro del Proyecto conservan su evolución incremental pendiente sin invalidar el cierre de 25.4.

### Fase 25.5 — Recepción Durable

**Estado:** COMPLETADA EN CÓDIGO Y VALIDADA AUTOMÁTICAMENTE; VALIDACIÓN OPERACIONAL REMOTA PENDIENTE.

**Resultado:** Recepción dejó de utilizar estado React como persistencia principal y adoptó el contrato durable oficial:

```text
Purchase
↓
Purchase Item
↓
Reception
↓
Reception Item
↓
Summary
↓
Business State
```

Capas implementadas:

- Engine puro para crear, validar, normalizar y versionar recepciones.
- Adapter local/remoto `camelCase` ↔ `snake_case`.
- Repository local, Repository remoto y Application Repository desacoplados.
- Versionado optimista mediante `expectedVersion`, sin merge automático.
- Storage local por workspace y Pending Operations persistente compartido.
- Sync Engine manual con flujo remoto primero online y local primero offline.
- Supabase Client Adapter y migración SQL local preparada para `receptions` y `reception_items`, constraints, índices, relaciones UUID, RLS, triggers y Broadcast. La migración valida la cadena Compra → OT → Cotización, impide combinaciones cruzadas de recepción y partida y protege `last_modified_by`; no está aplicada en Supabase.
- Realtime implementado en código con reconciliación prevista de INSERT, UPDATE y DELETE, descarte de eventos antiguos, duplicados y ecos; no está validado operacionalmente contra el backend remoto.
- `useReception`, `ReceivingSection`, selectors, guards y Reception Summary.
- Integración derivada con Business State, tarjeta de Inicio e Inspector.
- Recepciones parciales y múltiples recepciones por partida.
- Cantidades aceptadas, dañadas, rechazadas y faltantes.
- Estados `pending`, `partial`, `complete` y `rejected` derivados.
- Conflictos conservados sin merge automático.

Fuentes de verdad:

- Compras conserva cantidades solicitadas/compradas, costos, proveedor y partidas.
- Recepción conserva cada evento de llegada, responsable, fecha, cantidades aceptadas, dañadas, rechazadas o faltantes, observaciones y evidencia.
- Los acumulados, avance y estados `pending`, `partial`, `complete` y `rejected` se calculan; no se persisten como campos editables.
- Recepción no crea existencias, movimientos de Inventario ni remanentes.
- El modo de solo lectura consume exclusivamente `isProjectReadOnly()`.
- Smart Cut Engine y geometría no fueron modificados.

Validación de cierre:

- `npm test`: 99 archivos y 793 pruebas aprobadas.
- `npm run build`: correcto.
- `git diff --check`: limpio.
- Warning conocido: el chunk principal de Vite continúa por encima de 500 kB.
- Pruebas automatizadas de recepción parcial/completa, acumulados, offline, compactación, sincronización manual, conflictos, workspace, read only, RLS, Realtime, selectors, summary y Business State.
- Las pruebas estructurales validan el código y la migración local; no sustituyen la validación real sobre Supabase.
- Smart Cut Engine, Compras como fuente de verdad e Inventario permanecieron sin cambios de responsabilidad.

Pendiente para la validación operacional remota:

- aplicar la migración de Recepción en Supabase;
- validar tablas, RLS real, permisos e aislamiento por `workspace_id`;
- validar la inmutabilidad real del workspace;
- validar Broadcast privado y Realtime en dos ventanas;
- validar INSERT, UPDATE, DELETE, eventos antiguos, duplicados y ecos;
- validar reconexión, operación offline, `syncPendingOperations()`, conflictos, idempotencia y ausencia de recepciones duplicadas.

### Fase 25.5B — Centro Operativo de Recepción

**Estado:** IMPLEMENTADA EN CÓDIGO Y VALIDADA AUTOMÁTICAMENTE.

**Resultado:** Recepción opera como centro transversal del workspace sin depender exclusivamente del proyecto activo y sin duplicar las responsabilidades de Compras.

**Objetivo alcanzado:** ofrecer una bandeja operativa global para todas las compras y proyectos, con captura rápida o detallada, incidencias, observaciones, eventos y notificaciones derivadas.

Alcance implementado:

- bandeja global con todas las compras pendientes del workspace, sin depender del proyecto activo;
- filtros por proyecto, cliente, proveedor, fecha, estado, responsable e incidencia;
- recepción parcial, por una partida, por varias partidas seleccionadas o completa;
- captura rápida cuando todo llegó correctamente y captura detallada cuando existan diferencias;
- historial por recepción y por partida, responsable, fecha, evidencia, comprobantes, observaciones e incidencias;
- observaciones relacionadas con cada evento, notificaciones derivadas, actividad reciente y accesos desde módulos relacionados.

Separación funcional implementada:

| Compras | Recepción |
|---|---|
| Conserva lo solicitado, lo comprado, proveedor, costos y partidas. | Confirma físicamente lo recibido. |
| Consulta avance, cantidades recibidas acumuladas e incidencias. | Registra aceptado, dañado, rechazado y faltante. |
| Permite abrir la compra dentro de Recepción. | Registra responsable, fecha, evidencia, notas e incidencias. |

Compras no conservará una segunda fuente editable de cantidades recibidas. Recepción será la única autoridad para confirmar físicamente la llegada.

```text
Compras informa qué debe llegar
↓
Recepción registra qué llegó realmente
↓
Recepción comunica resultados e incidencias
↓
La integración futura registra lo aceptado como movimientos de entrada en Inventario
```

Eventos y notificaciones transversales implementados:

- se derivan de las recepciones y sus partidas, no como copias editables independientes por módulo;
- conservan trazabilidad UUID mediante workspace, cotización, orden de producción, compra, recepción y sus partidas;
- comunican recepción completa o parcial, material dañado, rechazado o faltante y actividad reciente;
- no autorizan a Recepción a modificar directamente otros dominios.

```text
Dominio propietario
↓
Evento operativo
↓
Registro relacionado
↓
Consumidores autorizados
↓
Inicio / Compras / Producción / Inspector / Companion / Historial
```

Integración transversal implementada:

- **Inicio:** pendientes, parciales, incidencias, completadas recientemente y actividad.
- **Compras:** avance derivado, recibido acumulado, pendiente, incidencias y acceso a Recepción.
- **Producción:** materiales pendientes, parciales o disponibles, daños, rechazos y riesgos.
- **Inspector:** compras pendientes, faltantes, daños, rechazos, notas sin resolver y conflictos.
- **Project Companion:** resumen contextual, alertas de daño, rechazo o faltante y actividad reciente; su integración general permanece parcial.
- **Historial:** responsable, fecha, recibido, faltante, daño, rechazo, notas e incidencias resueltas.

Estas integraciones consumen selectors, eventos y summaries derivados; no trasladan la propiedad de los datos ni crean Inventario.

Estados canónicos de partida:

- `pending`
- `partial`
- `complete`
- `rejected`

Estados operativos derivados para la bandeja:

- por recibir;
- esperada hoy;
- atrasada;
- con faltantes;
- con daños;
- requiere seguimiento;
- completada;
- cerrada.

Estos estados operativos serán selectors o vistas derivadas y no una fuente persistente adicional.

Validación automática de 25.5B:

- `npm test`: 101 archivos y 807 pruebas aprobadas.
- `npm run build`: correcto; permanece el warning conocido del chunk principal de Vite.
- `git diff --check`: limpio.
- La migración durable fue endurecida estructuralmente para impedir combinaciones cruzadas entre Compra, OT, Cotización, Recepción y Partida de Compra, y para proteger los actores de auditoría.
- Esta validación es local y automática; no declara aplicada ni validada la migración contra Supabase.
- Smart Cut Engine e Inventario no fueron modificados.

### Fase 25.5C — Validación remota de Recepción

**Estado:** COMPLETADA E INTEGRADA EN `main` MEDIANTE `751a074`.

Se validaron contra Supabase `receptions` y `reception_items`, RLS, permisos, aislamiento e inmutabilidad de `workspace_id`, Broadcast privado, Realtime, operaciones online/offline, reconexión, `syncPendingOperations()`, conflictos, idempotencia y ausencia de duplicados. Este cierre habilita 25.5D sin modificar el contrato durable de Recepción.

### Fase 25.5D — Eliminación Segura y Transversal de Órdenes de Producción

**Estado:** COMPLETADA, VALIDADA REMOTAMENTE E INTEGRADA EN `main`.

**Objetivo:** permitir que únicamente el propietario autorizado del workspace elimine definitivamente una orden de producción y sus datos operativos dependientes, sin errores de foreign keys, borrados parciales, resurrección por sincronización ni eliminación de la cotización original.

La auditoría confirmó dependencias `RESTRICT` desde Compras y Recepción, y relaciones descendentes hacia sus partidas. Quote conserva la relación desde `production_orders.quote_id`; no almacena una segunda referencia a OT.

Principio central:

La eliminación será un comando destructivo del dominio. No será un `DELETE` directo desde React ni desde una pantalla.

```text
Production UI
↓
Modal destructivo de confirmación
↓
Application Command
↓
RPC SQL transaccional protegida
↓
Eliminación ordenada de dependencias
↓
Auditoría mínima
↓
Limpieza local y de operaciones pendientes
↓
Tombstone local
↓
Realtime y reconciliación derivada
```

Autorización obligatoria:

- solo un usuario autenticado con rol canónico `owner` podrá ejecutar el comando;
- la opción se ocultará a usuarios sin permiso, pero el servidor repetirá toda validación;
- usuario, orden y workspace deberán coincidir;
- una orden de otro workspace nunca podrá eliminarse;
- no existe contraseña, secreto ni código de autorización adicional en el frontend;
- la service role key nunca se expondrá al frontend;
- la RPC valida `auth.uid()`, membresía activa y rol `owner`, usa `search_path` vacío y no está disponible para `anon`.

Interfaz implementada:

```text
Más opciones
└── Eliminar orden
```

El modal muestra el folio, la advertencia permanente, el alcance relacionado y exige escribir manualmente el folio antes de habilitar **Eliminar definitivamente**. Incluye estado de procesamiento, errores y protección contra doble envío. La interfaz no sustituye la autorización del servidor.

Alcance transversal:

Se inspeccionaron todas las foreign keys reales que referencian `production_orders`, comenzando por `purchases.production_order_id`, y las relaciones directas o indirectas con partidas de Compra, recepciones, partidas recibidas, historial derivado, auditoría, operaciones pendientes, cachés, selecciones y summaries.

Para cada relación se definió explícitamente si correspondía eliminar, conservar, desvincular, archivar o auditar. No se convirtieron indiscriminadamente las foreign keys a `ON DELETE CASCADE`.

Regla sobre Cotización:

- la cotización, cliente y proyecto comercial originales se conservarán como evidencia;
- no se eliminarán automáticamente sesiones de optimización compartidas o no exclusivas de la orden;
- eliminar también la cotización requerirá un comando destructivo independiente y otra decisión arquitectónica.

Transacción implementada:

```text
Validar autorización
↓
Validar workspace y existencia
↓
Eliminar `reception_items`
↓
Eliminar `receptions`
↓
Eliminar `purchase_items`
↓
Eliminar `purchases`
↓
Guardar auditoría mínima
↓
Eliminar production_orders
↓
Confirmar transacción
↓
Propagar eliminación
```

Si falla cualquier dependencia, PostgreSQL ejecuta rollback completo. La RPC recibe UUID canónicos, obtiene el actor desde `auth.uid()`, bloquea la OT con `FOR UPDATE`, verifica owner activo y workspace, devuelve conteos estructurados y responde idempotentemente cuando la OT ya no existe.

Auditoría mínima previa:

- UUID y folio de la orden;
- workspace y usuario autorizador;
- fecha y hora;
- resumen de entidades eliminadas;
- resultado controlado.

La auditoría reutiliza `workspace_audit_log` con la acción `delete_production_order`; nunca incluye tokens, secretos, service role key ni encabezados de autenticación.

Sincronización y Realtime:

- limpiar Local Repository de Producción y datos locales relacionados de Compras y Recepción;
- retirar operaciones pendientes, selección activa, proyecto en foco, estados temporales, formularios abiertos y summaries relacionados;
- propagar el DELETE mediante el Realtime canónico del workspace;
- los eventos remotos no crearán versiones, operaciones pendientes, llamadas repetidas, loops ni escrituras de retorno.

Protección contra resurrección:

`ProductionDeletionRegistry` registra por workspace el UUID y `deletedAt` de la OT eliminada. Production Storage excluye esas identidades al cargar, guardar, fusionar o recibir eventos tardíos. La misma limpieza retira Compras, Recepciones y operaciones pendientes relacionadas. No existe expiración porque el UUID canónico no se reutiliza.

Consumidores reconciliados por el comando:

- Producción;
- Compras;
- Recepción;
- Inicio;
- Business State;
- Inspector Inteligente;
- Project Companion cuando corresponda;
- Historial;
- resúmenes laterales;
- proyecto activo;
- flujo operacional.

Business State continuará como adapter derivado: no ejecutará eliminaciones ni será fuente de verdad.

Validación implementada:

- pruebas del comando: entradas, owner, confirmación manual, rechazo offline, error remoto, idempotencia y doble ejecución;
- pruebas estructurales de SQL: `auth.uid()`, owner activo, workspace, `FOR UPDATE`, orden de eliminación, conservación de Quote, auditoría, resultado estructurado y grants;
- pruebas de limpieza local: Producción, Compras, Recepción, selecciones y operaciones pendientes por identidad;
- pruebas anti-resurrección: tombstone aislada por workspace y rechazo de caché, merge o evento tardío;
- pruebas de UI: acción exclusiva para owner y separación respecto de `isProjectReadOnly()`;
- `npm test`: 106 archivos y 829 pruebas aprobadas;
- `npm run build`: correcto;
- `git diff --check`: limpio.

Validación remota completada:

- comando seguro ejecutado en servidor;
- propietario activo y aislamiento por workspace validados;
- dependencias reales gestionadas transaccionalmente;
- auditoría independiente y cotización conservada;
- eliminación visible en toda la aplicación mediante Realtime;
- ausencia de huérfanos y operaciones pendientes;
- protección comprobada contra resurrección;
- validación con Supabase real;
- pruebas, build y whitespace correctos.

La migración y la RPC `delete_production_order_safely` están implementadas y validadas remotamente. La corrección específica para compras inactivas conserva los guards operativos normales y habilita exclusivamente el borrado autorizado dentro del contexto transaccional. Realtime continúa operativo y la fase quedó integrada en `main` mediante `44e54fc` (`feat(production): complete Phase 25.5D safe production order deletion`).

### MICROFASE 25.5E — Resolución Inteligente de Piezas Sobredimensionadas

**Estado:** COMPLETADA LOCALMENTE.

**Objetivo:** resolver de forma reversible piezas físicamente incompatibles con el formato comercial y superficies de productos modulares, sin modificar el diseño original del proyecto.

**Resultado:** Material Calculator transforma una pieza rectangular o superficie modular incompatible con el formato configurado en una propuesta explicable, confirmable y reversible. Quote conserva la medida original; Smart Cut recibe únicamente piezas físicas ya resueltas.

El motor contempla dos escenarios diferentes:

**A. Piezas sobredimensionadas**

- división reversible;
- evaluación de formatos comerciales mayores;
- fabricación especial;
- unión controlada.

**B. Cobertura modular**

Para duela, lambrín, tablilla, listón, deck y perfiles modulares equivalentes, el sistema no divide conceptualmente una pieza. Transforma una superficie comercial en múltiples piezas físicas repetitivas necesarias para cubrirla. La superficie permanece como fuente de verdad y las tiras pertenecen únicamente a fabricación; no reemplazan el diseño original.

Implementado:

- Motor Oversize Resolution puro y determinista.
- Ranking determinista y explicable.
- División equilibrada.
- División por aprovechamiento evaluada mediante la fachada pública `optimizeCuts()`.
- Cobertura modular vertical u horizontal para materiales repetitivos.
- Fabricación especial cuando no existe una solución automática válida.
- Integración con Material Calculator y Quote.
- Integración con Smart Cut únicamente mediante piezas físicas cortables.
- Aplicación explícita de propuestas y reversión sin duplicados.
- Trazabilidad completa y detección de obsolescencia por cambios en pieza, formato o configuración.

Contrato general:

`resolveOversizePiece()` recibe una pieza, el formato comercial, formatos alternativos y configuración física. Devuelve la clasificación del problema, alternativas deterministas, recomendación y diagnóstico, sin persistir ni modificar la entrada.

#### Material Calculator — niveles oficiales

1. **Medidas originales:** fuente comercial que representa el trabajo vendido.
2. **Resolución de fabricación:** piezas derivadas, reversibles y trazables que permanecen vinculadas a la medida original.
3. **Smart Cut:** consume únicamente las piezas físicas resultantes y nunca modifica el diseño original.

```text
Material Calculator
↓
resolveOversizePiece()
↓
Clasificación + alternativas + recomendación + diagnóstico
↓
Propuesta temporal confirmada por el usuario
↓
Quote conserva original y piezas derivadas trazables
↓
Smart Cut evalúa únicamente piezas físicas
```

#### Cobertura Modular

Lambrín, duela, tablilla, listón, deck y perfiles modulares equivalentes ya no se interpretan únicamente como tableros completos. Cuando el usuario confirma `MODULAR_PLANK`, una superficie puede resolverse mediante tiras o módulos repetitivos que cubren físicamente el ancho y largo requeridos. El cálculo determina cantidad de tiras, longitud de corte, cobertura bruta, recorte lateral, sobrante longitudinal, orientación y advertencias, sin modificar geometría ni estrategias de Smart Cut.

El caso validado de una superficie de 67 × 263 cm sobre lambrín comercial de 16 × 290 cm produce cinco tiras físicas de 16 × 263 cm, cobertura bruta de 80 cm, recorte lateral total de 13 cm y sobrante longitudinal de 27 cm por tira.

#### Trazabilidad

Las piezas generadas conservan `sourcePieceId`, `resolutionProposalId`, `resolutionAlternativeId`, `sectionIndex`, `sectionCount`, `optimizationExcluded` y metadata equivalente de tira, cobertura, ancho bruto, ancho terminado, recorte y orientación. La medida original permanece como referencia y queda excluida del acomodo automático después de aplicar una propuesta; la reversión elimina las derivadas y restaura el original.

#### Smart Cut

- Oversize Resolution Engine: implementado fuera de Smart Cut.
- Modular Coverage Engine: implementado fuera de Smart Cut.
- Smart Cut Engine: sin modificaciones.
- Shelf: sin cambios.
- Best Fit: sin cambios.
- Geometría: sin cambios.
- Motor: sin cambios.
- Optimization Sessions: sin modificaciones.

Smart Cut continúa congelado. No calcula coberturas modulares, no divide piezas y no conoce reglas comerciales. Recibe únicamente piezas físicas ya resueltas. Oversize Resolution y Modular Coverage consumen su fachada pública cuando necesitan evaluar una alternativa, pero no alteran candidatos, evaluación, ranking, selección, Proposal ni Active Mode.

#### UX

- Panel de propuestas ampliado solo mientras una resolución está abierta.
- Tarjetas responsivas y alternativas legibles, con métricas organizadas y acciones completas.
- Dos o tres tarjetas por fila cuando el ancho lo permite y una columna en móvil.
- Eliminación del formulario resumen redundante de Materiales de Cotización.
- El botón **Abrir BR Material Studio** queda seguido directamente por las tarjetas individuales de materiales.

Decisión oficial relacionada: las medidas originales del trabajo permanecen como fuente de verdad. Las piezas derivadas de fabricación deberán visualizarse anidadas bajo la pieza original mediante un desplegable **Resolución de fabricación**. Esta decisión es vigente; la integración visual anidada permanece pendiente y no se presenta como implementada en este cierre.

Límites conservados:

- No incluye cálculos estructurales, herrajes de unión, múltiples uniones arbitrarias, geometría irregular, IA, proveedores, Inventario, remanentes ni Fabricación Durable.
- Quote continúa como fuente de verdad; Oversize Resolution no crea Repository, Storage, Supabase, Realtime ni persistencia propia.
- No se modificaron Smart Cut Engine, Shelf, Best Fit, geometría, Optimization Sessions ni sus contratos.

Validación local de cierre:

- `npm test`: 112 archivos y 873 pruebas aprobadas.
- `npm run build`: correcto.
- Warning conocido: bundle principal superior a 500 kB.
- `git diff --check`: limpio.
- Sin commit.
- Sin push.

Fase ejecutada a continuación: 25.6 — Inventario por Movimientos. Estado actual: 25.6C completada y cerrada técnica y operacionalmente hasta 25.6C.3.7; 25.6 general conserva su estado propio y no se promueve automáticamente por este cierre.

## Infraestructura visual y Brand System

### Fuente documental

- `docs/branding/BRAND_BOOK_V1.md`
- `docs/branding/README.md`
- `src/styles/brand-tokens.css`
- `src/design/tokens/*.js`
- `src/components/ui/BR*.jsx`

Los documentos de branding, tokens CSS y JavaScript, índice público, tema, helpers, componentes `BR*` y capas visuales especializadas existen y están disponibles. La adopción por superficies sigue siendo incremental.

### Relación de capas

Brand Book
→ Tokens
→ Tema
→ Componentes visuales
→ Layout
→ Impresión
→ Superficies del ERP

Esta relación visual no forma parte del contrato de dominio:

Source → Adapter → Repository → Versioning → Storage / Offline → Hook → Section → Summary → Business State

Ambos contratos son independientes:

- El contrato de dominio gobierna datos, reglas y operación.
- El sistema visual gobierna presentación.
- El sistema visual no puede leer, duplicar ni modificar reglas del dominio.
- Las secciones pueden consumir ambos, pero cada uno conserva su responsabilidad.

### Estrategia de adopción

- Implementación incremental.
- Un grupo pequeño de superficies por cambio.
- Pruebas y build en cada iteración.
- Comparación visual antes y después.
- Reversión simple.
- Sin migraciones visuales masivas.
- Las nuevas pantallas usan los tokens desde su creación cuando la base ya esté estable.

### Matriz de adopción por superficie

| Superficie | Prioridad | Riesgo | Dependencia principal |
|---|---|---|---|
| Tokens CSS | Muy alta | Muy bajo | Ninguna |
| Tema global | Muy alta | Muy bajo | Tokens |
| Componentes visuales | Muy alta | Bajo | Tokens + Tema |
| Layout | Alta | Bajo | Componentes |
| Login | Alta | Muy bajo | Tema |
| Sidebar | Alta | Muy bajo | Tema |
| Header | Alta | Muy bajo | Tema |
| Dashboard / Inicio | Alta | Bajo | Componentes |
| PDFs e impresión | Alta | Muy bajo | Brand Print |
| Inspector Inteligente | Media | Bajo | Componentes |
| Project Companion | Media | Bajo | Componentes |
| Centro del Proyecto | Media | Bajo | Componentes |
| Recepción | Baja | Media | 25.5, 25.5B y 25.5C completadas; 25.5D completó la eliminación segura transversal y su validación remota |
| Inventario | Baja | Media | Dominio durable local/remoto e integración 25.6C implementada hasta 25.6C.3.3. Pendientes el cierre multiusuario específico, Centro Operativo definitivo, almacenes durables y remanentes |
| Smart Cut | Baja | Bajo | Persistencia remota, Realtime, referencia activa y consolidación de experiencia y ciclo de vida completados; remanentes e integración con Inventario siguen pendientes |
| Fabricación | Baja | Media | Hito 8 — Fabricación Durable |
| Instalación | Baja | Media | Hito 9 — Instalación y Entrega |
| Entrega | Baja | Media | Hito 9 — Instalación y Entrega |

La prioridad visual nunca modifica la prioridad funcional del roadmap. Una superficie puede tener prioridad visual alta y permanecer bloqueada por una fase funcional todavía pendiente.

### Prioridad

1. Integridad y seguridad de datos.
2. Operación real.
3. Arquitectura mantenible.
4. Sistema visual consistente.
5. Refinamiento estético.

Una incidencia visual nunca debe bloquear una reparación crítica de datos u operación, salvo que impida utilizar la interfaz.

### Congelamiento de infraestructura visual

Una vez concluida la Fase 25.2E:

- Los tokens oficiales pasan a ser la referencia visual del sistema.
- El tema global deja de modificarse sin revisión arquitectónica.
- Los componentes compartidos deberán evolucionar por versión y no mediante cambios ad hoc.
- Los cambios globales de identidad deberán documentarse previamente.
- Ningún módulo podrá redefinir localmente colores de marca ya existentes sin una excepción documentada.
- Las excepciones deberán registrarse en la documentación del Brand System.
- Los cambios visuales masivos requerirán validación de compatibilidad con impresión, responsive y accesibilidad.

El congelamiento aplica únicamente a la infraestructura visual. No limita la evolución funcional del ERP.

## Historial reciente

| Fecha | Fase | Resultado |
|-------|------|-----------|
| 22/07/2026 | 25.2A | Identidad canónica e idempotencia completadas. |
| 22/07/2026 | 25.2B | Infraestructura de auditoría completada. |
| 22/07/2026 | Infraestructura de desarrollo — PM2 | Dependencia PM2 y servidor Vite accesible por red integrados mediante `dd6b8f8`; configuración local `ecosystem.config.cjs` verificada para `aluxor-network` mediante `npm run start`. |
| 23/07/2026 | 25.2C | Auditoría real certificada (`READY WITH WARNINGS`). |
| 23/07/2026 | 25.2D | Hardening operativo del núcleo completado. |
| 23/07/2026 | 25.2E | Brand System e infraestructura visual completados. |
| 24/07/2026 | 25.3 | Cerrada e integrada en `main` mediante `660a217ba73f4845f68047d88ec551663f22d5cd` (`feat(business-state): complete Phase 25.3 Business State 2.0`). |
| 25/07/2026 | 25.4 — Operational Center | Inicio convertido en Centro Operativo basado en Business State, con proyecto en foco, selector y tarjetas expandibles; integrado mediante `3c7affb`. |
| 26/07/2026 | Smart Cut — Etapas 1–7 | Cierre técnico completado: contratos Legacy, normalización, validación, geometría, Shelf, Best Fit, candidatos, evaluación, selección, UI comparativa, Proposal y Active Mode. Motor congelado; 508 pruebas, build correcto, `git diff --check` correcto y sin regresiones identificadas. |
| 26/07/2026 | Optimization Sessions | Dominio implementado con identidad, referencias, selección, Proposal, auditoría, reapertura, comparación, serialización determinista e integración aditiva con Quote. |
| 26/07/2026 | Persistencia local de Optimization Sessions | Contrato durable v2, migración, Adapter, Repository local, Versioning, Storage, Offline Queue, Selectors, Summary, Hook y Section implementados; 73 archivos y 551 pruebas aprobadas, build y `git diff --check` correctos. |
| 26/07/2026 | Optimization Sessions — Remote Adapter | Adapter remoto implementado y probado. |
| 26/07/2026 | Optimization Sessions — Remote Repository | Repository remoto desacoplado implementado mediante cliente abstracto, sin dependencia directa de Supabase. |
| 26/07/2026 | Optimization Sessions — Supabase Client Adapter | Implementación completa del cliente Supabase inyectable compatible con el contrato del Remote Repository, con aislamiento por workspace, versionado optimista y pruebas unitarias. Integrado en `main` mediante `d31df14` (`feat(optimization-sessions): add Supabase client adapter`). |
| 26/07/2026 | Optimization Sessions — SQL | Tabla `optimization_sessions`, constraints e índices por workspace integrados mediante `49fdecc`. |
| 26/07/2026 | Optimization Sessions — RLS | Políticas separadas de SELECT/INSERT/UPDATE/DELETE y trigger de inmutabilidad de `workspace_id` integrados mediante `5867e8b`. |
| 26/07/2026 | Optimization Sessions — conexión de aplicación | React conectado mediante Hook → Application Repository → Remote Repository sin exponer Supabase a la UI; integrado mediante `b6d61d2`. |
| 27/07/2026 | Optimization Sessions Remote Persistence | Fase completada en el estado actual del código con Repository Provider, Connectivity Provider, Pending Operations Repository, compactación, operaciones online/offline, detección de conflictos y Sync Engine manual. Validación: 83 archivos, 651 pruebas, build y `git diff --check` correctos. |
| 28/07/2026 | Optimization Sessions — Realtime | Broadcast privado por workspace, reconciliación segura de INSERT/UPDATE/DELETE, prevención de ecos y duplicados, preservación de conflictos e integración Hook → Application Repository implementados. |
| 29/07/2026 | Optimization Sessions — Cotización, referencia activa y Realtime | Cierre integrado mediante `6a61cfc` (`fix: synchronize active optimization session through realtime`). Creación, actualización, eliminación y cambio de sesión activa validados bidireccionalmente en dos ventanas; Quote conserva únicamente `material.optimization.activeSessionId`, Material Calculator muestra las métricas activas y la eliminación limpia la referencia. Validación: 86 archivos, 694 pruebas, build y `git diff --check` correctos; push completado a `origin/main`. |
| 29/07/2026 | Optimization Sessions — consolidación de experiencia y ciclo de vida | Sesión abierta temporal separada de sesión activa, firma dirty determinista, confirmaciones de descarte y sobrescritura, actualización exclusiva de la sesión abierta, mensajes comprensibles y reconciliación Realtime segura implementados. Validación: 88 archivos, 707 pruebas, build y `git diff --check` correctos; sin commit ni push. |
| 30/07/2026 | Optimization Sessions — cierre de consolidación del dominio | Working Input y Working State canónicos; baseline, dirty y `expectedVersion` estables; guardado y actualización repetitiva; persistencia separada de `selectedPieceIds`, `selectedCandidateId`, `strategy` y `pieceOrder`; recuperación, reconciliación Realtime y compatibilidad legacy consolidadas. Material Calculator y Cut Optimizer consumen `workingInput`; Shelf y Best Fit cambian de inmediato sin modificar el Smart Cut Engine. Validación: 90 archivos, 758 pruebas, build correcto y `git diff --check` limpio; sin commit ni push. |
| 30/07/2026 | 25.5 — Recepción Durable | Dominio durable implementado en código con eventos parciales, relaciones UUID, adapters, repositories, versionado, storage/offline, Sync Engine manual, Realtime, Hook, Section, Summary y Business State. La migración SQL, RLS y Broadcast están preparados localmente, no aplicados ni validados contra Supabase. Validación automática: 99 archivos, 793 pruebas, build correcto y `git diff --check` limpio; sin commit ni push. |
| 31/07/2026 | 25.5B — Centro Operativo de Recepción | Implementada en código con bandeja global por workspace, recepción rápida y detallada, filtros, incidencias, eventos, notificaciones derivadas e integración con Inicio, Compras, Producción, Inspector, Project Companion, Historial y Business State. La migración durable fue endurecida localmente. Validación automática: 101 archivos, 807 pruebas, build correcto y `git diff --check` limpio; validación remota pendiente. |
| 31/07/2026 | 25.5C — Validación remota de Recepción | Migración, RLS, Broadcast, Realtime, offline, reconexión, conflictos e idempotencia validados e integrados en `main` mediante `751a074`. |
| 31/07/2026 | 25.5D — Eliminación Segura y Transversal de Órdenes de Producción | Comando, RPC `delete_production_order_safely`, auditoría, limpieza local y de colas, tombstone, reconciliación Realtime y corrección de compras inactivas completados y validados remotamente. Integrada en `main` mediante `44e54fc`. |
| 01/08/2026 | 25.5E — Resolución Inteligente de Piezas Sobredimensionadas y Cobertura Modular | Oversize Resolution y Modular Coverage implementados fuera de Smart Cut, con aplicación reversible, trazabilidad completa y separación definitiva entre diseño comercial y fabricación. Las medidas originales permanecen como fuente de verdad; Smart Cut recibe únicamente piezas físicas. El panel de propuestas fue ampliado y se retiró el formulario resumen redundante de Materiales de Cotización. Validación local: 112 archivos y 873 pruebas, build correcto, warning conocido de bundle superior a 500 kB y `git diff --check` limpio; sin commit ni push. |
| 02/08/2026 | 25.6 — Inventario por Movimientos | Dominio local implementado con 14 tipos oficiales de movimiento, Engine puro, Adapter, Repository local, Versioning, Storage, Pending Operations, capas desacopladas de Sync y Realtime, Hook, Selectors, Summary y consumo en Business State. Existencias, reservas y disponibilidad se derivan exclusivamente del historial. |
| 02/08/2026 | 25.6A — Maduración del dominio de Inventario | Lotes, ubicaciones, transferencias, Kardex determinista, snapshots derivados en memoria y selectores avanzados implementados sin persistir saldos ni agregar Supabase. Validación acumulada: 116 archivos y 996 pruebas aprobadas, build correcto y `git diff --check` limpio; sin commit ni push. |
| 02/08/2026 | 25.6B — Persistencia remota de Inventario | `public.inventory_movements`, RLS, validación relacional, permisos, triggers, RPC, adapters, repositories, Sync Engine, Pending Operations, Realtime privado, reconciliación, Hook y UI mínima implementados. Creación y reversión validadas operacionalmente; 123 archivos y 1162 pruebas aprobadas, build correcto y `git diff --check` limpio; sin commit ni push. |
| 03/08/2026 | 25.6C–25.6C.3.1 | Integración idempotente Recepción → Inventario, consistencia Compras → Recepción → Inventario → Rentabilidad, trazabilidad append-only, enmiendas versionadas, conflictos, Realtime y RPC Owner implementados. Dos ventanas y RPC validadas; identidades UI independientes pendientes. |
| 04/08/2026 | 25.6C.3.2 | Índice operativo de Recepción, detalle por proyecto, Inventario General, distribución informativa y recálculo de compra implementados y validados. |
| 04/08/2026 | 25.6C.3.3 | Contrato Necesario → Ordenado → Comprado → Recibido consolidado mediante `requiredQuantity`, `purchasedQuantity` y `materialFulfillment.js`. Validación acumulada: 130 archivos y 1266 pruebas, build correcto, warning conocido de chunk y `git diff --check` limpio; sin commit ni push. |
| Consolidación funcional | 25.5B | Centro Operativo de Recepción implementado y validado automáticamente. |
| Fase cerrada localmente | 25.5E | Resolución inteligente y cobertura modular completadas sin persistencia propia ni cambios al Smart Cut Engine. |
| Estado vigente | 25.6C | COMPLETADA / CERRADA TÉCNICA Y OPERACIONALMENTE hasta 25.6C.3.7. |

## Estado del núcleo del ERP

Identidad ............. Estable
Workspace ............. Estable
Producción ............ Durable
Compras ............... Durable
Recepción ............. Durable y validada local/remotamente
Reception Offline ..... Implementado y probado automáticamente
Reception Sync Engine . Manual implementado en código
Reception Realtime .... Implementado y validado remotamente
Reception Migration ... Aplicada en Supabase
Reception RLS ......... Aplicada y validada
Reception Summary ..... Integrado con Business State
OT Delete Command ..... Implementado y validado remotamente
OT Delete RPC ......... Implementada y validada remotamente
OT Tombstone .......... Implementada localmente
Inactive Purchases .... Corrección implementada
Read-only ............. Estable
Integrity Audit ....... Certificada
Hardening ............. Completado
Brand System .......... Consolidado
Business State 2.0 .... Implementado
Smart Cut Engine ...... Técnicamente completo y congelado
Smart Cut UI .......... Completa
Smart Cut Proposal .... Completa
Smart Cut Active Mode . Completo
Oversize Resolution ... Completado localmente con cobertura modular
Material Calculator ... Operativo con resolución reversible y trazable
Inventory Engine ...... Implementado localmente por movimientos
Inventory 25.6A ....... Lotes, ubicaciones, transferencias, Kardex y snapshots implementados
Inventory Remote ...... 25.6C integrada; ENTRY_PURCHASE y REVERSAL idempotentes
Inventory Table ....... `public.inventory_movements` como única fuente de verdad
Inventory RLS ......... Aplicada; sin DELETE para `authenticated`
Inventory Sync ........ Concreto y conectado
Inventory Realtime .... Privado por workspace; `Subscribed` validado
Inventory UI .......... Inventario General + vista/distribución informativa por proyecto
Optimization Sessions . Durable local + remoto, integrado con Cotización
Experiencia Sessions .. Ciclo de vida consolidado y validado
Working Input ......... Fuente editable canónica
Working State ......... Baseline, dirty y versión canónicos
Remote Adapter ........ Implementado
Remote Repository ..... Implementado
Supabase Adapter ...... Implementado
Application Repository  Implementado
Repository Provider ... Composición única implementada
Connectivity Provider . Implementado
Pending Operations .... Persistente e implementado
Tabla .................. Implementada
RLS .................... Implementada
Trigger workspace ..... Implementado
Sync Engine ........... Manual implementado
Realtime .............. Implementado y validado bidireccionalmente
Referencia activa ..... `activeSessionId` único y sincronizado
Persistencia Sessions . Completada con Realtime y Cotización
PM2 desarrollo ........ Configurado localmente
ERP Operativo ......... En desarrollo
