# ALUXOR / BR
# WORKFLOW ENGINE

## Propósito

El Workflow Engine administra los estados, transiciones, validaciones y eventos históricos de cada proyecto dentro del ERP.

Su función es convertir el flujo operativo del negocio en reglas ejecutables para que cada proyecto avance de forma controlada, trazable y consistente.

## Relación con la Era II

Este documento se desprende del Modelo Operativo Canónico definido en:

docs/roadmap/eras/era-2-erp-operativo.md

La Era II define las etapas E01-E15 del proyecto. El Workflow Engine traduce esas etapas en estados técnicos, reglas de transición, validaciones mínimas y eventos históricos.

**Estado actual:** especificación documental preparada para Fase 24. La implementación de Fase 24 aún no ha iniciado.

**Contexto previo:** Fase 23.5 es una fase puente de tres días. Día 1 está cerrado y aprobado, Día 2 está iniciado y aún no cerrado, y Día 3 está pendiente. El historial local quedó preparado para backend remoto mediante `VITE_HISTORY_API_URL`, pero el backend remoto de historial aún no está implementado.

**Condición para Fase 24:** la implementación de Workflow Engine, eventos, estados e historial remoto solo debe iniciar después de cerrar Día 3 de Fase 23.5.

## Conceptos base

- Proyecto: entidad central que concentra cliente, cotización, materiales, producción, instalación, historial y resultado.
- Etapa: parte del modelo operativo del negocio.
- Estado: posición ejecutable de un proyecto dentro del Workflow Engine.
- Transición: cambio controlado de un estado a otro.
- Evento: registro histórico generado por una acción o transición.
- Validación: condición mínima que debe cumplirse antes de avanzar.
- Responsable: usuario o área operativa asociada a una acción.
- Módulo: parte funcional del ERP que captura, consulta o ejecuta información.
- Motor: componente lógico que valida, calcula, coordina o recomienda acciones.

## Diferencia entre etapa y estado

- Las etapas representan el modelo operativo del negocio.
- Los estados representan la evolución ejecutable dentro del Workflow Engine.
- Una etapa puede contener uno o varios estados.

## Estados principales del proyecto

### Estados iniciales
- prospecto

### Estados operativos
- en_levantamiento
- en_cotizacion
- en_planeacion
- en_compras
- en_recepcion
- en_optimizacion
- en_fabricacion
- en_control_calidad
- en_instalacion

### Estados de decisión
- cambios_solicitados
- cotizacion_aprobada
- proyecto_rechazado
- calidad_aprobada
- calidad_rechazada

### Estados de resultado
- inventario_actualizado
- instalado
- entregado

### Estados de cierre
- cerrado
- archivado
- cancelado

## Transiciones oficiales

