# ALUXOR / BR

# ERA II — ERP OPERATIVO

> Documento operativo de ejecución de la Era II. Este archivo guía el trabajo diario hasta completar la consolidación del ERP Operativo.

---

# Estado Ejecutivo

| Campo | Valor |
|---|---|
| Estado | 🟡 En ejecución |
| Avance general | 70% |
| Fase activa | Fase 23.5 — Architecture & Design Bridge |
| Build | Estable |
| Pruebas | Base estable |
| Próximo objetivo | Cerrar Día 2 y ejecutar Día 3 — Validación, pulido y cierre |

---

# Objetivo de la Era II

La Era II tiene como propósito transformar la base construida durante la Era I en un ERP operativo completamente conectado. La prioridad no es agregar módulos, sino lograr que los existentes funcionen como un solo sistema alrededor del proyecto.

## Principios de la Era

- El proyecto continúa siendo el centro del sistema.
- Integrar antes que expandir.
- Una fuente de verdad por dato.
- Trazabilidad antes que inteligencia artificial.
- Estabilidad antes que nuevas funcionalidades.

---

# Objetivos Estratégicos

Los Objetivos Estratégicos (OE) organizan el trabajo de la Era II. Cada uno agrupa varias fases y entregables. El Flujo Maestro del Proyecto constituye el desarrollo detallado del OE-1.

## Objetivos de la Era II

- [x] OE-1 — Flujo Operativo: Consolidar el recorrido completo del proyecto desde la cotización hasta el historial.
- [ ] OE-2 — Trazabilidad: Registrar los eventos importantes de cada proyecto para conocer qué ocurrió, cuándo ocurrió y quién intervino.
- [ ] OE-3 — Inventario: Conectar inventario con compras, fabricación y proyectos.
- [ ] OE-4 — Compras: Convertir compras en una consecuencia lógica del proyecto.
- [ ] OE-5 — Fabricación: Fortalecer la fabricación como proceso medible y conectado.
- [ ] OE-6 — Reportes: Construir indicadores ejecutivos para la toma de decisiones.
- [ ] OE-7 — Preparación para IA: Preparar datos consistentes para futuras capacidades inteligentes.

# OE-1 — Flujo Maestro del Proyecto
> Este capítulo desarrolla el primer Objetivo Estratégico (OE-1). Los siguientes objetivos se documentarán con el mismo nivel de detalle conforme avance la Era II.

El primer entregable de la Era II consiste en definir el flujo operativo canónico del proyecto. Este flujo maestro servirá como referencia central para todos los módulos y procesos, asegurando que el sistema funcione de manera integrada y consistente.

Las etapas principales del flujo son:

1. Prospecto / Cliente
2. Levantamiento de información
3. Cotización
4. Validación y aprobación
5. Planeación del proyecto
6. Compras
7. Recepción
8. Inventario
9. Optimización de cortes
10. Fabricación
11. Control de calidad
12. Instalación
13. Entrega
14. Historial
15. Aprendizaje

## Preguntas que debemos responder durante la Fase 23

- [ ] ¿Qué información entra en cada etapa?
- [ ] ¿Qué información sale?
- [ ] ¿Quién puede modificarla?
- [ ] ¿Qué módulo es responsable?
- [ ] ¿Qué motor participa?
- [ ] ¿Qué eventos deben registrarse?
- [ ] ¿Qué validaciones son obligatorias?
- [ ] ¿Cuál es el criterio para pasar a la siguiente etapa?

> El resto de la Era II se construirá alrededor de este flujo canónico, definiendo procesos, responsabilidades y validaciones para cada etapa.

## Estados Canónicos del Proyecto

> Las etapas representan el modelo operativo del negocio. Los estados representan la evolución del proyecto dentro del Workflow Engine. Una etapa puede contener uno o varios estados.

Los estados canónicos representan la evolución oficial de un proyecto dentro del ERP y serán la base del Workflow Engine, la trazabilidad y los reportes.

