# ALUXOR / BR

# ROADMAP MAESTRO DE DESARROLLO

## Edición Operativa

---

> Documento vivo para dirigir la ejecución del producto, organizar las eras de desarrollo y definir qué sigue en ALUXOR / BR.

**Versión:** 1.0 (Borrador operativo)

**Estado del Proyecto:** Era II — ERP Operativo

**Fecha:** Julio 2026

---

## Relación con el Libro Maestro

Este documento NO sustituye al Libro Maestro.

La filosofía, arquitectura, visión, principios permanentes y decisiones estratégicas de ALUXOR / BR se documentan en:

`docs/roadmap/libro-maestro-aluxor-br.md`

Este archivo se utiliza para responder preguntas operativas:

- ¿Qué ya se construyó?
- ¿Qué fase está activa?
- ¿Qué sigue?
- ¿Qué depende de qué?
- ¿Qué módulos están afectados?
- ¿Qué criterios deben cumplirse para cerrar una etapa?

---

# Principio Rector — Sistema Centrado en Proyectos

ALUXOR / BR es un sistema centrado en proyectos.

La unidad principal del sistema no son los módulos.

La unidad principal es el proyecto.

Cada proyecto evoluciona a través de estaciones operativas que representan su avance real dentro del taller:

Recepción
→ Medición
→ Materiales
→ Accesorios
→ Producción
→ Validación
→ Instalación
→ Entrega
→ Garantía

Los módulos representan capacidades del sistema.

Las estaciones representan el estado, contexto y evolución de un proyecto.

Esto significa que el usuario no debe sentir que navega entre pantallas aisladas, sino que acompaña un proyecto activo desde su primer contacto hasta su cierre operativo.

Este principio debe guiar las decisiones futuras de interfaz, Workflow Engine, trazabilidad, sincronización, historial e inteligencia operativa.

---

# 1. Propósito del Roadmap

El Roadmap Maestro de Desarrollo es el centro de mando para continuar construyendo ALUXOR / BR.

Su función es organizar el avance del producto desde sus primeras fases hasta la etapa actual, definiendo eras, fases, prioridades, dependencias, riesgos, backlog y criterios de cierre.

Este documento debe actualizarse cada vez que:

- Se cierre una fase.
- Cambie el objetivo de una etapa.
- Se agregue o elimine una prioridad.
- Se detecte una dependencia crítica.
- Se tome una decisión que afecte el orden de desarrollo.

---

# 2. Estado Ejecutivo Actual

| Área | Estado | Observación |
|------|:------:|-------------|
| Arquitectura general | 🟢 Estable | Workspace y motores principales consolidados. |
| Cotización | 🟢 Estable | Base funcional del sistema. |
| BR Engine | 🟢 Estable | Núcleo de reglas y cálculos. |
| Workflow Engine | 🟢 Estable | Base del flujo de proyecto. |
| Cut Optimizer | 🟢 Estable | Fase 22 completada con validación física. |
| Producción | 🟡 En evolución | Requiere mayor trazabilidad. |
| Compras | 🟡 En evolución | Requiere integración más fuerte con proyecto e inventario. |
| Recepción | 🟡 En evolución | Requiere validaciones y evidencias. |
| Inventario | 🟡 En evolución | Requiere reservas, movimientos y conexión por proyecto. |
| Fabricación | 🟡 En evolución | Requiere planeación y seguimiento real. |
| Historial | 🟡 Funcional | Debe prepararse para aprendizaje futuro. |
| IA | 🔵 Planeada | Aún no debe ser prioridad hasta consolidar trazabilidad. |

## Dashboard de la Era II

- Era actual: Era II — ERP Operativo.
- Fase activa: Fase 23.5 — Architecture & Design Bridge.
- Estado general: Fase 23.5 Día 1 cerrada y aprobada como base arquitectónica y visual.
- Objetivo inmediato: Ejecutar Fase 23.5 Día 2 — Workspace 2.0 guiado por estaciones.
- Build: Estable.
- Pruebas: Aprobadas (estado base).
- Próximo hito: Cerrar Fase 23.5 antes de iniciar Fase 24.

