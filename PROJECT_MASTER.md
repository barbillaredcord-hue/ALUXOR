# BRTuNegocio

> Documento maestro de identidad, dirección, arquitectura y estado del producto.

- **Workspace operativo actual:** ALUXOR / BosqueReal
- **Etapa activa:** Etapa III — ERP operativo
- **Fase oficial:** 25.2D — Hardening Operativo
- **Última actualización:** 23/07/2026

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

Cliente → Cotización → Producción → Compras → Recepción → Inventario → Fabricación → Cut Optimizer → Instalación → Entrega → Cobranza → Garantía → Historial → Análisis e IA

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
- Las pantallas consumen información; no son fuentes de verdad.
- Cada sprint deja una mejora real y una actualización breve de continuidad.
- Ninguna función importante se considera cerrada sin funcionamiento, documentación, roadmap y pendientes derivados.

## 5. Arquitectura canónica

Contrato de evolución por dominio:

Source → Adapter → Repository → Versioning → Storage / Offline → Hook → Section → Summary → Business State

| Capa | Responsabilidad |
|---|---|
| Source | Modelo, motor o colección propietaria del dominio. |
| Adapter | Traducción entre el modelo interno y formatos externos. |
| Repository | Acceso remoto y operaciones persistentes del dominio. |
| Versioning | Control de concurrencia, revisiones y resolución de cambios. |
| Storage / Offline | Copia local, cola offline y recuperación segura. |
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
- **Cut Optimizer:** motor determinista, validación física y salida consumida por BR Engine y Fabricación; su persistencia operacional sigue pendiente.
- **Business State:** adapter derivado que agrega summaries de cotización, producción, compras, inventario, clientes, finanzas, fabricación, historial y workflow; también expone `project.readOnly` y `project.mode` desde la orden activa.
- **Workspace:** aislamiento y permisos como contexto empresarial; el indicador permanente de workspace del sistema sigue pendiente.
- **Brand System:** branding y PWA oficiales están integrados. Existen tokens JavaScript, tokens CSS no importados y un `BRCard` funcional; el índice de diseño, utilidad de tema y la mayoría de componentes `BR*` continúan vacíos o sin adopción.
- **Storage, Offline y Realtime:** implementados en los dominios durables, no todavía en todo el ERP.
- **Supabase:** persistencia remota de los dominios habilitados, bajo sesión y RLS existentes.

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
| Branding activo | Recursos de `public/branding`, manifest, favicons y CSS actualmente importado | Login, shell, encabezado, PWA y documentos. Los tokens de Design System todavía no son fuente activa de la UI. |

Contrato de solo lectura:

Production `Entregado` → `isProjectReadOnly()` → rechazo de comandos en hooks → controles existentes de consulta sin edición.

No existe una pantalla alternativa ni un flag persistido de read only. La protección actual pertenece a la aplicación; no se añadió una constraint o política RLS específica para el estado `Entregado`.

## 6. Flujo operativo canónico

Cotización → Producción → Compras → Recepción → Inventario → Fabricación → Cut Optimizer → Instalación → Entrega

Reglas oficiales:

- Cada dominio conserva trazabilidad por UUID hacia el anterior.
- Ningún módulo reconstruye información que ya pertenece a otro dominio.
- Una vez creada la OT, Producción determina el estado operacional; Cotización conserva el contexto comercial.
- Recepción debe originarse en partidas de Compras.
- Inventario se construirá sobre movimientos, no sobre cantidades editadas únicamente en pantalla.
- Fabricación consume la orden y el plan de corte; no recalcula la optimización.
- Una orden con estado `Entregado` permanece consultable, pero no admite actualizaciones, nuevas compras, cambios de historial ni configuración del workspace desde el proyecto activo.
- Los summaries y fuentes reutilizables alimentan Business State.
- Inicio e Inspector consumirán Business State en fases posteriores; actualmente todavía usan datos directos o parciales.

## 7. Roadmap maestro por etapas