1. Prospecto
2. Levantamiento de información
3. Cotización
4. Validación y aprobación
5. Planeación del proyecto
6. Compras
7. Recepción
8. Inventario
9. Optimización de cortes
10. Fabricación
11. Control de calidad
12. Instalación
13. Entrega
14. Historial
15. Aprendizaje


# Modelo Conceptual del ERP

Antes de definir el comportamiento operativo del sistema es necesario establecer los conceptos fundamentales que utilizará todo el ERP. Este modelo conceptual servirá como lenguaje común para la documentación, el desarrollo, los motores internos y las futuras capacidades de inteligencia.

## Entidades principales

- Cliente
- Proyecto
- Cotización
- Orden de compra
- Material
- Inventario
- Fabricación
- Instalación
- Historial

## Principio fundamental

El proyecto es la entidad central del ERP.

Todas las demás entidades existen para apoyar, documentar o ejecutar la evolución de un proyecto.

## Diferencias importantes

- Cliente ≠ Proyecto
- Proyecto ≠ Cotización
- Cotización ≠ Orden de compra
- Etapa ≠ Estado
- Evento ≠ Proceso
- Flujo ≠ Workflow


## Modelo Operativo Canónico

Las siguientes fichas documentan el comportamiento esperado de cada etapa del ciclo de vida de un proyecto. Cada etapa define responsabilidades, información, validaciones y criterios de transición, convirtiéndose en la referencia oficial del Modelo Operativo Canónico de ALUXOR / BR.

## Definición de cada etapa (Trabajo de la Fase 23)

### E01 — Prospecto / Cliente

**Objetivo**

Registrar el primer contacto con una persona o empresa interesada y convertir una necesidad general en un proyecto potencial dentro del sistema.

**Información de entrada**

- Nombre del cliente o empresa.
- Datos de contacto.
- Medio por el que llegó.
- Tipo de trabajo solicitado.
- Descripción inicial de la necesidad.
- Ubicación del proyecto (si aplica).
- Evidencias iniciales (fotografías, croquis, referencias).

**Información de salida**

- Proyecto creado.
- Cliente asociado al proyecto.
- Estado inicial del proyecto.
- Historial del primer contacto.


**Módulos involucrados**
- Cotización.
- Historial.
- Project Companion.

**Motores involucrados**

- Workflow Engine.
- BR Engine (creación del contexto del proyecto).


**Validaciones obligatorias**

- Debe existir un cliente identificado.
- Debe existir una descripción mínima del trabajo.
- El proyecto debe tener un identificador único.

**Evento registrado en el historial**

"Proyecto creado" con fecha, usuario responsable y datos básicos del cliente.

**Criterio para avanzar**

Existe un proyecto creado con información suficiente para iniciar el levantamiento de información y la toma de medidas.

### E02 — Levantamiento de información
**Objetivo**

Comprender con precisión qué necesita el cliente y obtener toda la información técnica necesaria para construir una cotización correcta y un proyecto viable.

**Información de entrada**

- Proyecto previamente creado.
- Datos del cliente.
- Descripción inicial del trabajo.
- Fotografías existentes.
- Croquis o referencias del cliente (si existen).

**Información de salida**

- Medidas del espacio.
- Medidas del producto.
- Materiales preliminares.
- Acabados considerados.
- Herrajes y accesorios identificados.
- Restricciones técnicas detectadas.
- Observaciones del levantamiento.
- Evidencias fotográficas actualizadas.

**Módulos involucrados**

- Cotización.
- Catálogo.
- Historial.
- Project Companion.

**Motores involucrados**

- BR Engine.
- Workflow Engine.

**Validaciones obligatorias**

- Deben existir medidas suficientes para cotizar.
- Deben registrarse las necesidades principales del cliente.
- Deben documentarse restricciones relevantes del proyecto.
- Las evidencias deben quedar asociadas al proyecto cuando existan.

**Evento registrado en el historial**

"Levantamiento de información completado" con fecha, responsable y resumen de los datos capturados.

