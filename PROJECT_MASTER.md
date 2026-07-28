# BRTuNegocio

> Documento maestro de identidad, dirección, arquitectura y estado del producto.

- **Workspace operativo actual:** ALUXOR / BosqueReal
- **Etapa activa:** Etapa III — ERP operativo
- **Fase oficial:** Optimization Sessions — Realtime completada en código y migración; validación operacional externa pendiente
- **Última actualización:** 28/07/2026

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
- Quote continúa siendo la fuente de verdad persistente de la optimización.
- Smart Cut calcula, compara, recomienda y propone; nunca aplica una optimización sin confirmación explícita.
- Shelf permanece como fallback oficial y garantiza continuidad Legacy.
- Fabricación consume el summary oficial de optimización; nunca recalcula geometría ni candidatos.
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
- **Purchases:** motor, adapter, repository, storage, cola offline, versionado, Realtime, selectors y summary.
- **Identity:** normalización, comparación y preservación canónica por UUID y workspace. `createUuid.js` es el generador seguro compartido por Cotizaciones y colas, pero Producción y Compras todavía conservan puntos de generación directa o inyectable que deben converger.
- **Integrity:** `runIntegrityAudit()` es la entrada pública explícita; combina auditor local estricto, auditor remoto autenticado de solo lectura, comparación local/remota, reporte consolidado, recomendaciones y readiness conservador.
- **Read Only:** `isProjectReadOnly()` pertenece al Production Engine y deriva únicamente de `Entregado`; los hooks de Cotización, Producción, Compras y Workspace rechazan mutaciones y las secciones existentes reflejan el mismo contrato sin duplicar pantallas.
- **Smart Cut Engine / Cut Optimizer:** motor físico determinista, congelado y compatible con Legacy. La UI comparativa, Proposal Application Layer y Active Mode están implementados. Optimization Sessions está completado como dominio durable local y remoto con Source, Adapter, Local Repository, Remote Adapter, Remote Repository, Supabase Client Adapter, Application Repository, Repository Provider, Versioning, Storage, Offline Queue, Pending Operations Repository, Connectivity Provider, Sync Engine manual, Realtime Subscription, Reconciliation, Hook, Section, Summary y Selectors. La tabla `optimization_sessions`, sus políticas RLS, el trigger de inmutabilidad de `workspace_id`, el Broadcast privado por workspace y la conexión React mediante dependencias inyectadas están implementados en código y migraciones. Permanecen pendientes la validación operacional externa de Realtime, sincronización automática, resolución explícita de conflictos e historial remoto consolidado. Quote continúa siendo la única fuente de verdad persistente de la optimización.
- **Business State:** adapter central derivado y sin persistencia. Agrega summaries existentes y expone proyecto, cliente, cotización, producción, compras, workflow, salud, riesgos, pendientes, actividad, alertas, indicadores, última actualización y read only sin apropiarse de los dominios.
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

`repositoryProvider.js` es el punto único de composición. El Hook consume exclusivamente Application Repository; Application Repository delega en Sync Engine; y el Sync Engine coordina Local Repository, Pending Operations Repository, conectividad, Remote Repository y reconciliación Realtime. La suscripción utiliza un único canal Broadcast privado por workspace, valida filas mediante Remote Adapter y solo escribe en caché local cuando la comparación de versiones y operaciones pendientes lo permite. El dominio continúa dependiendo únicamente de contratos abstractos. Supabase es una implementación concreta, inyectable y sustituible, y la UI no lo importa directamente.

### Fuentes oficiales de verdad verificadas