| Etapa | Objetivo | Estado | Componentes y condición de cierre |
|---|---|---|---|
| I — Fundación | Establecer aplicación, workspace, diseño, motores y pruebas base. | Completada | Base React/Vite, BR Engine, estructura por proyecto y pruebas. |
| II — Cotizador profesional | Operar cotizaciones reales con cálculo, historial, colaboración y persistencia. | Completada con evolución continua | Cotización durable, PDF, catálogo, offline, Realtime e identidad canónica. |
| III — ERP operativo | Conectar el flujo desde Cotización hasta Entrega. | En desarrollo | Producción y Compras tienen base durable; faltan completar Recepción, Inventario, Fabricación, Instalación y Entrega. La infraestructura visual transversal se consolidará en 25.2E sin sustituir las condiciones operativas. Cierra funcionalmente en Fase 26.0. |
| IV — Inteligencia operativa | Convertir datos operativos en alertas, prioridades y decisiones. | Planeada | Business State completo, Inicio e Inspector dinámicos y trazabilidad confiable. |
| V — Optimización industrial | Optimizar materiales, capacidad, tiempos y fabricación. | Planeada | Cut Optimizer persistente e integrado al flujo real del taller. |
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
- El hallazgo corresponde al generador de folios, no bloquea el cierre de 25.2C y queda como pendiente oficial de 25.2D.

Diferencias informativas:

- Dos cotizaciones remotas no están presentes localmente.
- Un workspace remoto no está representado como colección local.
- Estas diferencias se clasifican como `INFO`; no demuestran corrupción ni bloquean el hardening.

Alcance durable auditado: `workspaces`, `quotes`, `productionOrders`, `purchases` y `purchaseItems`. Recepción, Inventario y Fabricación siguen siendo dominios no durables. Business State quedó fuera de la auditoría por ser consumidor derivado y no fuente de verdad.

La evidencia estructurada se conserva fuera del repositorio como reporte JSON generado en `2026-07-23T05:29:16.280Z`.

### 25.2D — Hardening Operativo

**Estado:** PENDIENTE / SIGUIENTE FASE.

**Objetivo:** endurecer reglas operativas, invariantes y protecciones antes de ampliar dominios.

El primer frente obligatorio será un generador resiliente de folios comerciales: unicidad por workspace, cálculo sobre el máximo local y remoto, prevención de colisiones entre dispositivos y sesiones nuevas o con información local incompleta, y reintento con incremento ante colisión. El folio nunca será identidad ni sustituirá el UUID.

También deberá incorporar validación previa a escritura, invariantes operativas, protección de estados terminales, evaluación de `NOT NULL`, unicidad de identidad y Foreign Keys, respaldo, rollback documentado, ejecución incremental y una auditoría posterior a cada endurecimiento.

### 25.2E — Brand System e infraestructura visual

**Estado:** pendiente y condicionado al cierre seguro de 25.2D.

**Propósito:**

Convertir el Brand Book v1.0 en una infraestructura visual reutilizable, progresiva y aislada de la lógica del ERP, de manera que las fases funcionales posteriores puedan utilizar una identidad coherente sin introducir una reestructuración general ni retrabajo innecesario.

**Base disponible:**

- Brand Book v1.0 documental.
- README de identidad visual.
- Tokens CSS iniciales no importados.
- Tokens JavaScript de color, movimiento, radios, sombras, espaciado, tipografía y capas, todavía sin un índice público activo.
- `BRCard` implementado como primer componente visual aislado; la mayoría de archivos `BR*` son scaffolds vacíos y no deben considerarse componentes terminados.
- Logos oficiales ya integrados en recursos de branding.
- Branding existente en autenticación, navegación, encabezado, PWA, reportes y documentos seleccionados.

**Alcance permitido:**