**Criterio para avanzar**

Toda la información necesaria para elaborar una cotización técnica y económicamente confiable ha sido capturada y validada.

### E03 — Cotización
**Objetivo**

Transformar la información recopilada durante el levantamiento en una propuesta técnica y económica precisa, rentable para el taller y clara para el cliente.

**Información de entrada**

- Proyecto activo.
- Datos del cliente.
- Medidas del espacio y del producto.
- Materiales, acabados, herrajes y accesorios seleccionados.
- Restricciones técnicas detectadas.
- Lista de precios vigente.
- Configuración de costos del taller.

**Información de salida**

- Cotización completa.
- Costo interno calculado.
- Precio al cliente.
- Utilidad estimada.
- Tiempo estimado de fabricación e instalación.
- Lista preliminar de materiales.
- Número y versión de la cotización.

**Módulos involucrados**

- Cotización.
- Catálogo.
- Historial.
- Project Companion.
- Inspector Inteligente.

**Motores involucrados**

- BR Engine.
- Workflow Engine.

**Validaciones obligatorias**

- Todas las medidas necesarias deben existir.
- No deben existir errores matemáticos en costos, cantidades o utilidades.
- Los materiales deben estar correctamente definidos.
- La utilidad debe cumplir los criterios del negocio.
- Debe existir una versión identificable de la cotización.

**Evento registrado en el historial**

"Cotización generada" con fecha, versión, usuario responsable y resumen económico.

**Criterio para avanzar**

La cotización ha sido revisada, es consistente técnica y económicamente y está lista para ser presentada al cliente para su validación y aprobación.


### E04 — Validación y aprobación
**Objetivo**

Convertir una cotización revisada en un compromiso formal entre el cliente y el taller, registrando la decisión del cliente y definiendo el siguiente paso operativo del proyecto.

**Información de entrada**
- Cotización revisada.
- Proyecto activo.
- Cliente identificado.
- Condiciones comerciales definidas.
- Observaciones o solicitudes finales del cliente.

**Información de salida**

- Decisión del cliente registrada.
- Estado de la cotización actualizado.
- Versión aprobada identificada y congelada.
- Observaciones finales registradas.
- Proyecto listo para planeación.

**Módulos involucrados**

- Cotización.
- Historial.
- Project Companion.

**Motores involucrados**

- BR Engine.
- Workflow Engine.

**Validaciones obligatorias**

- Debe registrarse aprobación, rechazo o solicitud de cambios.
- La decisión debe estar asociada al cliente.
- La versión aprobada debe quedar identificada.
- Las observaciones deben quedar registradas.
- Una cotización aprobada no debe modificarse.

**Evento registrado en el historial**

"Validación y aprobación realizada" con fecha, usuario responsable, decisión del cliente, versión aprobada y observaciones.

**Criterio para avanzar**

La cotización está aprobada, la versión final está congelada y el proyecto puede iniciar planeación operativa.

### E05 — Planeación del proyecto
**Objetivo**

Convertir un proyecto aprobado en un plan operativo para organizar el trabajo, definir responsables y preparar compras, inventario, fabricación e instalación.

**Información de entrada**

- Proyecto aprobado.
- Versión aprobada de la cotización.
- Lista preliminar de materiales.
- Tiempo estimado de fabricación e instalación.
- Observaciones finales del cliente.

**Información de salida**

- Plan operativo del proyecto.
- Responsables operativos definidos.
- Requerimientos para compras identificados.
- Requerimientos para inventario identificados.
- Requerimientos para fabricación identificados.
- Elementos a reservar o preparar definidos.
- Actividades previas a instalación identificadas.

**Módulos involucrados**

- Cotización.
- Producción.
- Compras.
- Inventario.
- Fabricación.
- Historial.
- Project Companion.

**Motores involucrados**

- BR Engine.
- Workflow Engine.
- Project Companion.

**Validaciones obligatorias**