## Avance del Proyecto

| Elemento | Estado | Avance |
|---|:---:|---:|
| Era 0 | ✅ | 100% |
| Era I | ✅ | 100% |
| Fase 22 | ✅ | 100% |
| Era II | 🟡 | 25% |
| Fase 23 | ✅ | 100% |
| Fase 23.5 | 🟡 | Día 1 cerrado |
| Fase 24 | ⏳ | 0% |
| Fase 25 | ⏳ | 0% |
| Fase 26 | ⏳ | 0% |
| Fase 27 | ⏳ | 0% |
| Fase 28 | ⏳ | 0% |
| Fase 29 | ⏳ | 0% |
| Fase 30 | ⏳ | 0% |

---

# 3. Historia del Desarrollo

## Era 0 — Descubrimiento

**Estado:** ✅ Completada

### Objetivo

Comprender el problema real del taller.

### Resultado

Se descubrió que el problema principal no era únicamente cotizar, sino administrar el ciclo completo del proyecto: cliente, medidas, materiales, compras, inventario, fabricación, instalación, entrega e historial.

### Decisión clave

El proyecto se convirtió en el centro del sistema.

---

## Era I — Fundación

**Estado:** ✅ Completada

### Objetivo

Construir la base funcional y arquitectónica de ALUXOR / BR.

### Capacidades consolidadas

- Workspace de tres columnas.
- Dashboard.
- Cotización profesional.
- BR Engine.
- Workflow Engine.
- Producción.
- Compras.
- Recepción.
- Inventario.
- Fabricación.
- Historial.
- Catálogo.
- Project Flow.
- Project Companion.
- Inspector Inteligente.
- Cut Optimizer.
- Pruebas automatizadas.
- Build estable.

### Resultado

ALUXOR / BR dejó de ser un cotizador y se consolidó como la base de un ERP especializado para talleres de fabricación personalizada.

---

## Fase 22 — Cut Optimizer

**Estado:** ✅ Completada

### Importancia

La Fase 22 fue un hito porque convirtió el Cut Optimizer en un motor físicamente consistente, validado y conectado con fabricación.

### Resultados

- Validación física de cortes.
- API estable.
- Integración con BR Engine.
- Render SVG.
- Consumo desde Fabricación.
- Impacto en costos.
- Pruebas automatizadas pasando.
- Build estable.

### Aprendizaje

Los motores deben validarse no solo en código, sino contra la realidad física del taller.

---

# Definición del ERP Operativo

El objetivo principal del ERP Operativo no es simplemente digitalizar información, sino coordinar de manera efectiva los proyectos, las personas, los materiales, el tiempo y las decisiones a lo largo del ciclo de vida de cada proyecto. Esto implica integrar procesos y módulos para que trabajen de forma sincronizada, garantizando la trazabilidad y la eficiencia operativa.

Esta coordinación permite que cada proyecto avance con visibilidad clara en todas sus etapas, desde la cotización hasta la entrega, facilitando la toma de decisiones basada en datos confiables y actualizados. Además, busca reducir la duplicidad de información y evitar la fragmentación del sistema.

El ERP Operativo también debe ser una plataforma flexible que se adapte a las necesidades cambiantes del taller, permitiendo escalar y preparar la base para futuras funcionalidades avanzadas, como la inteligencia artificial y reportes ejecutivos.

En resumen, la meta es transformar ALUXOR / BR en un sistema conectado y coherente que soporte la operación diaria del taller de manera integral y eficiente.

---

# 4. Era II — ERP Operativo

**Estado:** 🟡 Actual

## Objetivo general

Convertir ALUXOR / BR en un ERP operativo conectado, capaz de acompañar proyectos reales de principio a fin sin depender de módulos aislados.

## Enfoque

La Era II no debe centrarse en agregar pantallas grandes.

Debe centrarse en:

- Integrar módulos existentes.
- Reducir duplicidad de información.
- Fortalecer trazabilidad.
- Consolidar flujo por proyecto.
- Preparar historial útil para IA futura.
- Convertir operación dispersa en operación conectada.

## Objetivos Estratégicos

- **OE-1 Flujo Operativo:** Definir y consolidar el flujo mínimo completo del proyecto dentro del sistema.
- **OE-2 Trazabilidad:** Hacer visible qué ocurrió en cada proyecto, cuándo, quién intervino y qué impacto tuvo.
- **OE-3 Inventario:** Conectar inventario con proyectos, compras, fabricación y sobrantes para un control activo.
- **OE-4 Compras:** Integrar compras como consecuencia lógica de cotización, planeación, inventario y fabricación.
- **OE-5 Fabricación:** Fortalecer fabricación como etapa medible, trazable y conectada al proyecto.
- **OE-6 Reportes:** Proveer visibilidad ejecutiva sobre el desempeño del taller con métricas relevantes.
- **OE-7 Preparación para IA:** Preparar la base de datos y procesos para futuras funcionalidades de inteligencia artificial.

## Criterios para cerrar la Era II

La Era II podrá considerarse cerrada cuando:

- El proyecto pueda avanzar de cotización a entrega con trazabilidad básica.
- Compras, inventario y fabricación estén conectados al proyecto.
- Exista una lectura clara del estado operativo de cada proyecto.
- El historial capture eventos útiles.
- La arquitectura conserve estabilidad.
- Build y pruebas continúen pasando.
- El sistema esté listo para iniciar inteligencia operativa.

---

# 5. Fase 23 — Modelo Operativo Canónico del Proyecto

**Estado:** 🟡 En ejecución

## Objetivo

Documentar el Modelo Operativo Canónico del Proyecto, estableciendo el comportamiento esperado de cada etapa del ciclo de vida del proyecto y preparando la base funcional del Workflow Engine.

## Problema que resuelve

Actualmente existen módulos y motores importantes, pero la prioridad es asegurar que trabajen como un sistema conectado y no como secciones independientes.

## Alcance

- Revisar el flujo completo del proyecto.
- Definir estados operativos mínimos.
- Mapear relación entre cotización, producción, compras, recepción, inventario y fabricación.
- Identificar datos duplicados.
- Detectar huecos de integración.
- Definir eventos históricos mínimos.
- Preparar backlog depurado para Fase 24.

## Fuera de alcance

- IA avanzada.
- Rediseño total de interfaz.
- Nuevos módulos grandes.
- Reescritura completa de motores.

## Módulos afectados

- Cotización.
- Producción.
- Compras.
- Recepción.
- Inventario.
- Fabricación.
- Historial.
- Inspector Inteligente.

## Motores afectados

- BR Engine.
- Workflow Engine.
- Cut Optimizer.
- Project Companion.

## Entregables

- Modelo Conceptual del ERP.
- Modelo Operativo Canónico del Proyecto.
- Etapas E01–E15 documentadas.
- Estados canónicos del proyecto.
- Lista de integraciones pendientes.
- Lista de decisiones pendientes para Workflow Engine.

## Criterios de aceptación

- El Modelo Operativo Canónico está documentado.
- Las etapas E01–E15 están definidas.
- La relación entre módulos y motores está identificada.
- Existe una base para el Workflow Engine.
- El sistema conserva estabilidad documental y técnica.

---

## Fase 23.5 — Architecture & Design Bridge

**Estado:** 🟡 En ejecución

**Día 1:** ✅ Cerrado y aprobado.

La Fase 23.5 funciona como fase puente entre el Modelo Operativo Canónico y la implementación posterior de Fase 24. Su objetivo es asegurar que ALUXOR avance como sistema centrado en proyectos, no como suma de módulos aislados.

### Resultados del Día 1

- BR Design System aprobado como base visual.
- UI Blueprint aprobado como referencia de experiencia.
- Project First Architecture adoptada como principio rector.
- Workspace base y compactación inicial validados.
- Build de producción estable.