- Consolidar tokens de color, tipografía, espaciado, radios y sombras.
- Crear capas CSS visuales independientes cuando sea necesario; se prevén `brand-theme.css`, `brand-components.css`, `brand-layout.css`, `brand-print.css` y `brand-accessibility.css`, pero todavía no se consideran existentes.
- Importar los tokens de forma controlada cuando se demuestre que no cambia el comportamiento.
- Sustituir valores visuales hardcodeados por variables equivalentes de forma incremental.
- Preservar inicialmente la apariencia y dimensiones existentes.
- Definir componentes o clases visuales reutilizables sin apropiarse de comportamiento.
- Aplicar progresivamente el sistema visual a login, navegación, encabezados, dashboard, documentos y superficies no críticas.
- Preparar nuevas pantallas para que nazcan con la identidad oficial.
- Documentar versiones, decisiones y excepciones visuales.

**Fuera de alcance:**

- Rediseñar módulos completos o reorganizar componentes.
- Cambiar flujos de usuario, lógica de negocio, cálculos, estados, hooks o eventos.
- Introducir Context, ThemeProvider o una nueva fuente de verdad visual en React.
- Migrar a Tailwind, CSS-in-JS o una biblioteca visual nueva.
- Modificar BR Engine, Workflow, Business State, Identity o Integrity.
- Modificar repositories, Supabase, storage, offline, Realtime o versionado.
- Alterar permisos o aislamiento por workspace.
- Cambiar estados semánticos por colores decorativos de la marca.
- Aplicar masivamente estilos sin validación por superficie.
- Bloquear fases funcionales por mejoras puramente estéticas.

**Orden de implementación recomendado:**

1. Tokens y variables visuales.
2. Tema global compatible con los estilos existentes.
3. Clases visuales compartidas.
4. Impresión y PDFs.
5. Login y autenticación visual.
6. Sidebar y encabezado.
7. Dashboard / Inicio.
8. Inspector y Companion.
9. Centro del Proyecto y biblioteca visual.
10. Migración gradual de módulos operativos únicamente cuando no interfiera con su fase funcional.

**Reglas de seguridad:**

- Cada cambio debe ser visualmente verificable y reversible.
- La primera sustitución de valores debe conservar el mismo valor calculado.
- No modificar simultáneamente estilo y lógica en un mismo cambio.
- No mover JSX solo para adaptar el diseño.
- No cambiar nombres, eventos ni props de componentes por razones visuales.
- No alterar selectores utilizados por pruebas o automatización sin necesidad comprobada.
- No introducir dependencias externas para implementar la identidad.
- Mantener contraste y accesibilidad.
- Validar responsive e impresión cuando corresponda.
- Si una migración visual requiere tocar lógica, debe aplazarse y tratarse en una fase separada.

**Criterios de salida:**

- Tokens oficiales integrados de forma segura.
- Capas visuales definidas y documentadas.
- Ninguna regresión funcional.
- Ningún cambio de contrato en módulos operativos.
- Build y pruebas existentes correctos.
- Validación visual de las superficies migradas.
- Documentación de componentes, colores y estados.
- Estrategia clara para migración progresiva.
- Las fases 25.3 a 26.0 pueden construir nuevas interfaces sobre el sistema visual sin depender de una reescritura.

> La Fase 25.2E no declara finalizado el diseño completo del ERP. Establece la infraestructura para una evolución visual progresiva. La operación, estabilidad e integridad conservan prioridad sobre la estética.

### Fases posteriores de la Etapa III

| Fase | Estado |
|---|---|
| 25.2E — Brand System e infraestructura visual | Pendiente y condicionada |
| 25.3 — Business State 2.0 | Pendiente |
| 25.4 — Operational Center | Pendiente |
| 25.5 — Recepción | Pendiente |
| 25.6 — Inventario | Pendiente |
| 25.7 — Cut Optimizer persistente | Pendiente |
| 25.8 — Fabricación | Pendiente |
| 25.9 — Instalación y Entrega | Pendiente |
| 26.0 — ERP operativo completo | Meta de cierre de la Etapa III |

## 9. Estado real de los módulos