- El proyecto debe estar aprobado.
- La cotización aprobada debe estar congelada.
- Cada requerimiento debe tener destino operativo.
- Los responsables operativos deben estar definidos.
- No deben ejecutarse compras ni fabricación en esta etapa.

**Evento registrado en el historial**

"Planeación del proyecto completada" con fecha, usuario responsable, plan operativo y requerimientos definidos.

**Criterio para avanzar**

Existe un plan operativo validado para iniciar compras, preparar inventario y programar fabricación.

### E06 — Compras
**Objetivo**

Convertir los requerimientos operativos del proyecto en solicitudes de compra planificadas, priorizadas y trazables, asegurando el abastecimiento oportuno sin generar compras innecesarias.

**Información de entrada**

- Plan operativo del proyecto.
- Requerimientos para compras.
- Requerimientos para inventario.
- Lista de materiales.
- Catálogo de proveedores.
- Existencias actuales de inventario.

**Información de salida**

- Solicitudes de compra generadas.
- Materiales reservados desde inventario cuando aplique.
- Materiales pendientes de adquisición.
- Prioridad de compra definida.
- Proveedores seleccionados.

**Módulos involucrados**

- Compras.
- Inventario.
- Catálogo.
- Historial.
- Project Companion.

**Motores involucrados**

- BR Engine.
- Workflow Engine.

**Validaciones obligatorias**

- Todo requerimiento debe pertenecer a un proyecto.
- Debe verificarse inventario antes de comprar.
- Cada compra debe tener proveedor asignado o pendiente de asignación.
- No deben generarse compras duplicadas para el mismo requerimiento.
- Toda solicitud debe quedar asociada al proyecto.

**Evento registrado en el historial**

"Solicitudes de compra generadas" con fecha, usuario responsable, materiales solicitados y resumen de requerimientos.

**Criterio para avanzar**

Todos los requerimientos del proyecto cuentan con una estrategia de abastecimiento definida, ya sea mediante inventario o mediante compra, permitiendo iniciar la recepción de materiales.

### E07 — Recepción
**Objetivo**

Confirmar la llegada de materiales solicitados, validar que coincidan con lo requerido por el proyecto y preparar su entrada formal al inventario.

**Información de entrada**

- Solicitudes de compra generadas.
- Materiales pendientes de recepción.
- Proyecto asociado.
- Proveedor asignado.
- Cantidades solicitadas.
- Evidencias de entrega cuando existan.

**Información de salida**

- Materiales recibidos registrados.
- Diferencias detectadas contra la solicitud original.
- Recepciones parciales identificadas.
- Evidencias de recepción asociadas.
- Materiales listos para entrada a inventario.

**Módulos involucrados**

- Recepción.
- Compras.
- Inventario.
- Historial.
- Project Companion.
- Inspector Inteligente.

**Motores involucrados**

- Workflow Engine.
- BR Engine.

**Validaciones obligatorias**

- Todo material recibido debe estar asociado a una solicitud de compra o requerimiento del proyecto.
- Las cantidades recibidas deben compararse contra las cantidades solicitadas.
- Las diferencias, faltantes o excedentes deben registrarse.
- Las recepciones parciales deben quedar claramente identificadas.
- Las evidencias de recepción deben asociarse al proyecto cuando existan.

**Evento registrado en el historial**

"Materiales recibidos" con fecha, usuario responsable, proveedor, cantidades recibidas, diferencias detectadas y evidencias asociadas.

**Criterio para avanzar**

Los materiales recibidos han sido validados contra la solicitud original y están listos para actualizar inventario o generar seguimiento por faltantes.

### E08 — Inventario
**Objetivo**

Actualizar y controlar la existencia de materiales recibidos, reservados y disponibles, asegurando que cada movimiento esté asociado al proyecto correspondiente y pueda alimentar fabricación, costos e historial.

**Información de entrada**

- Materiales recibidos y validados.
- Proyecto asociado.
- Solicitudes de compra relacionadas.
- Cantidades recibidas.
- Diferencias o faltantes detectados.
- Evidencias de recepción.

