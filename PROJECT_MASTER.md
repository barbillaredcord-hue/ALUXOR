# BRTuNegocio

> Documento maestro de identidad, dirección, arquitectura y estado del producto.

- **Workspace operativo actual:** ALUXOR / BosqueReal
- **Etapa activa:** Etapa III — ERP operativo
- **Fase oficial:** 25.2C — Auditoría real de integridad
- **Última actualización:** 22/07/2026 8:38am

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
- No crear Context sin una necesidad comprobada.
- No duplicar lógica de negocio ni fuentes de verdad.
- El folio es referencia comercial; el UUID es identidad canónica.
- Una empresa equivale a un workspace.
- `workspace_id` es permanente e inmutable para la entidad.
- Los datos de empresas distintas nunca se mezclan.
- Producción es la autoridad operacional una vez que existe una orden de trabajo.
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
- **Identity:** generación UUID centralizada, normalización e identidad canónica por workspace.
- **Integrity:** auditor local, auditor remoto explícito de solo lectura, reporte consolidado y readiness conservador.
- **Cut Optimizer:** motor determinista, validación física y salida consumida por BR Engine y Fabricación; su persistencia operacional sigue pendiente.
- **Business State:** adapter derivado que agrega summaries de cotización, producción, compras, inventario, clientes, finanzas, fabricación, historial y workflow.
- **Workspace:** aislamiento y permisos como contexto empresarial; el indicador permanente de workspace del sistema sigue pendiente.
- **Storage, Offline y Realtime:** implementados en los dominios durables, no todavía en todo el ERP.
- **Supabase:** persistencia remota de los dominios habilitados, bajo sesión y RLS existentes.

## 6. Flujo operativo canónico

Cotización → Producción → Compras → Recepción → Inventario → Fabricación → Cut Optimizer → Instalación → Entrega

Reglas oficiales:

- Cada dominio conserva trazabilidad por UUID hacia el anterior.
- Ningún módulo reconstruye información que ya pertenece a otro dominio.
- Una vez creada la OT, Producción determina el estado operacional; Cotización conserva el contexto comercial.
- Recepción debe originarse en partidas de Compras.
- Inventario se construirá sobre movimientos, no sobre cantidades editadas únicamente en pantalla.
- Fabricación consume la orden y el plan de corte; no recalcula la optimización.
- Los summaries y fuentes reutilizables alimentan Business State.
- Inicio e Inspector consumirán Business State en fases posteriores; actualmente todavía usan datos directos o parciales.

## 7. Roadmap maestro por etapas

| Etapa | Objetivo | Estado | Componentes y condición de cierre |
|---|---|---|---|
| I — Fundación | Establecer aplicación, workspace, diseño, motores y pruebas base. | Completada | Base React/Vite, BR Engine, estructura por proyecto y pruebas. |
| II — Cotizador profesional | Operar cotizaciones reales con cálculo, historial, colaboración y persistencia. | Completada con evolución continua | Cotización durable, PDF, catálogo, offline, Realtime e identidad canónica. |
| III — ERP operativo | Conectar el flujo desde Cotización hasta Entrega. | En desarrollo | Producción y Compras tienen base durable; faltan completar Recepción, Inventario, Fabricación, Instalación y Entrega. Cierra en Fase 26.0. |
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

**Estado:** completada el 22/07/2026.

- UUID canónico centralizado.
- Folio conservado como referencia comercial.
- Identidad preservada en actualizaciones.
- Reintentos reutilizando UUID.
- Consultas por workspace + UUID.
- Eliminación de merges basados únicamente en folio.

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

### 25.2C — Auditoría real de datos

**Estado:** siguiente fase y objetivo inmediato oficial.

Ejecutará la auditoría sobre datos locales reales y Supabase autenticado, generará evidencia consolidada, clasificará deuda legacy y determinará si 25.2D puede iniciar. Será de solo lectura: no modificará datos, migraciones, UUID, RLS ni UI.

### 25.2D — Endurecimiento SQL

**Estado:** condicionado al resultado de 25.2C.

Podrá proponer o activar gradualmente `NOT NULL`, unicidad por workspace + UUID, Foreign Keys, índices y validaciones únicamente después de demostrar que los datos cumplen el contrato y de contar con respaldo y rollback.

### Fases posteriores de la Etapa III