### Siguiente paso

Ejecutar el Día 2 de la Fase 23.5: Workspace 2.0 guiado por estaciones, sin modificar el motor principal de cálculo.

### Pendiente de continuidad

La Fase 24 permanece planeada y no ha iniciado. Cualquier referencia previa a iniciar Fase 24 debe entenderse como posterior al cierre completo de Fase 23.5.

---

# 6. Fase 24 — Trazabilidad Operativa

**Estado:** ⏳ Planeada

## Objetivo

Hacer visible qué ocurrió en cada proyecto, cuándo ocurrió, quién intervino y qué impacto tuvo.

## Alcance previsto

- Eventos de proyecto.
- Historial estructurado.
- Registro de cambios relevantes.
- Evidencias operativas.
- Línea de tiempo básica.
- Indicadores de avance.

## Resultado esperado

Cada proyecto debe poder entenderse sin depender de memoria, mensajes externos o explicaciones verbales.

---

# 7. Fase 25 — Inventario Operativo

**Estado:** ⏳ Planeada

## Objetivo

Conectar inventario con proyectos, compras, fabricación y sobrantes.

## Alcance previsto

- Existencias por material.
- Reservas por proyecto.
- Entradas y salidas.
- Sobrantes reutilizables.
- Alertas básicas.
- Relación con Cut Optimizer.

## Resultado esperado

El inventario deja de ser una lista aislada y se convierte en una herramienta activa de control operativo y económico.

---

# 8. Fase 26 — Compras y Proveedores

**Estado:** ⏳ Planeada

## Objetivo

Convertir compras en una consecuencia lógica de cotización, planeación, inventario y fabricación.

## Alcance previsto

- Requisiciones por proyecto.
- Estado de pedidos.
- Proveedores.
- Recepción parcial.
- Evidencias.
- Actualización de inventario.

## Resultado esperado

Reducir compras duplicadas, faltantes, errores de material y pérdidas por mala coordinación.

---

# 9. Fase 27 — Fabricación Operativa

**Estado:** ⏳ Planeada

## Objetivo

Fortalecer fabricación como etapa medible, trazable y conectada al proyecto.

## Alcance previsto

- Órdenes de fabricación.
- Estados internos.
- Material asignado.
- Tiempos estimados y reales.
- Avance por proyecto.
- Incidencias.

## Resultado esperado

El taller puede saber qué se está fabricando, qué falta y qué información debe alimentar futuros aprendizajes.

---

# 10. Fase 28 — Reportes Operativos

**Estado:** ⏳ Planeada

## Objetivo

Dar visibilidad ejecutiva al desempeño del taller.

## Métricas iniciales

- Cotizaciones generadas.
- Proyectos aprobados.
- Utilidad estimada.
- Utilidad real.
- Desperdicio.
- Compras por proveedor.
- Materiales más usados.
- Tiempos de fabricación.
- Entregas a tiempo.

## Resultado esperado

El dueño del taller puede tomar decisiones con datos y no solo con intuición.

---

# 11. Fase 29 — Inteligencia Operativa Inicial

**Estado:** ⏳ Planeada

## Objetivo

Introducir recomendaciones y advertencias simples basadas en datos reales.

## Alcance previsto

- Advertencias inteligentes.
- Riesgos en cotización.
- Comparación con proyectos anteriores.
- Desviaciones de costo.
- Desviaciones de tiempo.
- Sugerencias de materiales frecuentes.

## Condición previa

No iniciar esta fase hasta que la trazabilidad de Era II sea suficiente.

---

# 12. Fase 30 — Crecimiento Comercial del Taller

**Estado:** ⏳ Planeada

## Objetivo

Ayudar al taller a vender más y ser más visible.

## Alcance previsto

- Ideas de publicaciones.
- Catálogo visual.
- Promociones.
- Apoyo para anuncios.
- Identificación de trabajos vendibles.

## Resultado esperado

ALUXOR / BR ayuda al taller a crecer hacia afuera, no solo a organizarse internamente.

---