| Contrato | Fuente oficial | Consumidores o representación |
|---|---|---|
| Estado comercial | `quote.status` / `estadoCotizacion`, limitado por Quote Adapter | Cotización, Historial y estado visible previo a una OT. |
| Estado operacional | `productionOrder.estado` y `PRODUCTION_STATUSES` | Workflow, Producción, summaries, Business State y estado visible del proyecto. |
| Disponibilidad de materiales | Compra y estados de `purchase_items` | `getPurchaseMaterialState()`, Workflow, Producción y summaries. |
| Proyecto entregado | `isProjectReadOnly(productionOrder)` cuando el estado canónico es `Entregado` | Guardas de hooks, controles de secciones, Inspector, Historial y Business State. |
| Identidad técnica | UUID de `entity.id` dentro de `workspace_id` | Adapters, repositories, storage, relaciones y auditoría. El folio no participa como identidad. |
| Integridad | Colecciones locales reales y lecturas Supabase bajo RLS | `runIntegrityAudit()` y su reporte; Business State no es fuente de auditoría. |
| Estado empresarial transversal | Summaries de cada dominio agregados por `getBusinessState()` | FLDSMDFR y consumidores futuros; nunca se persiste como verdad paralela. |
| Entrada persistente de optimización | Quote y su configuración de material | Smart Cut consume una copia normalizada, no muta la entrada y devuelve candidatos, diagnósticos y propuestas. |
| Resultado activo de optimización | Estado oficial `optimization` de Quote y candidato válido referenciado | Quote, BR Engine y Fabricación consumen el summary oficial; una referencia inexistente u obsoleta activa el fallback Legacy. |
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
- Inventario se construirá sobre movimientos, no sobre cantidades editadas únicamente en pantalla.
- Fabricación consume la orden y el plan de corte; no recalcula la optimización.
- Smart Cut no persiste por sí mismo, no modifica Quote directamente y no aplica propuestas automáticamente.
- El modo Legacy usa Shelf. El modo Smart Cut usa únicamente un candidato activo y válido; ante obsolescencia o ausencia vuelve temporalmente a Legacy.
- Una orden con estado `Entregado` permanece consultable, pero no admite actualizaciones, nuevas compras, cambios de historial ni configuración del workspace desde el proyecto activo.
- Los summaries y fuentes reutilizables alimentan Business State.
- Dashboard, Inspector Inteligente y Project Companion consumirán Business State en fases posteriores; el Centro del Proyecto mantiene su consumo parcial existente.

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

Optimization Sessions existe como dominio durable local y remoto y conserva únicamente referencias. No duplica candidatos ni geometría. Quote continúa siendo la única fuente de verdad que mantiene `optimization.activeSessionId`. La aplicación lee y escribe mediante Hook → Application Repository → Sync Engine; online utiliza Remote Repository y actualiza la caché local después de la confirmación remota, y offline utiliza Local Repository y Pending Operations Repository. La sincronización disponible es manual mediante `syncPendingOperations()`. Realtime entrega y reconcilia cambios remotos por workspace sin sustituir esa sincronización; la validación operacional externa, sincronización automática, resolución explícita de conflictos e historial remoto consolidado permanecen pendientes.

## 7. Roadmap maestro por etapas

| Etapa | Objetivo | Estado | Componentes y condición de cierre |
|---|---|---|---|
| I — Fundación | Establecer aplicación, workspace, diseño, motores y pruebas base. | Completada | Base React/Vite, BR Engine, estructura por proyecto y pruebas. |
| II — Cotizador profesional | Operar cotizaciones reales con cálculo, historial, colaboración y persistencia. | Completada con evolución continua | Cotización durable, PDF, catálogo, offline, Realtime e identidad canónica. |
| III — ERP operativo | Conectar el flujo desde Cotización hasta Entrega. | En desarrollo | Producción y Compras tienen base durable; Brand System, Business State 2.0, Operational Center, Smart Cut Etapas 1–7 y persistencia remota de Optimization Sessions están consolidados. Faltan Recepción, Inventario, remanentes, Fabricación durable, Instalación y Entrega. |
| IV — Inteligencia operativa | Convertir datos operativos en alertas, prioridades y decisiones. | Planeada | Business State 2.0 disponible; faltan consumidores dinámicos completos y trazabilidad de los dominios aún no durables. |
| V — Optimización industrial | Optimizar materiales, capacidad, tiempos y fabricación. | En desarrollo técnico adelantado | Smart Cut Engine, UI, Proposal, Active Mode y Optimization Sessions completos; persistencia local/remota, Sync Engine manual y Realtime por workspace implementados en código. Faltan validación operacional externa, sincronización automática, resolución explícita de conflictos, historial remoto consolidado, remanentes e integración definitiva con Inventario. |
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