| ID | Estado origen | Evento disparador | Estado destino | Tipo | Reversible | Validaciones requeridas | Evento histórico generado |
|---|---|---|---|---|:---:|---|---|
| WT-001 | prospecto | Iniciar levantamiento | en_levantamiento | Manual | Sí | Cliente identificado y proyecto creado | "Levantamiento iniciado" |
| WT-002 | en_levantamiento | Completar levantamiento | en_cotizacion | Manual | Sí | Medidas, requerimientos y evidencias capturadas | "Levantamiento de información completado" |
| WT-003 | en_cotizacion | Presentar cotización | cotizacion_presentada | Manual | Sí | Cotización consistente y versión identificada | "Cotización presentada" |
| WT-004 | cotizacion_presentada | Solicitar cambios | cambios_solicitados | Manual | Sí | Observaciones del cliente registradas | "Cambios solicitados por el cliente" |
| WT-005 | cambios_solicitados | Rehacer cotización | en_cotizacion | Manual | Sí | Solicitud de cambios asociada a la cotización | "Cotización devuelta a revisión" |
| WT-006 | cotizacion_presentada | Aprobar cotización | cotizacion_aprobada | Manual | No | Aprobación del cliente y versión congelada | "Cotización aprobada" |
| WT-007 | cotizacion_presentada | Rechazar cotización | proyecto_rechazado | Manual | No | Rechazo del cliente registrado | "Cotización rechazada" |
| WT-008 | cotizacion_aprobada | Iniciar planeación | en_planeacion | Manual | Sí | Cotización aprobada y condiciones finales definidas | "Planeación iniciada" |
| WT-009 | en_planeacion | Generar requerimientos | en_compras | Manual | Sí | Plan operativo y requerimientos definidos | "Requerimientos de compra generados" |
| WT-010 | en_compras | Recibir materiales | en_recepcion | Mixta | Sí | Solicitudes de compra identificadas | "Recepción iniciada" |
| WT-011 | en_recepcion | Actualizar inventario | inventario_actualizado | Mixta | Sí | Material recibido validado | "Inventario actualizado" |
| WT-012 | inventario_actualizado | Optimizar cortes | en_optimizacion | Mixta | Sí | Material disponible o reservado | "Optimización de cortes iniciada" |
| WT-013 | en_optimizacion | Enviar a fabricación | en_fabricacion | Manual | Sí | Plan de corte validado cuando aplique | "Fabricación iniciada" |
| WT-014 | en_fabricacion | Enviar a calidad | en_control_calidad | Manual | Sí | Fabricación registrada y piezas identificadas | "Control de calidad iniciado" |
| WT-015 | en_control_calidad | Rechazar calidad | calidad_rechazada | Manual | Sí | Daños, faltantes o retrabajos documentados | "Calidad rechazada" |
| WT-016 | calidad_rechazada | Rehacer fabricación | en_fabricacion | Manual | Sí | Retrabajo definido y asociado al proyecto | "Retrabajo enviado a fabricación" |
| WT-017 | en_control_calidad | Aprobar calidad | calidad_aprobada | Manual | No | Medidas, acabados y evidencias validadas | "Calidad aprobada" |
| WT-018 | calidad_aprobada | Programar instalación | en_instalacion | Manual | Sí | Productos aprobados y materiales listos | "Instalación iniciada" |
| WT-019 | en_instalacion | Completar instalación | instalado | Manual | Sí | Instalación parcial o completa registrada | "Instalación registrada" |
| WT-020 | instalado | Entregar proyecto | entregado | Manual | Sí | Evidencias finales y observaciones registradas | "Entrega del proyecto registrada" |
| WT-021 | entregado | Cerrar proyecto | cerrado | Manual | No | Aceptación, saldo y garantía documentados cuando aplique | "Proyecto cerrado" |
| WT-022 | cerrado | Archivar proyecto | archivado | Manual | No | Historial consolidado | "Proyecto archivado" |
| WT-023 | cualquier estado activo | Cancelar proyecto | cancelado | Manual | No | Motivo de cancelación documentado | "Proyecto cancelado" |

> **Nota:** Los identificadores `WT-001`, `WT-002`, etc., son identificadores técnicos estables. Deben utilizarse como referencia en código, pruebas, historial y documentación, y no deben reutilizarse ni modificarse una vez publicados.

## Tipos de transición

- **Manual:** requiere acción explícita de un usuario autorizado.
- **Automática:** puede ejecutarse por el sistema cuando las validaciones se cumplen sin intervención humana directa.
- **Mixta:** puede iniciar por una acción del usuario y completarse mediante validaciones del sistema.

## Estados terminales

Los estados terminales impiden continuar el flujo operativo normal del proyecto.

- **cancelado:** el proyecto se detiene antes de completarse.
- **archivado:** el proyecto queda cerrado documentalmente y ya no debe modificarse.

## Estado semiterminal

- **cerrado:** el proyecto terminó operativamente, pero todavía puede archivarse o consultarse para historial, métricas y aprendizaje.

## Reglas generales del Workflow Engine

- Todo proyecto debe tener un estado actual.
- Toda transición debe generar un evento histórico.
- No puede existir transición sin validación mínima.
- Los estados cancelado, cerrado y archivado son estados terminales o semiterminales.
- El sistema debe permitir regresar a etapas anteriores cuando exista una razón documentada.
- El estado no debe modificarse manualmente sin registrar evento.

## Validaciones mínimas por transición