# 13. Backlog Priorizado

## Prioridad crítica

- Implementar estados del Workflow Engine.
- Implementar transiciones oficiales.
- Implementar registro de eventos históricos.
- Integrar Workflow Engine con Cotización.
- Integrar Workflow Engine con Producción.
- Integrar Workflow Engine con Historial.

## Prioridad alta

- Reservas de inventario por proyecto.
- Eventos de proyecto.
- Evidencias de recepción.
- Órdenes de fabricación.
- Reportes operativos básicos.

## Prioridad media

- Comparación de proveedores.
- Calendario operativo.
- Indicadores ejecutivos.
- Mejoras UX del Workspace.

## Futuro

- IA de cotización.
- IA de desperdicio.
- IA de tiempos.
- Marketplace.
- Multiempresa.
- App móvil.

---

# 14. Dependencias

| Dependencia | Impacto | Relacionada con |
|------------|---------|-----------------|
| Estados de proyecto claros | Sin esto no hay trazabilidad confiable. | Workflow Engine |
| Datos consistentes de cotización | Base para compras, fabricación e IA. | BR Engine |
| Inventario confiable | Necesario para compras y fabricación. | Inventario / Compras |
| Historial estructurado | Base de aprendizaje futuro. | Historial / IA |
| Integración de Cut Optimizer | Necesaria para fabricación y desperdicio. | Fabricación / BR Engine |

---

# 15. Riesgos Operativos

| Riesgo | Impacto | Mitigación |
|-------|---------|------------|
| Agregar módulos antes de consolidar | Fragmentación del sistema. | Priorizar integración. |
| Duplicar datos | Errores y mantenimiento difícil. | Definir fuente de verdad. |
| Iniciar IA demasiado pronto | Recomendaciones poco confiables. | Esperar trazabilidad suficiente. |
| Rediseñar sin necesidad | Retraso de la Era II. | Mejorar UX de forma incremental. |
| No actualizar documentación | Pérdida de contexto. | Mantener roadmap vivo. |

---

# Decisiones Abiertas

- Definir permisos por rol para ejecutar transiciones.
- Definir qué transiciones serán automáticas, manuales o mixtas.
- Definir la política de reversión de estados.
- Definir la estrategia de archivado de proyectos.
- Definir el versionado del Workflow Engine.

---

# 16. Criterios de Trabajo para Próximas Sesiones

Antes de iniciar cualquier tarea se debe responder:

1. ¿Qué fase afecta?
2. ¿Qué problema operativo resuelve?
3. ¿Qué módulo toca?
4. ¿Qué motor toca?
5. ¿Qué riesgo introduce?
6. ¿Qué prueba o validación necesita?
7. ¿Actualiza el roadmap?

---

# Próxima Sesión de Desarrollo

- **Objetivo:** Ejecutar Fase 23.5 Día 2 — Workspace 2.0 guiado por estaciones.
- **Módulos afectados:** Cotización, Producción, Historial y Project Companion.
- **Motores afectados:** BR Engine y Project Companion.
- **Validaciones esperadas:** Base visual estable, flujo centrado en proyecto y motor principal de cálculo sin cambios.
- **Resultado esperado:** Workspace 2.0 preparado como cierre de la fase puente antes de iniciar Fase 24.

---

# 17. Definición Breve de Eras Futuras

## Era III — Inteligencia Operativa

La plataforma comienza a recomendar, advertir y aprender del historial real del taller.

## Era IV — Ecosistema Empresarial

ALUXOR / BR se conecta con proveedores, clientes, servicios externos y operaciones multiempresa.

## Era V — Plataforma de Fabricación

La plataforma se expande más allá de carpintería, vidrio y aluminio hacia múltiples industrias de fabricación personalizada.

---

# 18. Próximo Objetivo Inmediato

Ejecutar Fase 23.5 Día 2 — Workspace 2.0 guiado por estaciones, manteniendo el motor principal de cálculo estable y preparando el cierre completo de la fase puente antes de iniciar Fase 24.