**Información de salida**

- Inventario actualizado.
- Materiales disponibles registrados.
- Materiales reservados por proyecto.
- Faltantes pendientes identificados.
- Sobrantes potenciales registrados cuando aplique.
- Información lista para optimización de cortes y fabricación.

**Módulos involucrados**

- Inventario.
- Recepción.
- Compras.
- Fabricación.
- Historial.
- Project Companion.
- Inspector Inteligente.

**Motores involucrados**

- BR Engine.
- Workflow Engine.
- Cut Optimizer.

**Validaciones obligatorias**

- Todo movimiento de inventario debe estar asociado a un proyecto, compra, recepción o ajuste identificado.
- Las cantidades recibidas deben actualizar existencias de forma trazable.
- Los materiales reservados deben quedar vinculados al proyecto correspondiente.
- Los faltantes deben permanecer visibles hasta resolverse.
- No debe liberarse material a fabricación si no existe disponibilidad suficiente o reserva definida.

**Evento registrado en el historial**

"Inventario actualizado" con fecha, usuario responsable, materiales ingresados, reservas generadas, faltantes detectados y proyecto asociado.

**Criterio para avanzar**

Los materiales necesarios están registrados, reservados o identificados como faltantes, permitiendo avanzar a optimización de cortes o fabricación según corresponda.

### E09 — Optimización de cortes
**Objetivo**

Convertir los materiales disponibles, reservados o definidos para el proyecto en un plan de corte claro, físicamente viable y orientado a reducir desperdicio antes de iniciar fabricación.

**Información de entrada**

- Proyecto asociado.
- Materiales disponibles o reservados.
- Medidas del producto.
- Lista de piezas a fabricar.
- Restricciones físicas del material.
- Configuración de cortes y tolerancias.
- Sobrantes reutilizables cuando existan.

**Información de salida**

- Plan de corte generado.
- Distribución de piezas por material.
- Desperdicio estimado.
- Sobrantes identificados.
- Material insuficiente detectado cuando aplique.
- Información lista para fabricación.

**Módulos involucrados**

- Fabricación.
- Inventario.
- Cotización.
- Historial.
- Project Companion.
- Inspector Inteligente.

**Motores involucrados**

- Cut Optimizer.
- BR Engine.
- Workflow Engine.

**Validaciones obligatorias**

- Las piezas deben tener medidas válidas.
- Los materiales deben existir, estar reservados o estar claramente definidos.
- El plan de corte debe respetar las dimensiones físicas del material.
- El desperdicio debe calcularse y registrarse.
- Las piezas que no puedan acomodarse deben quedar identificadas.

**Evento registrado en el historial**

"Plan de corte generado" con fecha, usuario responsable, materiales utilizados, desperdicio estimado, sobrantes y piezas no acomodadas cuando existan.

**Criterio para avanzar**

Existe un plan de corte validado y físicamente viable que puede ser utilizado por fabricación para iniciar el trabajo del proyecto.

### E10 — Fabricación
**Objetivo**

Ejecutar la transformación física de los materiales en piezas, productos o componentes del proyecto, utilizando la información validada de cotización, inventario, optimización de cortes y planeación operativa.

**Información de entrada**

- Proyecto asociado.
- Plan operativo del proyecto.
- Materiales disponibles o reservados.
- Plan de corte validado cuando aplique.
- Lista de piezas o componentes a fabricar.
- Especificaciones técnicas del producto.
- Observaciones relevantes del cliente o del levantamiento.

**Información de salida**

- Piezas o componentes fabricados.
- Avance de fabricación registrado.
- Consumo real de materiales.
- Incidencias de fabricación identificadas.
- Sobrantes o desperdicios registrados.
- Información lista para control de calidad.

**Módulos involucrados**

- Fabricación.
- Inventario.
- Producción.
- Historial.
- Project Companion.
- Inspector Inteligente.

**Motores involucrados**