Alcance durable auditado: `workspaces`, `quotes`, `productionOrders`, `purchases` y `purchaseItems`. Recepción, Inventario y Fabricación siguen siendo dominios no durables. Business State quedó fuera de la auditoría por ser consumidor derivado y no fuente de verdad.

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
| Optimization Sessions | Completado como dominio durable local y remoto |
| Remanentes reutilizables | Pendientes |
| Historial de optimizaciones | Pendiente |
| Sincronización | Sync Engine manual implementado; sincronización automática y resolución de conflictos pendientes |
| Realtime | Implementado en código y migración mediante Broadcast privado por workspace; validación operacional externa pendiente |
| Supabase | Client Adapter, tabla `optimization_sessions`, RLS, trigger de inmutabilidad de workspace y conexión desde la aplicación implementados |
| Integración definitiva con Inventario | Pendiente |

Smart Cut es actualmente uno de los módulos técnicamente más maduros del proyecto. Optimization Sessions es un dominio durable local y remoto con Remote Adapter, Remote Repository abstracto, Supabase Client Adapter inyectable, SQL, RLS, Application Repository, Sync Engine manual y Realtime desacoplado por workspace; el motor físico permanece desacoplado y congelado. La validación operacional externa de Realtime, sincronización automática, resolución explícita de conflictos, historial remoto consolidado, remanentes e integración definitiva con Inventario siguen pendientes.

La persistencia remota y el Sync Engine no modificaron Smart Cut Engine, geometría, estrategias, candidatos, evaluación, selección, Proposal, Active Mode ni Quote.

#### Estado oficial de Optimization Sessions Remote Persistence

**Estado:** COMPLETADA en el alcance de persistencia remota y sincronización manual.

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

La fase no incluye sincronización automática, reintentos automáticos, Background Sync, merge, resolución automática de conflictos ni historial remoto consolidado. La aplicación concreta de la nueva migración Realtime y su operación contra un backend externo no se declaran validadas sin evidencia operacional independiente.

#### Validación del cierre técnico

- `npm test`: 86 archivos y 676 pruebas aprobadas en el estado actual del repositorio.
- `npm run build`: correcto.
- `git diff --check`: correcto, sin errores de whitespace.
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
| 3 | 25.5 — Recepción Durable | Siguiente fase funcional |
| 4 | 25.6 — Inventario por Movimientos | Pendiente |
| 5 | Optimization Sessions — nueva fase de Smart Cut | Completada |
| 6 | Optimization Sessions Remote Persistence | Completada; SQL, RLS, trigger de workspace, conexión de aplicación, cola persistente y Sync Engine manual implementados |
| 7 | Remanentes reutilizables | Pendiente; depende de Sessions e Inventario |
| 8 | Fabricación Durable | Pendiente |
| 9 | Instalación y Entrega | Pendiente |
| 10 | ERP Operativo | Meta de cierre de la Etapa III |

Este orden es oficial. El adelanto técnico de Smart Cut no renumera Recepción Durable ni Inventario por Movimientos.

## 9. Estado real de los módulos