| Fase | Estado |
|---|---|
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
| Cotización | Operativo y durable | Repository, offline queue, versionado, Realtime, Presence, historial e identidad canónica. `useQuotes.js` y `QuoteSection.jsx` requieren reducción progresiva. |
| Producción | Operativo y durable, con evolución pendiente | Motor, storage, repository, Supabase, sincronización, Realtime, versionado y summary. Falta cerrar experiencia operacional, historial vivo y prevención continua de escrituras o canales duplicados. |
| Compras | Operativo y durable | Persistencia local/remota, partidas, offline, Realtime, versionado y relaciones UUID con Producción y Cotización. |
| Recepción | Interfaz existente y fuente reutilizable; dominio incompleto | La pantalla deriva partidas y conserva cambios en estado React. No tiene todavía modelo durable, repository, storage ni movimientos propios. |
| Inventario | Interfaz existente y fuente reutilizable; dominio incompleto | Summary puro disponible; la pantalla calcula sobre datos de cotización y estado React. Falta modelo por movimientos y persistencia. |
| Fabricación | Interfaz existente y fuente reutilizable; dominio incompleto | Consume el plan del Cut Optimizer; checklist, progreso y notas no son todavía un dominio durable. |
| Cut Optimizer | Motor operativo y fuente reutilizable | Calcula, valida y expone summary. Falta persistir ejecuciones y conectarlas al proyecto operativo. |
| Instalación | Pendiente como dominio | Existe como etapa, permiso y estado de workflow; no existe aún un dominio durable independiente. |
| Entrega | Pendiente como dominio | Existe como etapa y estado; faltan evidencia, firma, persistencia y cierre operacional. |
| Historial | Operativo parcialmente | Cuenta con motor, summary, respaldo local y fundamentos remotos. No equivale todavía a un historial transversal completo de todos los dominios. |
| Dashboard / Inicio | Interfaz existente pero incompleta | Usa datos del proyecto activo y contiene actividad o checklist parcialmente fijos; aún no consume Business State como centro de operaciones. |
| Inspector Inteligente | Interfaz funcional parcial | Calcula riesgos y acciones desde Cotización; aún no consume el estado empresarial ni todos los dominios. |
| Project Companion | Interfaz funcional parcial | Usa Workflow Engine con contexto incompleto y contiene actividad fija; la integración común con Business State está pendiente. |
| Centro del Proyecto | Estructura visual existente | Separa FLDSMDFR empresarial y del Sistema, pero gran parte del contenido es informativo o vacío y no sincroniza `PROJECT_MASTER.md`. |
| Business State | Adapter derivado implementado parcialmente | Agrega summaries reales de varios dominios; objetivos, roadmap, decisiones, alertas y salud todavía no tienen una fuente durable. |

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

- Validación continua de sincronización bidireccional completa.
- Estado vivo y eventos Realtime sin canales duplicados.
- Tarjetas operativas por estado y resumen lateral de OT.
- Historial completo de cambios.
- Prevención de escrituras originadas por eventos remotos.

### Bug conocido independiente

La sincronización bidireccional entre **Notas internas** y **Observaciones** puede restaurar el texto cuando el usuario lo elimina completamente. Debe corregirse en una fase separada, salvo que bloquee el trabajo activo.

## 11. Pendientes de arquitectura

- Ejecutar 25.2C sin modificar datos.
- Reparar datos legacy únicamente si la auditoría demuestra la necesidad.
- Activar constraints únicamente después de validar datos, respaldo y rollback.
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

Actualmente existen superficies para la FLDSMDFR empresarial y la FLDSMDFR del Sistema, pero varias partes son visuales, estáticas o informativas. `PROJECT_MASTER.md` es documentación manual y no sincroniza automáticamente con la UI.

Pendientes:

- Sustituir contenido fijo por datos estructurados.
- Implementar sincronización segura.
- Incorporar roadmap visual y gestor de pendientes.
- Registrar decisiones, salud y métricas reales.
- Hacer navegable la documentación sin convertir la UI en fuente de verdad.

El Centro no debe frenar el ERP ni consumir más del límite de tiempo establecido.

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
| Pendiente de validación | No rediseñar módulos que puedan completarse incrementalmente. | Reducir riesgo y conservar valor operativo. | Vigente |
| Pendiente de validación | Inicio evolucionará hacia Centro de Operaciones. | Mostrar el estado real del flujo. | Pendiente |
| Pendiente de validación | Una función importante requiere operación, documentación, roadmap y pendientes derivados para cerrarse. | Evitar cierres únicamente visuales. | Vigente |

Las fechas no verificables se mantienen como **Pendiente de validación**; no se atribuyen autores sin evidencia.

## 16. Próximo sprint oficial

### Fase 25.2C — Auditoría real de integridad

**Propósito:** ejecutar las herramientas preparadas en 25.2B contra datos reales para decidir, con evidencia, si existe deuda legacy y si puede comenzar el endurecimiento SQL.

**Alcance:**

- Auditar colecciones locales reales del workspace seleccionado.
- Auditar Supabase con una sesión autenticada y respetando RLS.
- Consolidar resultados locales, remotos y comparativos.
- Clasificar identidad, workspace, duplicados, relaciones y folios comerciales.
- Documentar la decisión sobre reparación legacy y Fase 25.2D.

**Restricciones:**

- Solo lectura.
- No modificar, borrar, fusionar ni regenerar registros.
- No ejecutar migraciones ni activar constraints.
- No modificar RLS, UI, Business State o Workflow.
- No usar service role.

**Validaciones:**

- Registrar workspace, momento y fuente de cada auditoría.
- Conservar salida estructurada y conteos por dominio.
- Verificar que el auditor remoto solo ejecute `SELECT`.
- Diferenciar ausencia de datos, falta de permisos, tabla no disponible y consulta fallida.
- Revisar manualmente hallazgos que puedan implicar identidades distintas.

**Criterio de salida:**

- Reporte local real.
- Reporte remoto real.
- Evidencia de que no se modificaron datos.
- Hallazgos clasificados por severidad y dominio.
- Decisión documentada sobre reparación legacy.
- Decisión documentada sobre el inicio o bloqueo de 25.2D.