- Workflow Engine.
- BR Engine.
- Cut Optimizer.

**Validaciones obligatorias**

- Los materiales necesarios deben estar disponibles o reservados.
- El plan de corte debe estar validado cuando aplique.
- Las piezas fabricadas deben corresponder al proyecto y a las especificaciones definidas.
- El consumo de material debe registrarse de forma trazable.
- Las incidencias, desperdicios o retrabajos deben quedar documentados.

**Evento registrado en el historial**

"Fabricación ejecutada" con fecha, usuario responsable, avance registrado, materiales consumidos, incidencias, sobrantes y desperdicios asociados.

**Criterio para avanzar**

Las piezas, productos o componentes del proyecto han sido fabricados o tienen avance suficiente registrado para pasar a control de calidad.

### E11 — Control de calidad
**Objetivo**

Validar que las piezas, productos o componentes fabricados cumplan medidas, acabado y condiciones necesarias antes de avanzar a instalación.

**Información de entrada**

- Proyecto asociado.
- Piezas o productos fabricados.
- Especificaciones técnicas del producto.
- Medidas esperadas.
- Acabados definidos.
- Incidencias de fabricación registradas.
- Evidencias disponibles.

**Información de salida**

- Resultado de control de calidad.
- Piezas aprobadas para instalación.
- Daños, faltantes o retrabajos identificados.
- Evidencias de validación asociadas.
- Aprobación interna registrada.

**Módulos involucrados**

- Fabricación.
- Producción.
- Historial.
- Project Companion.
- Inspector Inteligente.

**Motores involucrados**

- Workflow Engine.
- BR Engine.
- Project Companion.

**Validaciones obligatorias**

- Las piezas deben corresponder al proyecto.
- Las medidas deben compararse contra las especificaciones.
- Los acabados deben coincidir con lo aprobado.
- Los daños, faltantes o retrabajos deben registrarse.
- La aprobación interna debe quedar documentada antes de instalación.

**Evento registrado en el historial**

"Control de calidad completado" con fecha, usuario responsable, piezas revisadas, resultado, incidencias, retrabajos y evidencias asociadas.

**Criterio para avanzar**

Las piezas o productos están aprobados internamente o tienen retrabajos definidos antes de pasar a instalación.

### E12 — Instalación
**Objetivo**

Llevar el proyecto al sitio del cliente y registrar la instalación parcial o completa de los productos aprobados.

**Información de entrada**

- Proyecto asociado.
- Piezas o productos aprobados.
- Materiales listos para instalación.
- Plan operativo del proyecto.
- Responsables operativos definidos.
- Evidencias de control de calidad.
- Observaciones relevantes del cliente o del sitio.

**Información de salida**

- Instalación registrada.
- Avance de instalación identificado.
- Materiales utilizados en sitio.
- Incidencias en sitio documentadas.
- Evidencias de instalación asociadas.
- Estado parcial o completo de instalación.

**Módulos involucrados**

- Producción.
- Fabricación.
- Inventario.
- Historial.
- Project Companion.
- Inspector Inteligente.

**Motores involucrados**

- Workflow Engine.
- BR Engine.
- Project Companion.

**Validaciones obligatorias**

- Los productos deben estar aprobados para instalación.
- Los materiales necesarios deben estar listos.
- Los responsables operativos deben estar definidos.
- Las incidencias en sitio deben registrarse.
- La instalación parcial o completa debe quedar claramente identificada.

**Evento registrado en el historial**

"Instalación registrada" con fecha, usuario responsable, avance, materiales utilizados, incidencias y evidencias asociadas.

**Criterio para avanzar**

La instalación está registrada como parcial o completa y las incidencias relevantes han sido documentadas.

### E13 — Entrega
**Objetivo**

Cerrar formalmente el proyecto con el cliente, registrando aceptación, observaciones finales y condiciones de cierre operativo.

**Información de entrada**