| Módulo | Clasificación verificable | Estado y límite actual |
|---|---|---|
| Cotización | Operativo y durable | Repository, offline queue, versionado, Realtime, Presence, historial e identidad canónica. Sus comandos de edición, guardado, estado, eliminación e importación se bloquean cuando la OT relacionada está entregada. `useQuotes.js` y `QuoteSection.jsx` requieren reducción progresiva. |
| Producción | Operativo y durable, con evolución pendiente | Motor, storage, repository, Supabase, sincronización, Realtime, versionado y summary. `Entregado` es terminal mediante `isProjectReadOnly()` y `canAdvanceProductionOrder()`. Falta completar evidencia operacional e historial transversal. |
| Compras | Operativo y durable | Persistencia local/remota, partidas, offline, Realtime, versionado y relaciones UUID con Producción y Cotización. La edición, autosave, sincronización pendiente y creación se bloquean para la OT entregada. |
| Recepción | Interfaz existente y fuente reutilizable; dominio incompleto | La pantalla deriva partidas y conserva cambios en estado React. Respeta el modo de solo lectura, pero no tiene todavía modelo durable, repository, storage ni movimientos propios. |
| Inventario | Interfaz existente y fuente reutilizable; dominio incompleto | Summary puro disponible; la pantalla calcula sobre datos de cotización y estado React y deshabilita edición en proyectos entregados. Falta modelo por movimientos y persistencia. |
| Fabricación | Interfaz existente y fuente reutilizable; dominio incompleto | Consume el plan del Cut Optimizer y respeta el modo de solo lectura; checklist, progreso y notas no son todavía un dominio durable. |
| Cut Optimizer | Motor operativo y fuente reutilizable | Calcula, valida y expone summary; sus controles quedan bloqueados en proyectos entregados. Falta persistir ejecuciones y conectarlas al proyecto operativo. |
| Instalación | Pendiente como dominio | Existe como etapa, permiso y estado de workflow; no existe aún un dominio durable independiente. |
| Entrega | Estado terminal implementado; dominio de evidencia pendiente | `Entregado` existe en Producción, activa read only y se refleja como `Terminada` en Cotización. Faltan evidencia, firma y un dominio de cierre operacional independiente. |
| Historial | Operativo parcialmente | Cuenta con motor, summary, respaldo local y fundamentos remotos. Los proyectos entregados pueden abrirse y consultarse sin permitir cancelación, cambio de estado o eliminación. No equivale todavía a un historial transversal completo de todos los dominios. |
| Dashboard / Inicio | Interfaz existente pero incompleta | Usa datos del proyecto activo y contiene actividad o checklist parcialmente fijos; aún no consume Business State como centro de operaciones. |
| Inspector Inteligente | Interfaz funcional parcial | Calcula riesgos y acciones desde Cotización. Para proyectos entregados muestra información histórica y conserva únicamente accesos de consulta. Aún no consume Business State ni todos los dominios. |
| Project Companion | Interfaz funcional parcial | Usa Workflow Engine con contexto incompleto y contiene actividad fija; la integración común con Business State está pendiente. |
| Centro del Proyecto | Estructura visual existente | La FLDSMDFR empresarial consume Business State solo con settings y orden activa, y muestra el modo editable/solo lectura. El resto continúa mayormente informativo o vacío y no sincroniza `PROJECT_MASTER.md`. |
| Business State | Adapter derivado implementado parcialmente | Agrega summaries reales de varios dominios y expone `project.readOnly`/`project.mode`. Objetivos, roadmap, decisiones, alertas, salud y consumidores completos todavía no tienen una fuente durable. |
| Identity Infrastructure | Implementada con convergencia pendiente | Normaliza, compara y preserva UUID, detecta duplicados y separa folio de identidad. Producción y Compras aún no consumen exclusivamente `createUuid.js`. |
| Integrity Audit | Implementada y validada operacionalmente | `runIntegrityAudit()` auditó el workspace real con almacenamiento local y Supabase autenticado: `READY WITH WARNINGS`, sin errores ni deuda legacy bloqueante. Persiste una advertencia de folio comercial duplicado y tres diferencias informativas. |
| Workspace | Operativo y durable | Bootstrap RPC idempotente, membresías, roles, permisos, settings, branding, auditoría y Realtime bajo RLS. Las mutaciones de settings se bloquean durante un proyecto entregado; `is_system_workspace` sigue pendiente. |
| Brand System | Branding operativo; Design System parcial | Logos, favicons, PWA y branding dinámico existen. Tokens JS y CSS están disponibles pero no gobiernan la app; solo `BRCard` tiene implementación y no hay adopción general de componentes `BR*`. |