| Validación | Uso principal |
|---|---|
| Cliente identificado | Crear proyecto e iniciar levantamiento |
| Medidas capturadas | Avanzar de levantamiento a cotización |
| Cotización consistente | Presentar cotización al cliente |
| Aprobación del cliente | Congelar cotización e iniciar planeación |
| Plan operativo definido | Generar requerimientos de compra y fabricación |
| Requerimientos de compra definidos | Iniciar compras |
| Material recibido | Iniciar actualización de inventario |
| Inventario actualizado | Reservar material y preparar corte o fabricación |
| Plan de corte validado | Enviar piezas a fabricación |
| Fabricación registrada | Enviar productos a control de calidad |
| Calidad aprobada | Programar instalación |
| Entrega aceptada | Cerrar proyecto |

## Eventos del Workflow

Modelo base de evento WorkflowEvent:

| Campo         | Descripción                                                                           |
|-------------- |--------------------------------------------------------------------------------------|
| id            | Identificador único del evento                                                        |
| projectId     | ID del proyecto asociado                                                             |
| transitionId  | Identificador de la transición que generó el evento                                  |
| previousState | Estado previo del proyecto                                                           |
| nextState     | Estado siguiente del proyecto                                                        |
| trigger       | Disparador de la transición (usuario, sistema, módulo, etc.)                         |
| module        | Módulo del ERP relacionado con la transición                                         |
| engine        | Motor que procesó la transición                                                      |
| userId        | ID del usuario que realizó la acción (si aplica)                                     |
| timestamp     | Fecha y hora en que ocurrió el evento                                                |
| description   | Descripción breve del evento                                                         |
| evidence      | Evidencias asociadas al evento (archivos, imágenes, etc.)                            |
| metadata      | Información adicional relevante (JSON u otro formato estructurado)                   |
## Principios del Workflow Engine

- Un proyecto solo puede tener un estado activo a la vez.
- Toda transición debe ser atómica: se completa totalmente o no se aplica.
- Ninguna transición puede omitir sus validaciones mínimas.
- Todo cambio de estado debe generar un evento histórico.
- El historial generado por el Workflow Engine debe ser inmutable.
- El Workflow Engine no debe calcular costos ni modificar datos funcionales; coordina estados, transiciones, validaciones y eventos.
- Toda transición reversible debe conservar la razón del retorno y el usuario responsable.
- Los estados terminales solo pueden cambiar mediante reglas explícitas y documentadas.


## Relación con módulos

| Módulo | Papel frente al Workflow Engine |
|---|---|
| Cotización | Captura información comercial y técnica, genera versiones y confirma aprobación o rechazo. |
| Producción | Coordina planeación, instalación, entrega y seguimiento operativo. |
| Compras | Gestiona requerimientos derivados del proyecto y su preparación para recepción. |
| Recepción | Registra llegada de materiales y diferencias contra lo solicitado. |
| Inventario | Actualiza existencias, reservas, faltantes y disponibilidad para fabricación. |
| Fabricación | Registra avance, consumo real, piezas producidas, incidencias y retrabajos. |
| Historial | Consolida eventos, decisiones, evidencias y resultado del proyecto. |
| Project Companion | Apoya seguimiento, contexto operativo y lectura del estado del proyecto. |
| Inspector Inteligente | Apoya revisión, evidencias, incidencias y consistencia de datos cuando aplique. |

## Relación con motores

| Motor | Aporte al Workflow Engine |
|---|---|
| BR Engine | Mantiene consistencia operativa, contexto del proyecto y reglas base del negocio. |
| Workflow Engine | Administra estados, transiciones, validaciones y eventos históricos. |
| Cut Optimizer | Valida y genera planes de corte cuando el proyecto requiere optimización. |
| Project Companion | Aporta contexto, seguimiento y soporte operativo sobre el avance del proyecto. |

## Decisiones de implementación pendientes

- Definir permisos por rol.
- Definir si algunas transiciones serán automáticas.
- Definir cómo se manejarán transiciones reversibles.
- Definir estructura técnica final del historial.
- Definir integración visual con Workspace.
- Definir pruebas automatizadas del workflow.

## Criterio de cierre del documento

El documento puede considerarse listo cuando:

- Todos los estados iniciales estén definidos.
- Todas las transiciones principales estén documentadas.
- Cada transición tenga validaciones mínimas.
- Cada transición genere un evento histórico.
- Exista base suficiente para implementación técnica en la app.
- La especificación permite implementar el Workflow Engine sin redefinir el modelo operativo del negocio.