| Módulo | Clasificación verificable | Estado y límite actual |
|---|---|---|
| Cotización | Operativo y durable | Repository, offline queue, versionado, Realtime, Presence, historial e identidad canónica. Continúa como fuente de verdad persistente de la optimización y admite de forma aditiva el estado oficial Legacy/Smart Cut. Sus comandos de edición, guardado, estado, eliminación e importación se bloquean cuando la OT relacionada está entregada. `useQuotes.js` y `QuoteSection.jsx` requieren reducción progresiva. |
| Producción | Operativo y durable, con evolución pendiente | Motor, storage, repository, Supabase, sincronización, Realtime, versionado y summary. `Entregado` es terminal mediante `isProjectReadOnly()` y `canAdvanceProductionOrder()`. Falta completar evidencia operacional e historial transversal. |
| Compras | Operativo y durable | Persistencia local/remota, partidas, offline, Realtime, versionado y relaciones UUID con Producción y Cotización. La edición, autosave, sincronización pendiente y creación se bloquean para la OT entregada. |
| Recepción | Interfaz existente y fuente reutilizable; dominio incompleto | La pantalla deriva partidas y conserva cambios en estado React. Respeta el modo de solo lectura, pero no tiene todavía modelo durable, repository, storage ni movimientos propios. |
| Inventario | Interfaz existente y fuente reutilizable; dominio incompleto | Summary puro disponible; la pantalla calcula sobre datos de cotización y estado React y deshabilita edición en proyectos entregados. Falta modelo por movimientos y persistencia. |
| Fabricación | Interfaz existente y fuente reutilizable; dominio incompleto | Consume el summary oficial Legacy o Smart Cut activo y válido sin recalcular geometría, candidatos ni costos. Respeta el modo de solo lectura; checklist, progreso y notas no son todavía un dominio durable. |
| Smart Cut Engine / Cut Optimizer | Motor congelado y dominio de sesiones durable local/remoto con Realtime | Motor, Shelf, Best Fit, candidatos, evaluación, ranking, selección, recomendación, UI comparativa, Proposal y Active Mode completos. Optimization Sessions incorpora Source, Adapter, Local Repository, Remote Adapter, Remote Repository, Supabase Client Adapter, Application Repository, Repository Provider, Versioning, Storage, Offline Queue, Pending Operations Repository, Connectivity Provider, Sync Engine manual, Realtime Subscription, Reconciliation, Hook, Section, Summary y Selectors sin duplicar geometría. La tabla `optimization_sessions`, RLS, trigger de inmutabilidad de `workspace_id`, Broadcast privado por workspace y conexión React están implementados en código. Faltan validación operacional externa de Realtime, sincronización automática, resolución explícita de conflictos, historial remoto consolidado, remanentes e integración definitiva con Inventario. |
| Instalación | Pendiente como dominio | Existe como etapa, permiso y estado de workflow; no existe aún un dominio durable independiente. |
| Entrega | Estado terminal implementado; dominio de evidencia pendiente | `Entregado` existe en Producción, activa read only y se refleja como `Terminada` en Cotización. Faltan evidencia, firma y un dominio de cierre operacional independiente. |
| Historial | Operativo parcialmente | Cuenta con motor, summary, respaldo local y fundamentos remotos. Los proyectos entregados pueden abrirse y consultarse sin permitir cancelación, cambio de estado o eliminación. No equivale todavía a un historial transversal completo de todos los dominios. |
| Dashboard / Inicio | Operational Center implementado | Consume `businessState.projects`, summaries, indicadores y actividad; selecciona un proyecto en foco y ofrece tarjetas expandibles reutilizables sin convertir la UI en fuente de verdad. |
| Inspector Inteligente | Interfaz funcional parcial | Calcula riesgos y acciones desde Cotización. Para proyectos entregados muestra información histórica y conserva únicamente accesos de consulta. Aún no consume Business State ni todos los dominios. |
| Project Companion | Interfaz funcional parcial | Usa Workflow Engine con contexto incompleto y contiene actividad fija; la integración común con Business State está pendiente. |
| Centro del Proyecto | Estructura visual existente | La FLDSMDFR empresarial consume Business State solo con settings y orden activa, y muestra el modo editable/solo lectura. El resto continúa mayormente informativo o vacío y no sincroniza `PROJECT_MASTER.md`. |
| Business State | Adapter central derivado implementado | Expone las vistas y summaries empresariales de 25.3 sin persistencia ni reglas de dominio. Dashboard ya consume su contrato operativo; Inspector y Companion todavía no lo consumen por completo. Objetivos, roadmap y decisiones permanecen vacíos por falta de fuente canónica. |
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
- Recepción — Pendiente.
- Inventario — Implementada como vista derivada.
- Fabricación — Implementada como vista derivada.
- Historial — Implementada como vista derivada.
- Instalación — Pendiente.
- Entrega — Pendiente.

Las tarjetas implementadas muestran estados y conteos derivados de Business State, se expanden dentro de Inicio y permiten abrir el módulo correspondiente. Realtime y las tarjetas de los dominios todavía incompletos permanecen pendientes. No deben depender de textos fijos.

### Panel izquierdo