- Proyecto instalado.
- Evidencias de instalación.
- Incidencias pendientes.
- Observaciones finales del cliente.
- Condiciones comerciales finales.
- Información de garantía cuando aplique.

**Información de salida**

- Entrega formal registrada.
- Aceptación del cliente documentada.
- Observaciones finales registradas.
- Saldo pendiente identificado cuando aplique.
- Garantía asociada al proyecto cuando aplique.
- Evidencias finales asociadas.
- Cierre operativo del proyecto.

**Módulos involucrados**

- Cotización.
- Producción.
- Historial.
- Project Companion.
- Inspector Inteligente.

**Motores involucrados**

- Workflow Engine.
- BR Engine.
- Project Companion.

**Validaciones obligatorias**

- Debe existir registro de instalación.
- La aceptación u observación del cliente debe quedar documentada.
- Las evidencias finales deben asociarse al proyecto.
- El saldo pendiente debe identificarse cuando aplique.
- La garantía debe quedar registrada cuando aplique.

**Evento registrado en el historial**

"Entrega del proyecto registrada" con fecha, usuario responsable, aceptación del cliente, observaciones finales, saldo pendiente, garantía y evidencias.

**Criterio para avanzar**

El proyecto cuenta con aceptación, evidencias finales y cierre operativo documentado.

### E14 — Historial
**Objetivo**

Consolidar la memoria operativa del proyecto, registrando eventos, decisiones, costos, materiales, tiempos, incidencias, evidencias y resultado final.

**Información de entrada**

- Proyecto cerrado operativamente.
- Eventos registrados durante el flujo.
- Decisiones tomadas.
- Costos estimados y reales disponibles.
- Materiales solicitados, recibidos y utilizados.
- Tiempos estimados y reales disponibles.
- Incidencias y retrabajos documentados.
- Evidencias asociadas al proyecto.

**Información de salida**

- Historial consolidado del proyecto.
- Secuencia completa de eventos.
- Resumen de decisiones relevantes.
- Resumen de costos, materiales y tiempos.
- Incidencias y evidencias organizadas.
- Resultado final del proyecto documentado.

**Módulos involucrados**

- Historial.
- Cotización.
- Compras.
- Recepción.
- Inventario.
- Fabricación.
- Producción.
- Project Companion.

**Motores involucrados**

- BR Engine.
- Workflow Engine.
- Project Companion.

**Validaciones obligatorias**

- Todo evento relevante debe estar asociado al proyecto.
- Las decisiones importantes deben quedar trazables.
- Los costos, materiales y tiempos deben conservar su origen.
- Las incidencias y evidencias deben estar vinculadas al historial.
- El resultado final debe quedar registrado.

**Evento registrado en el historial**

"Historial del proyecto consolidado" con fecha, usuario responsable, eventos integrados, decisiones, costos, materiales, tiempos, incidencias y resultado final.

**Criterio para avanzar**

La memoria del proyecto está consolidada y disponible para consulta, reportes y aprendizaje.

### E15 — Aprendizaje
**Objetivo**

Preparar conocimiento útil del proyecto para mejorar futuras cotizaciones, planeación, compras, fabricación, instalación y análisis operativo.

**Información de entrada**

- Historial consolidado del proyecto.
- Cotización aprobada.
- Costos estimados y reales.
- Materiales estimados y utilizados.
- Desperdicio registrado.
- Tiempos estimados y reales.
- Incidencias, errores y retrabajos.
- Información de proveedores cuando exista.
- Resultado final y rentabilidad.

**Información de salida**

- Diferencias entre estimado y real identificadas.
- Desperdicio analizado.
- Tiempos reales documentados.
- Errores y retrabajos clasificados.
- Desempeño de materiales y proveedores registrado.
- Rentabilidad final resumida.
- Datos preparados para análisis operativo e IA futura.

**Módulos involucrados**

- Historial.
- Cotización.
- Compras.
- Inventario.
- Fabricación.
- Producción.
- Project Companion.
- Inspector Inteligente.

**Motores involucrados**