### Estado visual transversal

El branding oficial ya está presente en recursos PWA y superficies seleccionadas, y el Brand Book v1.0 está documentado. Existen tokens CSS y módulos JavaScript, pero no están importados por `main.jsx` ni gobiernan la interfaz. `BRCard` es el único componente compartido implementado y no tiene consumidores; los demás archivos `BR*`, el índice de diseño y la utilidad de tema están vacíos. La interfaz conserva estilos históricos y reglas visuales dispersas; su consolidación corresponde a 25.2E. Un módulo no se considera más operativo o durable por recibir mejoras visuales.

## 10. Pendientes funcionales prioritarios

### Tarjetas del Inicio

Estado registrado para su evolución:

- Cotización — En proceso.
- Producción — Pendiente.
- Compras — Pendiente.
- Recepción — Pendiente.
- Inventario — Pendiente.
- Fabricación — Pendiente.
- Instalación — Pendiente.
- Entrega — Pendiente.

Deben mostrar estados y conteos reales, abrir o filtrar el dominio correspondiente, actualizarse automáticamente, reaccionar a Realtime y derivarse del flujo canónico mediante Business State. No deben depender de textos fijos.

### Panel izquierdo

Compras ya tiene una base durable. Recepción, Inventario, Fabricación y Cut Optimizer deben completar, según corresponda: modelo canónico, UUID, workspace, storage local, repository, Supabase, RLS, offline, sincronización, Realtime, versionado, summary, Business State y actualización de Inicio e Inspector.

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

- Implementar en 25.2D un generador resiliente de folios comerciales por workspace, sin convertir el folio en identidad.
- Mantener la evidencia operacional de 25.2C fuera del código y repetir la auditoría después de cada endurecimiento.
- No iniciar reparación legacy mientras la evidencia no demuestre su necesidad; 25.2C concluyó con `requiresLegacyRepair: false`.
- Activar constraints únicamente después de validación adicional, respaldo y rollback documentado.
- Converger la generación UUID de Producción y Compras hacia `createUuid.js` sin regenerar identidades existentes.
- Evaluar en 25.2D si el estado terminal `Entregado` requiere enforcement adicional en base de datos; actualmente la protección es de motor, hooks y UI.
- Revisar y dividir `useQuotes.js`.
- Reducir `QuoteSection.jsx`.
- Revisar `useProduction.js`.
- Reducir `ProductionSection.jsx`.
- No introducir Context sin necesidad demostrada.
- Evitar lógica de negocio en componentes y fuentes de verdad duplicadas.
- Consolidar una sola suscripción Realtime por workspace cuando corresponda.
- Impedir escrituras provocadas por eventos remotos.
- Conservar merge por UUID, `updatedAt` y `version`.
- Completar el contrato arquitectónico por dominio sin rediseñar módulos que puedan evolucionar incrementalmente.

### Pendientes de infraestructura visual

- Definir y exportar un único contrato de tokens; actualmente conviven CSS y módulos JavaScript sin integración.
- Integrar tokens sin cambiar valores calculados.
- Separar tokens de marca y colores semánticos.
- Consolidar estilos repetidos de forma incremental.
- Definir capas de tema, componentes, layout, impresión y accesibilidad.
- Evitar dependencias entre CSS visual y reglas de negocio.
- Documentar excepciones y estilos legacy.
- Crear una estrategia de migración por superficie.
- Conservar los selectores requeridos por pruebas y automatización.
- Verificar contraste, responsive e impresión.
- Evitar que 25.2E exceda el alcance de infraestructura y se convierta en un rediseño general.
- Reducir progresivamente estilos duplicados.
- Definir versión oficial del Design System.
- Mantener historial de cambios visuales.
- Preparar la futura Biblioteca Visual para consulta interna.
- Completar o retirar los scaffolds vacíos de componentes `BR*`; solo `BRCard` tiene implementación verificable.

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
| 7 | Fabricación | Summary y lectura del plan de corte disponibles; persistencia pendiente. |
| 8 | Recepción e Historial | Summaries disponibles; dominios transversales completos pendientes. |
| 9 | Integración con Business State | Agregación inicial implementada; consumidores y campos empresariales pendientes. |

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