Compras ya tiene una base durable. Recepción, Inventario y Fabricación deben completar, según corresponda: modelo canónico, UUID, workspace, storage local, repository, Supabase, RLS, offline, sincronización, Realtime, versionado, summary, Business State y actualización de Inicio e Inspector. Smart Cut ya completó motor, UI, Proposal y Active Mode; su evolución durable conserva el orden específico documentado a continuación.

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
✓ IMPLEMENTADO EN CÓDIGO Y MIGRACIÓN
↓
Remanentes reutilizables
↓
Integración definitiva con Inventario
```

Remote Adapter, Remote Repository, Supabase Client Adapter, tabla SQL, RLS, trigger de protección de workspace, conexión desde la aplicación, Sync Engine manual y Realtime por Broadcast privado están implementados. El siguiente hito técnico del módulo es Remanentes reutilizables, cuya propiedad durable deberá pertenecer a Inventario. Este orden no modifica las fases funcionales ni el roadmap general del ERP.

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

Ya implementado: una orden `Entregado` no puede avanzar ni actualizarse desde el hook, y la aplicación bloquea comandos relacionados de Cotización, Compras, Workspace y colas offline. No existe todavía una constraint específica de base de datos que convierta este bloqueo de aplicación en una regla durable frente a clientes externos.

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
- Validar operacionalmente Realtime de Optimization Sessions contra el backend externo después de aplicar la migración.
- Definir sincronización automática y reintentos únicamente con política explícita de idempotencia.
- Diseñar una resolución explícita de operaciones `failed` y `conflict` sin merge automático.
- Mantener el dominio desacoplado de Supabase.
- Incorporar historial remoto consolidado manteniendo Quote como fuente de verdad.
- Delegar la propiedad durable de remanentes a Inventario; Smart Cut solo podrá consumirlos y proponer su uso.

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
| 4 | Inventario | Summary implementado; dominio durable pendiente. |
| 5 | Clientes | Summary derivado disponible; dominio propio pendiente. |
| 6 | Finanzas | Summary derivado disponible; dominio administrativo pendiente. |
| 7 | Fabricación | Summary y lectura del plan Legacy o del candidato Smart Cut activo y válido disponibles; Fabricación no recalcula la optimización. Persistencia operacional propia pendiente. |
| 8 | Recepción e Historial | Summaries disponibles; dominios transversales completos pendientes. |
| 9 | Integración con Business State | Adapter 2.0 implementado con salud, riesgos, pendientes, actividad, alertas, indicadores, última actualización y read only. Consumidores completos pendientes. |
| 10 | Smart Cut | Summary físico, candidatos, ranking, recomendación, Proposal y resolución de Active Mode disponibles como fuentes puras. Optimization Sessions es durable local/remoto y dispone de Remote Adapter, Remote Repository, Supabase Client Adapter, tabla, RLS, conexión de aplicación, cola persistente, Sync Engine manual y Realtime por workspace; validación operacional externa, automatización e historial remoto consolidado permanecen pendientes. |

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
| Pendiente de validación | Recepción depende de partidas de Compras. | Preservar trazabilidad y evitar reconstrucciones. | Vigente; implementación pendiente |
| Pendiente de validación | Inventario se basará en movimientos. | Garantizar trazabilidad de existencias. | Pendiente |
| 26/07/2026 | Shelf seguirá siendo el fallback oficial. | Mantener continuidad total con cotizaciones Legacy y garantizar una optimización disponible ante candidatos ausentes u obsoletos. | Implementada |
| 26/07/2026 | No duplicar geometría. | El motor es la única autoridad del cálculo físico; UI, Proposal, Quote y Fabricación solo consumen sus resultados. | Vigente |
| 26/07/2026 | No duplicar candidatos. | Active Mode y persistencia futura guardarán referencias y estado, no copias paralelas de soluciones. | Vigente |
| 26/07/2026 | Quote sigue siendo la fuente de verdad persistente de la optimización. | Smart Cut calcula y propone sin convertirse en dominio propietario ni aplicar resultados automáticamente. | Vigente |
| 26/07/2026 | Optimization Sessions existirán antes que los remanentes reutilizables. | Dar identidad, trazabilidad y ciclo de vida a cada ejecución antes de relacionar sobrantes. | Implementada como dominio durable local y remoto |
| 26/07/2026 | Optimization Sessions evolucionará como dominio independiente. | Optimization Sessions conservará identidad, versionado, persistencia y sincronización propios sin convertir Smart Cut en propietario de datos empresariales. | Implementada con Sync Engine manual y Realtime por workspace; automatización pendiente |
| 26/07/2026 | El Remote Repository permanecerá desacoplado del proveedor. | El dominio dependerá únicamente de un contrato abstracto de cliente remoto. Supabase será una implementación concreta y sustituible. | Implementada |
| 26/07/2026 | Inventario será propietario de los remanentes. | Evitar un inventario paralelo dentro de Smart Cut y conservar la arquitectura por movimientos. | Pendiente de implementación |
| 26/07/2026 | Fabricación nunca recalculará la optimización. | Consumir el summary oficial evita divergencias físicas y económicas. | Implementada en el consumo actual |
| 26/07/2026 | Smart Cut permanecerá desacoplado del ERP. | El motor no conoce React, Quote, Fabricación, Supabase ni persistencia y solo expone resultados deterministas. | Vigente |
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

## 16. Próximo sprint oficial

### Remanentes reutilizables

**Estado:** SIGUIENTE HITO TÉCNICO DEL MÓDULO SMART CUT.

**Propósito:** permitir que Inventario sea propietario durable de remanentes reutilizables y que Smart Cut únicamente los consuma o proponga, sin convertir el motor en inventario paralelo.

**Estado alcanzado:**

- Contrato durable v2 y migración desde v1.
- Adapter local y Repository local.
- Remote Adapter con traducción `camelCase` ↔ `snake_case`.
- Remote Repository desacoplado mediante un cliente abstracto inyectado.
- Supabase Client Adapter inyectable con operaciones `insert`, `update`, `selectOne`, `selectMany` y `delete`, aislamiento por workspace y errores normalizados.
- Tabla `optimization_sessions` e índices por workspace.
- RLS separado para SELECT, INSERT, UPDATE y DELETE.
- Trigger de inmutabilidad de `workspace_id`.
- Application Repository y Repository Provider como composición única.
- Connectivity Provider y Pending Operations Repository persistente.
- Create/update/delete online y offline.
- Compactación segura de operaciones.
- Sync Engine manual y `syncPendingOperations()`.
- Detección y registro de conflictos sin resolución automática.
- Versionado optimista mediante `expectedVersion`.
- Storage local aislado por workspace y recuperación segura.
- Selectors, Summary, Hook y Section reutilizables.
- Quote conserva únicamente `optimization.activeSessionId`.

**Estado Realtime alcanzado:**

- Broadcast privado aislado por workspace para INSERT, UPDATE y DELETE.
- Autorización del topic mediante membresía activa y `view_workspace`.
- Remote Adapter como único normalizador de filas.
- Reconciliación por `version`, `updatedAt`, `revision` y operaciones pendientes.
- Eventos antiguos, duplicados y ecos ignorados.
- Conflictos preservados sin resolución automática.
- Hook con apertura, limpieza y cambio de workspace sin importar Supabase.
- 86 archivos y 676 pruebas aprobadas; build y `git diff --check` correctos.

La migración Realtime aún requiere validación operacional contra el backend externo. Realtime no sustituye Sync Engine, versionado, cola ni confirmación remota. La sincronización automática, reintentos, Background Sync, merge, resolución de conflictos e historial remoto consolidado permanecen fuera de alcance.

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
| Recepción | Baja | Media | Fase 25.5 |
| Inventario | Baja | Media | Fase 25.6 |
| Smart Cut | Baja | Bajo | UI, Optimization Sessions Remote Persistence y Realtime completados en código; remanentes reutilizables como siguiente hito técnico |
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
| 28/07/2026 | Optimization Sessions — Realtime | Broadcast privado por workspace, reconciliación segura de INSERT/UPDATE/DELETE, prevención de ecos y duplicados, preservación de conflictos e integración Hook → Application Repository implementados. Validación local: 86 archivos, 676 pruebas y build correctos; validación operacional externa pendiente. |
| Próxima fase técnica | Smart Cut / Inventario | Remanentes reutilizables. |
| Próxima fase funcional | 25.5 | Recepción Durable. |

## Estado del núcleo del ERP

Identidad ............. Estable
Workspace ............. Estable
Producción ............ Durable
Compras ............... Durable
Read-only ............. Estable
Integrity Audit ....... Certificada
Hardening ............. Completado
Brand System .......... Consolidado
Business State 2.0 .... Implementado
Smart Cut Engine ...... Técnicamente completo y congelado
Smart Cut UI .......... Completa
Smart Cut Proposal .... Completa
Smart Cut Active Mode . Completo
Optimization Sessions . Durable local + remoto
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
Realtime .............. Implementado en código; validación externa pendiente
Persistencia Sessions . Completada con Realtime
PM2 desarrollo ........ Configurado localmente
ERP Operativo ......... En desarrollo