- BR Engine.
- Workflow Engine.
- Project Companion.

**Validaciones obligatorias**

- Debe existir historial consolidado.
- Las diferencias entre estimado y real deben quedar identificadas.
- El desperdicio y los tiempos reales deben registrarse cuando existan.
- Los errores, incidencias y retrabajos deben conservar trazabilidad.
- La rentabilidad final debe quedar resumida cuando existan datos suficientes.

**Evento registrado en el historial**

"Aprendizaje del proyecto registrado" con fecha, usuario responsable, diferencias detectadas, desperdicio, tiempos reales, errores, proveedores, materiales y rentabilidad.

**Criterio para avanzar**

El proyecto deja información útil para futuras decisiones operativas, reportes, análisis e IA futura.

---

# Fase Activa

## Fase 23.5 — Architecture & Design Bridge

### Objetivo
Consolidar la base arquitectónica y visual de ALUXOR antes de iniciar Fase 24, manteniendo el sistema centrado en proyectos y preparado para Workspace 2.0.

### Resultados esperados

- BR Design System aprobado.
- UI Blueprint aprobado.
- Project First Architecture adoptada.
- Workspace base validado.
- Día 2 iniciado, aún no cerrado.
- Día 3 pendiente.
- Base visual del Workspace compactada.
- Historial preparado para backend remoto sin backend implementado.

### Estructura de Fase 23.5

1. Día 1 — Fundamentos arquitectónicos y visuales.
2. Día 2 — Workspace 2.0.
3. Día 3 — Validación, pulido y cierre.

### Checklist histórico de Diseño de la Fase 23

- [x] Mapear el flujo completo del proyecto.
- [x] Definir estados mínimos.
- [x] Revisar integración entre módulos.
- [x] Revisar integración entre motores.
- [ ] Identificar información duplicada.
- [x] Definir eventos históricos mínimos.
- [x] Definir responsabilidades por etapa.
- [ ] Definir transiciones entre estados.
- [x] Definir validaciones por etapa.
- [x] Definir eventos del historial.

### Estado de Fase 23.5

- Día 1 cerrado y aprobado como base arquitectónica y visual.
- Día 2 iniciado y aún no cerrado: Workspace 2.0 guiado por estaciones.
- Estado "Sin conexión / Usando copia local" ajustado.
- `history.js` preparado para backend remoto con `VITE_HISTORY_API_URL`.
- Backend remoto de historial aún no implementado.
- Build estable.
- Día 3 pendiente: revisión visual, validación responsive, Project Companion, eliminación de duplicidades, build, documentación final y review de cierre.
- Fase 24 aún no ha iniciado.

---

# Riesgos Actuales

- Agregar funcionalidades sin consolidar la arquitectura.
- Duplicar información entre módulos.
- Iniciar IA sin datos suficientes.
- Romper estabilidad durante la integración.

---

# Decisiones Pendientes

- Transiciones oficiales entre estados.
- Reservas de inventario.
- Recepción parcial.
- Estructura técnica del historial de eventos.
- Backend remoto de historial.
- KPIs mínimos.
- Criterios para iniciar IA.

---

# Decisiones Confirmadas

- El proyecto es la entidad central del ERP.
- La trazabilidad es obligatoria.
- No se crearán módulos nuevos durante la consolidación.
- La Era II prioriza integración antes que expansión.
- La IA depende de datos operativos confiables.

---

# Registro de Sesiones

Este apartado documentará cada sesión de desarrollo de la Era II indicando:

- Fecha.
- Objetivo.
- Cambios realizados.
- Archivos afectados.
- Motores afectados.
- Pruebas ejecutadas.
- Resultado.
- Próximo paso.

---

# Criterio de Cierre de la Era II

La Era II finalizará cuando el proyecto pueda recorrer de forma consistente todas las etapas operativas del taller con trazabilidad suficiente, módulos integrados, estabilidad comprobada y una base de datos preparada para iniciar la Era III — Inteligencia Operativa.