Actualmente existen superficies para la FLDSMDFR empresarial y la FLDSMDFR del Sistema. La empresarial invoca `getBusinessState()` con los settings y la orden de Producción activa, por lo que puede mostrar el nombre del workspace y el modo editable/solo lectura. Los objetivos, roadmap, pendientes, decisiones, historial, próximos pasos y alertas siguen vacíos; varias partes continúan visuales, estáticas o informativas. `PROJECT_MASTER.md` es documentación manual y no sincroniza automáticamente con la UI.

Pendientes:

- Sustituir contenido fijo por datos estructurados.
- Implementar sincronización segura.
- Incorporar roadmap visual y gestor de pendientes.
- Registrar decisiones, salud y métricas reales.
- Hacer navegable la documentación sin convertir la UI en fuente de verdad.
- Incorporar, después de completar la infraestructura mínima de 25.2E, una Biblioteca Visual de solo lectura basada en el Brand Book.
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
| Pendiente de validación | Cut Optimizer será persistente y conectado al flujo. | Conservar planes de corte como evidencia operacional. | Pendiente |
| 20/07/2026 | Business State no contiene lógica de negocio. | Concentrar summaries sin apropiarse de reglas. | Implementada parcialmente |
| Pendiente de validación | FLDSMDFR empresarial y del Sistema nunca se mezclan. | Separar negocio y desarrollo interno. | Vigente |
| 22/07/2026 | UUID es identidad y folio es referencia comercial. | Evitar colisiones y merges incorrectos. | Implementada |
| 22/07/2026 | No activar constraints sin auditoría real. | Prevenir fallos o pérdida de continuidad por deuda legacy. | Vigente |
| 22/07/2026 | `Entregado` es terminal y activa el modo de solo lectura desde Production Engine. | Preservar el proyecto finalizado como evidencia histórica y evitar mutaciones posteriores. | Implementada en motor, hooks y UI |
| 22/07/2026 | El modo de solo lectura deriva únicamente del estado canónico de Producción. | Evitar flags paralelos y reglas repetidas por módulo. | Implementada |
| 22/07/2026 | `runIntegrityAudit()` es la entrada pública única de la auditoría 25.2C. | Garantizar una secuencia determinista de auditoría local, remota, comparación y reporte. | Implementada y validada operacionalmente |
| 22/07/2026 | Las pruebas con mocks no cierran 25.2C. | La readiness para 25.2D requiere evidencia de los datos reales bajo sesión y RLS reales. | Cumplida mediante auditoría real el 23/07/2026 |
| 23/07/2026 | Dos entidades con UUID distintos nunca se fusionan por compartir folio. | El folio es referencia comercial; la identidad canónica pertenece al UUID dentro del workspace. | Vigente |
| 23/07/2026 | Toda restricción SQL futura debe estar precedida por auditoría real, respaldo y rollback documentado. | Conservar continuidad operacional y evitar endurecer datos sin evidencia suficiente. | Vigente |
| Pendiente de validación | No rediseñar módulos que puedan completarse incrementalmente. | Reducir riesgo y conservar valor operativo. | Vigente |
| Pendiente de validación | Inicio evolucionará hacia Centro de Operaciones. | Mostrar el estado real del flujo. | Pendiente |
| Pendiente de validación | Una función importante requiere operación, documentación, roadmap y pendientes derivados para cerrarse. | Evitar cierres únicamente visuales. | Vigente |
| 22/07/2026 | Implementar el Brand System en 25.2E, después de integridad y antes de Business State 2.0. | Evitar retrabajo visual en los nuevos módulos sin distraer la auditoría ni modificar lógica operativa. | Planeada |
| 22/07/2026 | La identidad visual será una capa transversal separada de las reglas del dominio. | Preservar estabilidad, mantenibilidad y fuentes de verdad. | Vigente |
| 22/07/2026 | El Brand System adoptará una estrategia incremental por superficie. | Reducir riesgo y facilitar la validación visual. | Vigente |
| 22/07/2026 | Después de finalizar 25.2E, los cambios globales del sistema visual deberán pasar por revisión arquitectónica. | Evitar regresiones visuales y mantener consistencia. | Vigente |

Las fechas no verificables se mantienen como **Pendiente de validación**; no se atribuyen autores sin evidencia.

## 16. Próximo sprint oficial

### Fase 25.2D — Hardening Operativo

**Estado:** PENDIENTE / SIGUIENTE FASE.

**Propósito:** endurecer reglas operativas, invariantes y protecciones antes de ampliar dominios, apoyándose en la evidencia real de 25.2C.

**Evidencia habilitante:**

- Auditoría real cerrada como `READY WITH WARNINGS`.
- Cero hallazgos `CRITICAL` y cero `ERROR`.
- Readiness positiva para `NOT NULL`, identidad única y Foreign Keys.
- Reparación legacy no requerida.
- Un folio comercial duplicado pendiente de prevención.

**Primer frente obligatorio: generador resiliente de folios comerciales**

- Garantizar unicidad por workspace.
- Calcular el siguiente folio considerando el máximo local y remoto.
- Prevenir colisiones entre dispositivos, sesiones nuevas y estados locales incompletos.
- Reintentar e incrementar ante una colisión confirmada.
- Mantener el folio como referencia comercial.
- Nunca usar el folio como identidad ni reemplazar el UUID.

**Frentes posteriores:**

- Validación previa a escritura.
- Invariantes operativas.
- Protección durable de estados terminales.
- Evaluación gradual de `NOT NULL`, unicidad de identidad y Foreign Keys.
- Respaldo y rollback documentado antes de cualquier restricción.
- Ejecución incremental.
- Auditoría real después de cada endurecimiento.

**Contratos obligatorios:**

- UUID es identidad canónica y el folio es referencia comercial.
- Dos entidades con UUID distintos nunca se fusionan por folio.
- `runIntegrityAudit()` continúa siendo la entrada pública oficial de auditoría.
- El hardening no se activa sin auditoría, respaldo y rollback.
- Cada cambio debe conservar aislamiento por workspace.

**Criterio de salida:**

- Generación de folios resistente a colisiones y validada por workspace.
- Protecciones de escritura e invariantes verificadas.
- Plan de respaldo y rollback aprobado antes de cualquier restricción.
- Endurecimientos ejecutados incrementalmente.
- Auditoría posterior sin errores bloqueantes.

> **Nota de secuencia:** 25.2E permanece registrada como fase futura y pendiente. Su ejecución depende del cierre seguro y documentado de 25.2D.

## Infraestructura visual y Brand System

### Fuente documental

- `docs/branding/BRAND_BOOK_V1.md`
- `docs/branding/README.md`
- `src/styles/brand-tokens.css`
- `src/design/tokens/*.js`
- `src/components/ui/BRCard.jsx`

Los dos documentos de branding, la base CSS y siete módulos JavaScript de tokens existen. `src/styles/brand-tokens.css` y `src/design/` todavía no están importados por la aplicación. `BRCard.jsx` es funcional, pero no tiene consumidores; el resto de los componentes `BR*`, `src/design/index.js` y `src/design/utils/theme.js` están vacíos. Esta infraestructura parcial no equivale al cierre de 25.2E.

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
| Cut Optimizer | Baja | Media | Fase 25.7 |
| Fabricación | Baja | Media | Fase 25.8 |
| Instalación | Baja | Media | Fase 25.9 |
| Entrega | Baja | Media | Fase 25.9 |

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
