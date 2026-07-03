# ALUXOR / BR

# LIBRO MAESTRO

## Edición Fundadora

---

> **Construyendo el sistema operativo para talleres de fabricación personalizada.**

**Versión:** 1.0 (Borrador)

**Estado del Proyecto:** Era II — ERP Operativo (Fase 23.5 Día 2 en ejecución)

**Fecha:** Julio 2026

---

## Documento Estratégico

Este documento constituye el Libro Maestro oficial de ALUXOR / BR. Reúne la visión, filosofía, arquitectura, principios, evolución y dirección estratégica del proyecto.

No es únicamente documentación técnica.

Es la guía que explica por qué existe el proyecto, cómo ha evolucionado y hacia dónde se dirige.


Su objetivo es preservar el conocimiento del proyecto para los próximos años y servir como referencia para desarrolladores, socios, inversionistas y futuros colaboradores.

### Alcance

Este documento no es el plan operativo diario del desarrollo.

Su propósito es preservar la visión fundadora, explicar las decisiones estratégicas del producto y servir como referencia para desarrolladores, socios, inversionistas y futuros colaboradores.

El seguimiento detallado de fases, tareas, prioridades y ejecución cotidiana se administra en el Roadmap Maestro de Desarrollo, documento independiente que evoluciona junto con el producto.

---

## Declaración de Identidad del Proyecto

ALUXOR / BR existe para ayudar a los talleres a crecer como negocio.

No se limita a organizar información ni a ejecutar cálculos. Su propósito es acompañar al taller en las actividades que determinan su crecimiento real: organizar, cotizar, vender, producir, aprender y anunciarse para ser visto por más clientes.

La plataforma nace desde la operación diaria de talleres pequeños, pero su visión es mucho más amplia. ALUXOR / BR busca convertirse en una capa de inteligencia y efectividad para negocios de fabricación personalizada, ayudándoles a tomar mejores decisiones, reducir errores y construir procesos más profesionales.

El objetivo no es crear una herramienta aislada.

El objetivo es construir un sistema que ayude al negocio a operar mejor, vender mejor y crecer con mayor orden.

### Lo que ALUXOR / BR no debe ser

ALUXOR / BR no debe limitarse a ser una aplicación de herramientas.

No debe convertirse únicamente en un cotizador, un control de materiales, un inventario digital o una versión más ordenada de una hoja de cálculo.

Su valor debe estar en la inteligencia que conecta esas piezas.

La plataforma debe ayudar al usuario a trabajar con mayor precisión, detectar errores, mejorar su flujo de negocio y transformar la experiencia acumulada del taller en decisiones cada vez más efectivas.

### Cliente ideal

En su primera etapa, ALUXOR / BR está diseñado para negocios pequeños y medianos de carpintería, vidrio, aluminio y fabricación personalizada que necesitan profesionalizar su operación sin adoptar sistemas empresariales complejos.

En una segunda etapa, la plataforma podrá extenderse hacia proveedores de talleres, distribuidores de materiales, negocios relacionados con insumos, herrajes, perfiles, tableros, vidrio y servicios complementarios.

En una visión de largo plazo, ALUXOR / BR podrá evolucionar hacia constructoras, despachos, desarrolladores inmobiliarios y empresas que gestionan múltiples proyectos de fabricación, instalación y suministro.

### Problema central

El primer problema que ALUXOR / BR debe resolver es la reducción de errores.

En los talleres, un error matemático puede convertirse en pérdida de material, pérdida de utilidad, retrabajo, retrasos, conflictos con el cliente o decisiones equivocadas de compra.

Pero el problema no termina en la matemática.

La operación completa del taller suele depender de información dispersa, procesos manuales, memoria personal y decisiones tomadas sin suficiente contexto.

ALUXOR / BR debe reducir esos errores al conectar la cotización, los materiales, los costos, la producción, las compras, el inventario, la fabricación y el historial del proyecto dentro de un mismo sistema.

### Diferenciador principal

ALUXOR / BR se diferencia porque no busca solamente cotizar ni llevar control de material.

Su propósito es mejorar el flujo completo del negocio.

Mientras muchas herramientas se enfocan en una función aislada, ALUXOR / BR entiende que el verdadero valor aparece cuando cada parte del taller se conecta alrededor del proyecto: desde la venta inicial hasta la entrega, el historial y el aprendizaje futuro.

La ventaja competitiva de ALUXOR / BR está en convertir la operación diaria del taller en un sistema inteligente, capaz de aprender de lo que ocurre, anticipar riesgos y ayudar al negocio a crecer con mayor claridad.

---

## Estado actual

ALUXOR / BR nace a partir de la experiencia real de dos talleres:

- **ALUXOR** — Taller de vidrio y aluminio.
- **BosqueReal** — Taller de carpintería.

Ambos comparten los mismos problemas de administración, fabricación y seguimiento de proyectos.

La primera implementación del sistema está orientada a resolver esas necesidades reales, con la visión de evolucionar hacia una plataforma adaptable para cualquier taller de fabricación personalizada.

<div class="page-break"></div>

# Índice

1. Resumen Ejecutivo
2. Declaración de Identidad del Proyecto
3. Carta del Fundador
4. ¿Por qué existe ALUXOR / BR?
5. Problema de la Industria
6. Filosofía del Producto
7. Norte del Proyecto
8. Flujo Maestro del Taller
9. Arquitectura General
10. Workspace
11. BR Engine
12. Workflow Engine
13. Cut Optimizer
14. Project Companion
15. Inspector Inteligente
16. Estado Actual
17. Dashboard Ejecutivo
18. Roadmap por Eras
19. Era II — Integración e Inteligencia
20. Backlog Maestro
21. Visión de Inteligencia Artificial
22. Modelo de Negocio
23. Visión 2035
24. Anexos

<div class="page-break"></div>

# Carta del fundador

ALUXOR / BR no nació con la intención de convertirse en otro cotizador.

Nació como respuesta a un problema que viven miles de talleres todos los días.

Durante años, los talleres de carpintería, aluminio y vidrio han trabajado utilizando herramientas separadas para realizar cotizaciones, administrar materiales, controlar compras, fabricar productos y dar seguimiento a los proyectos.

La información se pierde entre hojas de cálculo, mensajes, llamadas telefónicas y documentos dispersos.

Cada proyecto vuelve a comenzar prácticamente desde cero.

Cada empleado guarda parte del conocimiento del taller únicamente en su experiencia personal.

Nuestro objetivo es cambiar esa realidad.

ALUXOR / BR busca convertirse en el sistema operativo del taller moderno.

Un único Workspace capaz de acompañar un proyecto desde la primera conversación con el cliente hasta la entrega final, aprendiendo continuamente de cada trabajo realizado.

Este documento representa la visión fundadora del proyecto y será la base sobre la cual evolucionarán las siguientes versiones del sistema.

<div class="page-break"></div>
# ¿Por qué existe ALUXOR / BR?

## El origen

ALUXOR / BR no nació como una idea para desarrollar un software.

Nació dentro de un taller.

Durante años fue posible observar cómo la mayor parte del tiempo no se perdía fabricando muebles, canceles o cocinas. El verdadero tiempo se perdía buscando información, corrigiendo errores, preguntando medidas nuevamente, recalculando materiales y resolviendo problemas que ya habían ocurrido antes.

Fue entonces cuando apareció una pregunta que cambiaría por completo la dirección del proyecto:

> **¿Y si el problema no fuera la cotización, sino la forma en la que se administra todo el proyecto?**

Esa pregunta marcó el inicio de ALUXOR / BR.

---

## Mucho más que un cotizador

Al principio parecía lógico desarrollar únicamente un cotizador profesional.

Sin embargo, conforme el proyecto avanzó quedó claro que la cotización representa solamente una pequeña parte del trabajo real de un taller.

Después de entregar un precio comienzan procesos mucho más complejos:

- Confirmación del proyecto.
- Levantamiento de medidas.
- Definición de materiales.
- Optimización de cortes.
- Compra de insumos.
- Recepción de mercancía.
- Fabricación.
- Instalación.
- Entrega.
- Garantía.

Si cualquiera de esos pasos falla, el proyecto completo se ve afectado.

Por esa razón ALUXOR / BR dejó de evolucionar como un cotizador y comenzó a transformarse en un sistema capaz de acompañar todo el ciclo de vida del proyecto.

---

## El conocimiento no debe perderse

Uno de los mayores problemas detectados en los talleres tradicionales es que gran parte del conocimiento permanece únicamente en la experiencia de las personas.

Cuando un empleado deja la empresa también se pierde información importante:

- Cómo resolvía ciertos trabajos.
- Qué materiales prefería.
- Qué errores evitaba.
- Qué proveedores funcionaban mejor.
- Cuánto tiempo tomaba realmente fabricar un proyecto.

ALUXOR / BR busca convertir ese conocimiento en información estructurada para que el taller aprenda de cada proyecto terminado.

Cada trabajo debe hacer más inteligente al siguiente.

---

## El proyecto como centro del sistema

Muchos programas están organizados alrededor de módulos independientes.

ALUXOR / BR adopta una filosofía diferente.

El elemento principal no es la venta.

No es la cotización.

No es el inventario.

El verdadero protagonista es **el proyecto**.

Cada módulo existe únicamente para ayudar al proyecto a avanzar desde su primera conversación con el cliente hasta su entrega final.

Esa decisión define toda la arquitectura del sistema.

---

## Nuestra convicción

Creemos que los talleres pequeños y medianos merecen herramientas del mismo nivel que utilizan las grandes empresas manufactureras.

No herramientas más complejas.

Herramientas más inteligentes.

Más simples.

Más conectadas.

Más útiles.

ALUXOR / BR nace con ese propósito:

Construir el sistema operativo que acompañe el crecimiento del taller durante muchos años, preservando su conocimiento, reduciendo errores y convirtiéndose en una plataforma capaz de evolucionar junto con la empresa.

<div class="page-break"></div>
<div class="page-break"></div>

# Resumen Ejecutivo

## Proyecto

**ALUXOR / BR** (nombre comercial provisional)

ALUXOR / BR es un ERP especializado para talleres de fabricación personalizada. Su propósito es integrar en un solo Workspace todas las actividades necesarias para administrar un proyecto desde el primer contacto con el cliente hasta su entrega e historial.

La primera implementación del sistema se desarrolla a partir de la experiencia real de dos talleres:

- **ALUXOR** — Especializado en vidrio y aluminio.
- **BosqueReal** — Especializado en carpintería y fabricación de mobiliario.

Aunque nace en estos dos sectores, la arquitectura del sistema está diseñada para evolucionar hacia una plataforma adaptable a cualquier taller de fabricación personalizada.

---

# Estado actual del proyecto

Durante las primeras fases de desarrollo se consolidó la arquitectura principal del sistema.

Actualmente el proyecto cuenta con:

- Workspace unificado.
- Dashboard principal.
- Sistema profesional de cotizaciones.
- BR Engine.
- Workflow Engine.
- Cut Optimizer.
- Producción.
- Compras.
- Recepción.
- Inventario.
- Fabricación.
- Historial.
- Catálogo.
- Inspector Inteligente.
- Project Flow.
- Project Companion.
- Historial preparado para backend remoto mediante `VITE_HISTORY_API_URL`.

El backend remoto de historial aún no está implementado.

La Fase 22 representa uno de los hitos más importantes del proyecto al convertir el Cut Optimizer en un motor físicamente consistente e integrado con el resto de la plataforma.

Entre los resultados obtenidos destacan:

- Validación física de los cortes.
- API estable para integración.
- Integración con BR Engine.
- Impacto automático sobre costos y resumen económico.
- Consumo directo desde Fabricación.
- Más de 45 pruebas automatizadas.
- Build estable para producción.

---

# Nuestra visión

No buscamos desarrollar un software más para talleres.

Buscamos construir una plataforma que acompañe cada proyecto durante todo su ciclo de vida.

Cada módulo, cada motor y cada futura integración existe para cumplir un mismo objetivo:

> Convertir la información del taller en conocimiento permanente, reducir errores y permitir que cualquier empresa de fabricación personalizada pueda crecer sobre una base tecnológica sólida.

---

# Principio rector

**El proyecto es el centro del sistema.**

No la cotización.

No la fabricación.

No el inventario.

Todo gira alrededor del proyecto.

Cada motor existe para ayudar al proyecto a avanzar de forma controlada, documentada y medible.

<div class="page-break"></div>

# Flujo Maestro del Taller

## Filosofía

ALUXOR / BR no administra módulos aislados.

Administra el ciclo de vida completo de un proyecto.

Cada etapa genera información que alimenta a la siguiente y, al finalizar, el conocimiento obtenido permanece disponible para futuros proyectos.

---

## Flujo General

```text
Cliente
    ↓
Prospección
    ↓
Entrevista y levantamiento de necesidades
    ↓
Visita y toma de medidas
    ↓
Diseño de la solución
    ↓
Cotización
    ↓
Negociación y aprobación
    ↓
Planeación
    ↓
Compras
    ↓
Recepción de materiales
    ↓
Inventario
    ↓
Optimización de cortes
    ↓
Fabricación
    ↓
Control de calidad
    ↓
Instalación
    ↓
Entrega
    ↓
Garantía y servicio
    ↓
Historial
    ↓
Aprendizaje
```

---

## Principio fundamental

Cada paso debe dejar información útil para el siguiente.

El objetivo no es únicamente completar un proyecto, sino lograr que cada proyecto haga más inteligente al taller.

Este flujo será la referencia para todas las fases futuras del roadmap. Ninguna funcionalidad nueva deberá romper este ciclo; por el contrario, deberá fortalecerlo, simplificarlo o aportar información que permita mejorar las decisiones del negocio.
<div class="page-break"></div>

# Norte del Proyecto

## Principios no negociables

- El proyecto es el centro del sistema.
- La IA debe potenciar al usuario, nunca reemplazarlo.
- Cada dato debe capturarse una sola vez y reutilizarse.
- Ningún módulo debe existir sin resolver un problema real del taller.
- Cada proyecto terminado debe enriquecer el conocimiento del siguiente.
- La simplicidad para el usuario tiene prioridad sobre la complejidad técnica interna.
- La arquitectura debe mantenerse modular, desacoplada y escalable.

## Criterio para aceptar nuevas funcionalidades

Toda propuesta deberá responder afirmativamente a estas preguntas:

1. ¿Qué problema real del taller resuelve?
2. ¿En qué parte del flujo maestro aporta valor?
3. ¿Qué motor o módulo fortalece?
4. ¿Cómo aprovechará esta información la IA en el futuro?
5. ¿Reduce errores, tiempo o desperdicio?

Si una funcionalidad no responde claramente a estas preguntas, deberá reconsiderarse antes de incorporarse al roadmap.

<div class="page-break"></div>

# Roadmap por Eras

| Era | Estado | Objetivo |
|------|:------:|----------|
| Era 0 — Descubrimiento | ✅ | Comprender el problema real del taller. |
| Era I — Fundación | ✅ | Construir la arquitectura y los motores principales. |
| Era II — Integración e Inteligencia | 🟡 | Consolidar la plataforma y conectar todos los módulos. |
| Era III — Inteligencia Operativa | ⏳ | Aprendizaje, automatización y recomendaciones. |
| Era IV — Ecosistema Empresarial | ⏳ | Integración con proveedores, clientes y servicios externos. |
| Era V — Plataforma de Fabricación | ⏳ | Expandir ALUXOR hacia múltiples industrias de fabricación personalizada. |

<div class="page-break"></div>

# Dashboard Ejecutivo

| Área | Estado | Madurez | Próximo objetivo |
|------|:------:|:--------:|------------------|
| Workspace | 🟢 | Alta | Optimizar UX y personalización. |
| Cotización | 🟢 | Alta | IA de apoyo y recomendaciones. |
| BR Engine | 🟢 | Alta | Ampliar reglas de negocio. |
| Workflow Engine | 🟢 | Alta | Automatizaciones inteligentes. |
| Cut Optimizer | 🟢 | Alta | Nuevos algoritmos de optimización. |
| Producción | 🟡 | Media | Trazabilidad y métricas. |
| Compras | 🟡 | Media | Automatización de pedidos. |
| Recepción | 🟡 | Media | Validaciones y evidencias. |
| Inventario | 🟡 | Media | Reservas y movimientos automáticos. |
| Fabricación | 🟡 | Media | Planeación y seguimiento. |
| Inspector Inteligente | 🟡 | Media | Diagnóstico automático. |
| Project Companion | 🟡 | Media | Memoria y asistencia contextual. |
| Inteligencia Artificial | 🔵 | Inicial | Aprendizaje basado en historial. |

<div class="page-break"></div>

# Era II — Integración e Inteligencia

## Objetivo

Consolidar la plataforma existente antes de incorporar nuevos módulos de gran tamaño.

## Prioridades

- Integrar completamente los motores existentes.
- Reducir deuda técnica.
- Mejorar la experiencia de uso.
- Validar el flujo real del taller.
- Preparar la infraestructura para la inteligencia artificial.

## Criterios de éxito

- Los módulos comparten información sin duplicidad.
- El flujo del proyecto puede seguirse de principio a fin.
- La información capturada una vez se reutiliza en todo el sistema.
- La arquitectura permanece modular y escalable.
- La plataforma está lista para comenzar la Era III.

<div class="page-break"></div>

# Backlog Maestro

## Prioridad crítica

- Consolidar Producción.
- Consolidar Inventario.
- Consolidar Compras.
- Integración completa entre motores.

## Prioridad alta

- IA para cotización.
- IA para materiales.
- IA para desperdicios.
- IA para tiempos de fabricación.

## Investigación

- Integración con proveedores.
- Agenda y calendario operativo.
- Reportes ejecutivos.
- Indicadores de desempeño (KPIs).


## Visión futura

- Plataforma multiempresa.
- Aplicaciones móviles.
- API pública.
- Marketplace para talleres y proveedores.
- Ecosistema de fabricación personalizada.

<div class="page-break"></div>

# Arquitectura General

## Una plataforma basada en motores

ALUXOR / BR está diseñado como una plataforma compuesta por motores especializados y módulos de negocio que colaboran entre sí.

Los módulos representan la experiencia del usuario. Los motores concentran las reglas, cálculos, automatizaciones y lógica del sistema.

Esta separación permite que la plataforma evolucione sin depender de una sola pantalla o flujo de trabajo.

## Componentes principales

```text
                 Usuario
                    │
             Workspace Unificado
                    │
 ┌──────────────────┼──────────────────┐
 │                  │                  │
Cotización     Producción       Administración
 │                  │                  │
 └──────────────────┼──────────────────┘
                    │
             Workflow Engine
                    │
      ┌─────────────┼─────────────┐
      │             │             │
   BR Engine   Cut Optimizer   Project Companion
      │             │             │
      └─────────────┼─────────────┘
                    │
          Inspector Inteligente
                    │
          Historial y Aprendizaje
```

## Filosofía de la arquitectura

La arquitectura no está organizada alrededor de pantallas, sino alrededor del proyecto.

Cada motor tiene una responsabilidad claramente definida y ningún componente debe duplicar lógica de negocio que ya exista en otro motor.

Esta organización facilita el mantenimiento, reduce la deuda técnica y prepara la plataforma para incorporar inteligencia artificial sin reescribir el núcleo del sistema.

<div class="page-break"></div>

# BR Engine

## Propósito

El BR Engine es el núcleo de negocio de ALUXOR / BR.

Centraliza las reglas de cálculo, costos, utilidades, validaciones y operaciones que deben comportarse de forma consistente en toda la plataforma.

## Responsabilidades

- Cálculos económicos.
- Costos internos.
- Utilidades.
- Reglas de negocio.
- Consistencia de resultados.

## Principio

Ningún módulo debe implementar por su cuenta reglas que ya pertenecen al BR Engine. Toda lógica compartida debe concentrarse en este motor para garantizar resultados uniformes en toda la aplicación.

<div class="page-break"></div>

# Workflow Engine

## Propósito

El Workflow Engine administra el avance del proyecto dentro de ALUXOR / BR.

Su función es ordenar los estados, transiciones, eventos y automatizaciones que permiten que un proyecto avance desde la cotización hasta la entrega final.

## Responsabilidades

- Definir estados del proyecto.
- Controlar transiciones entre etapas.
- Registrar eventos relevantes.
- Activar automatizaciones operativas.
- Mantener trazabilidad del avance.

## Principio

El Workflow Engine no debe ser una lista rígida de pasos.

Debe ser un sistema flexible capaz de representar el flujo real de distintos talleres, permitiendo que ALUXOR / BR se adapte a negocios pequeños, medianos y eventualmente a operaciones más complejas.

## Relación con la inteligencia artificial

En el futuro, la IA podrá apoyarse en el Workflow Engine para detectar retrasos, riesgos, cuellos de botella, pasos omitidos o desviaciones frente al comportamiento histórico del taller.

<div class="page-break"></div>

# Cut Optimizer

## Propósito

El Cut Optimizer es el motor encargado de convertir medidas, piezas y materiales en decisiones de aprovechamiento físico.

Su objetivo es reducir desperdicio, mejorar la precisión de fabricación y conectar la cotización con la producción real.

## Responsabilidades

- Recibir piezas y materiales disponibles.
- Calcular distribuciones de corte.
- Validar restricciones físicas.
- Generar información visual mediante SVG.
- Comunicar impactos económicos al BR Engine.
- Alimentar fabricación con datos accionables.

## Principio

El Cut Optimizer no debe operar como una calculadora aislada.

Debe funcionar como un puente entre cotización, costos, materiales, inventario y fabricación.

Una optimización correcta no solo mejora el uso del material; también protege la utilidad del proyecto y reduce errores antes de llegar al taller.

## Evolución futura

El motor podrá evolucionar hacia algoritmos alternativos de optimización, comparación entre proveedores, sugerencia de material ideal, análisis de sobrantes reutilizables y aprendizaje basado en cortes históricos.

<div class="page-break"></div>

# Project Companion

## Propósito

Project Companion representa la capa de acompañamiento contextual del proyecto.

Su función es ayudar al usuario a entender qué está ocurriendo, qué falta, qué riesgos existen y qué decisiones podrían mejorar el resultado del proyecto.

## Responsabilidades

- Mantener contexto del proyecto.
- Resumir información relevante.
- Acompañar al usuario durante el flujo operativo.
- Detectar posibles omisiones.
- Preparar la base para asistencia inteligente.

## Principio

Project Companion no debe reemplazar la experiencia del usuario.

Debe actuar como un segundo par de ojos: atento, contextual y útil, pero siempre subordinado al criterio humano.

## Evolución futura

Conforme ALUXOR / BR acumule historial, Project Companion podrá transformarse en una capa de asistencia más avanzada, capaz de explicar decisiones, sugerir acciones, comparar proyectos similares y ayudar a prevenir errores antes de que ocurran.

<div class="page-break"></div>

# Inspector Inteligente

## Propósito

El Inspector Inteligente es la capa de revisión, diagnóstico y advertencia dentro del Workspace.

Su objetivo es identificar información incompleta, inconsistencias, riesgos económicos, riesgos operativos y oportunidades de mejora antes de que el proyecto avance demasiado.

## Responsabilidades

- Revisar datos clave del proyecto.
- Detectar inconsistencias.
- Advertir sobre riesgos.
- Señalar omisiones.
- Dar visibilidad sobre puntos críticos.
- Preparar diagnósticos para futuras capacidades de IA.

## Principio

El Inspector Inteligente debe ayudar a prevenir errores, no solo reportarlos después de que ocurren.

Su valor aumenta cuando logra intervenir en el momento correcto del flujo, con información clara y accionable para el usuario.

<div class="page-break"></div>

# Visión de Inteligencia Artificial

## Filosofía

La inteligencia artificial en ALUXOR / BR debe ser una capa de aprendizaje, apoyo y prevención.

No debe sustituir al usuario ni tomar decisiones críticas sin intervención humana.

Su propósito será convertir el historial operativo del taller en conocimiento útil para mejorar cotizaciones, compras, producción, uso de materiales, tiempos, publicidad y decisiones de negocio.

## Qué debe aprender

- Cotizaciones realizadas.
- Tiempos reales de fabricación.
- Desperdicios generados.
- Materiales más utilizados.
- Proveedores más efectivos.
- Compras recurrentes.
- Problemas de producción.
- Diferencias entre estimado y resultado real.
- Proyectos exitosos.
- Errores frecuentes.

## Qué debe ayudar a mejorar

- Precisión de cotizaciones.
- Selección de materiales.
- Planeación de compras.
- Reducción de desperdicio.
- Detección de riesgos.
- Organización del trabajo.
- Generación de publicidad.
- Identificación de oportunidades comerciales.

## Límites

La IA no debe ocultar cálculos, inventar datos, reemplazar autorizaciones humanas ni modificar información crítica sin trazabilidad.

Toda recomendación importante debe poder explicarse, revisarse y corregirse.

## Principio rector de IA

La IA debe hacer más fuerte al taller, no volverlo dependiente.

Debe ampliar la capacidad del usuario para decidir, revisar, comparar, anticipar y mejorar. No debe ocultar el razonamiento ni convertir el sistema en una caja negra.

<div class="page-break"></div>

# Modelo de Negocio

## Propósito

ALUXOR / BR será una plataforma sostenible cuyo crecimiento permita financiar la mejora continua del producto y el acompañamiento a los talleres que lo utilizan.

## Modalidades

### Licencia permanente

El cliente adquiere una versión estable del sistema y conserva el derecho de utilizarla de forma indefinida. Las versiones mayores futuras podrán adquirirse por separado.

### Suscripción

El cliente obtiene acceso continuo a mejoras, nuevas funcionalidades, soporte, actualizaciones y futuras capacidades de inteligencia artificial.

## Filosofía comercial

El éxito de ALUXOR / BR dependerá del crecimiento de sus clientes. Cada mejora incorporada deberá traducirse en mayor organización, menos errores, mayor rentabilidad o nuevas oportunidades de negocio para el taller.

<div class="page-break"></div>

# Visión 2035

## Una plataforma para la fabricación personalizada

La visión de largo plazo es que ALUXOR / BR deje de ser una solución exclusiva para carpintería, aluminio y vidrio.

La arquitectura deberá permitir incorporar nuevos sectores de fabricación personalizada sin reconstruir el núcleo del sistema.

## Ecosistema

Para 2035 la plataforma buscará integrar:

- Talleres.
- Proveedores.
- Constructoras.
- Diseñadores.
- Instaladores.
- Clientes.
- Servicios externos.

Todos conectados mediante una misma plataforma de información.

## Inteligencia colectiva

Cada proyecto terminado aportará conocimiento anonimizado para mejorar modelos de estimación, tiempos, desperdicios y recomendaciones, respetando siempre la privacidad y el control de los datos de cada empresa.

## Principio rector

ALUXOR / BR no medirá su éxito por la cantidad de funciones incorporadas, sino por la capacidad de ayudar a los talleres a crecer de forma organizada, rentable y sostenible.

<div class="page-break"></div>

# Gobierno del Libro Maestro

Este documento es la referencia oficial para la evolución del producto.

Antes de iniciar una nueva fase deberán revisarse:

- La visión del proyecto.
- El Norte del Proyecto.
- El Dashboard Ejecutivo.
- El estado de la Era actual.
- El Backlog Maestro.

Toda decisión arquitectónica relevante deberá quedar documentada para preservar el contexto y evitar perder conocimiento con el paso del tiempo.

## Criterios para cerrar una fase

Una fase solo podrá considerarse terminada cuando:

- Cumpla los objetivos definidos.
- Mantenga la estabilidad del sistema.
- No incremente deuda técnica significativa.
- Cuente con pruebas suficientes cuando corresponda.
- Actualice este Libro Maestro con los aprendizajes y decisiones tomadas.

## Próximo objetivo inmediato

Cerrar la Fase 23.5 Día 2 y ejecutar Día 3 antes de iniciar Fase 24. El Día 1 quedó cerrado y aprobado como base arquitectónica y visual; el Día 2 ya inició y está enfocado en Workspace 2.0 guiado por estaciones; el Día 3 queda pendiente para validación, pulido y cierre.

El Libro Maestro debe mantenerse alineado con la evolución real de ALUXOR / BR, mientras que el Roadmap Maestro de Desarrollo documentará la ejecución de cada era y fase.

<div class="page-break"></div>

# Fase 23 — Consolidación del Sistema Operativo del Taller

## Estado

✅ Completada como base documental y operativa.

## Objetivo

Convertir la plataforma actual en un sistema operativo de taller más integrado, consistente y preparado para operar proyectos reales de principio a fin.

La Fase 23 no debe enfocarse en agregar nuevas pantallas grandes. Su prioridad es consolidar lo existente, cerrar huecos operativos, conectar mejor los módulos y preparar la base para inteligencia futura.

## Problema que resuelve

Después de la Fase 22, ALUXOR / BR cuenta con motores y módulos importantes. Sin embargo, el valor real aparece cuando esos componentes trabajan juntos como un solo sistema.

La Fase 23 busca evitar que la plataforma se convierta en un conjunto de secciones independientes. El objetivo es que cotización, producción, compras, recepción, inventario, fabricación, historial, motores e inspector compartan una misma narrativa operativa alrededor del proyecto.

## Alcance propuesto

- Revisar la integración entre módulos existentes.
- Definir el flujo mínimo completo de proyecto.
- Consolidar estados operativos del proyecto.
- Mejorar trazabilidad entre cotización, compras, inventario y fabricación.
- Identificar duplicidades de datos.
- Fortalecer el uso del Workflow Engine.
- Preparar eventos históricos útiles para IA futura.
- Revisar criterios de estabilidad antes de iniciar nuevas capacidades grandes.

## Fuera de alcance

- No crear un módulo nuevo de gran tamaño.
- No introducir IA generativa compleja todavía.
- No rediseñar completamente la interfaz.
- No romper la arquitectura consolidada.
- No agregar funcionalidades que no estén conectadas al flujo maestro.

## Entregables esperados

- Mapa funcional del flujo completo del proyecto.
- Lista de integraciones faltantes entre módulos.
- Definición clara de estados de proyecto.
- Criterios de transición entre etapas.
- Revisión de información capturada y reutilizada.
- Backlog depurado para Fase 24 y Fase 25.
- Documento actualizado con aprendizajes de la fase.

## Criterios de aceptación

La Fase 23 podrá considerarse terminada cuando:

- Exista claridad sobre cómo avanza un proyecto dentro del sistema.
- Los módulos principales estén alineados al flujo maestro.
- Las dependencias entre motores estén documentadas.
- No existan duplicidades críticas de información.
- El sistema mantenga build estable y pruebas pasando.
- El roadmap quede actualizado con el siguiente paso operativo.

<div class="page-break"></div>

# Fase 23.5 — Architecture & Design Bridge

## Estado

🟡 En ejecución.

## Día 1

✅ Cerrado y aprobado.

## Día 2

🟡 Iniciado, aún no cerrado.

## Día 3

⏳ Pendiente.

## Objetivo

Consolidar la base arquitectónica y visual que permitirá evolucionar ALUXOR como sistema centrado en proyectos antes de iniciar la Fase 24.

## Resultados del Día 1

- BR Design System aprobado.
- UI Blueprint aprobado.
- Project First Architecture adoptada.
- Workspace base validado.
- Compactación inicial validada.
- Build estable.

## Día 1 — Fundamentos arquitectónicos y visuales

- BR Design System.
- UI Blueprint.
- Project First Architecture.
- Review de consistencia documental.
- Base visual aprobada.

## Avance del Día 2

- Workspace 2.0 iniciado.
- Workspace guiado por estaciones.
- Compactación visual.
- Proyecto como centro de la experiencia.
- Base visual del Workspace compactada.
- Project First Architecture preservada.
- Estado "Sin conexión / Usando copia local" ajustado.
- Historial preparado para backend remoto mediante `VITE_HISTORY_API_URL`.
- Backend remoto de historial pendiente de implementación.
- No modificar motor de cálculo ni BR Engine.
- Build estable.

## Día 3 — Validación, pulido y cierre

- Revisión visual completa.
- Validación responsive.
- Validación de Project Companion.
- Eliminación de duplicidades.
- Verificación de build.
- Actualización documental final.
- Review final de cierre de Fase 23.5.
- Preparación formal para iniciar Fase 24.

## Siguiente paso

Cerrar el Día 2 de la Fase 23.5 y ejecutar Día 3 antes de iniciar Fase 24.

## Pendiente de continuidad

La Fase 24 aún no ha iniciado. Su arranque queda condicionado al cierre completo de Día 3 de Fase 23.5.

<div class="page-break"></div>

# Fase 24 — Trazabilidad Operativa

## Estado

⏳ Planeada

## Objetivo

Hacer visible el recorrido completo de cada proyecto dentro del taller.

La Fase 24 deberá permitir entender qué ocurrió, cuándo ocurrió, quién intervino, qué cambió, qué materiales se utilizaron, qué decisiones se tomaron y qué impacto tuvo cada etapa en el resultado final.

## Propósito

La trazabilidad es la base para tres capacidades futuras:

1. Control operativo real.
2. Aprendizaje histórico.
3. Inteligencia artificial confiable.

Sin trazabilidad, la IA no puede aprender correctamente y el negocio no puede mejorar con precisión.

## Alcance propuesto

- Eventos de proyecto.
- Historial estructurado.
- Registro de cambios importantes.
- Relación entre cotización, compras, inventario y fabricación.
- Evidencias operativas.
- Indicadores básicos de avance.

## Resultado esperado

Que cualquier usuario pueda entender el estado real de un proyecto sin depender de memoria, mensajes externos o explicaciones verbales.

<div class="page-break"></div>

# Fase 25 — Inventario Inteligente

## Estado

⏳ Planeada

## Objetivo

Convertir el inventario en una herramienta conectada al proyecto, no solo en una lista de existencias.

## Problema que resuelve

Muchos talleres pierden dinero porque no saben exactamente qué material tienen, qué está reservado, qué se compró para un proyecto, qué sobró y qué puede reutilizarse.

La Fase 25 deberá fortalecer el inventario para que funcione como una fuente confiable de decisiones.

## Alcance propuesto

- Reservas por proyecto.
- Entradas y salidas relacionadas con compras y fabricación.
- Sobrantes reutilizables.
- Alertas de bajo inventario.
- Relación con Cut Optimizer.
- Impacto en costos y utilidad.

## Resultado esperado

Que el inventario deje de ser reactivo y se convierta en una capa activa de control económico y operativo.

<div class="page-break"></div>

# Fase 26 — Compras y Proveedores

## Estado

⏳ Planeada

## Objetivo

Profesionalizar la relación entre necesidades del proyecto, compras, proveedores, recepción e inventario.

## Propósito

La compra no debe verse como una tarea aislada. Debe ser una consecuencia inteligente de la cotización, la planeación, el inventario disponible y las necesidades reales de fabricación.

## Alcance propuesto

- Requisiciones por proyecto.
- Sugerencias de compra.
- Comparación básica de proveedores.
- Estado de pedidos.
- Recepción parcial.
- Evidencias de recepción.
- Actualización automática de inventario.

## Resultado esperado

Reducir compras duplicadas, olvidos, errores de material y pérdidas por falta de coordinación entre áreas.

<div class="page-break"></div>

# Fase 27 — Producción y Fabricación Avanzada

## Estado

⏳ Planeada

## Objetivo

Convertir fabricación en una etapa medible, trazable y conectada con el resto del sistema.

## Alcance propuesto

- Órdenes de fabricación más completas.
- Estados internos de producción.
- Tiempos estimados y reales.
- Material asignado.
- Avance por proyecto.
- Alertas de retraso.
- Registro de incidencias.

## Resultado esperado

Que el taller pueda saber qué se está fabricando, qué falta, qué está retrasado y qué información debe alimentar futuros aprendizajes.

<div class="page-break"></div>

# Fase 28 — Reportes y Métricas Ejecutivas

## Estado

⏳ Planeada

## Objetivo

Dar visibilidad ejecutiva al desempeño del taller.

## Métricas iniciales

- Ventas cotizadas.
- Proyectos aprobados.
- Utilidad estimada.
- Utilidad real.
- Desperdicio estimado.
- Desperdicio real.
- Tiempo de fabricación.
- Compras por proveedor.
- Materiales más utilizados.
- Proyectos con mayor rentabilidad.

## Resultado esperado

Que el dueño del taller pueda tomar decisiones con datos y no únicamente con intuición.

<div class="page-break"></div>

# Fase 29 — Inteligencia Operativa Inicial

## Estado

⏳ Planeada

## Objetivo

Introducir las primeras capacidades de inteligencia basadas en datos reales del sistema.

## Alcance propuesto

- Advertencias inteligentes.
- Recomendaciones simples.
- Comparación con proyectos históricos.
- Detección de riesgos en cotización.
- Detección de desviaciones en tiempos o costos.
- Sugerencias de materiales frecuentes.

## Principio

La primera IA de ALUXOR / BR debe ser práctica, explicable y conservadora.

Antes de generar grandes automatizaciones, debe aprender a observar correctamente el negocio.

<div class="page-break"></div>

# Fase 30 — Crecimiento Comercial del Taller

## Estado

⏳ Planeada

## Objetivo

Ayudar al taller a vender más y ser más visible.

## Propósito

ALUXOR / BR no debe limitarse a organizar el negocio internamente. También debe ayudar al taller a crecer hacia afuera.

## Alcance propuesto

- Generación de contenido promocional.
- Ideas de publicaciones para redes sociales.
- Promociones basadas en productos o materiales disponibles.
- Catálogo visual de trabajos.
- Identificación de proyectos vendibles.
- Apoyo para campañas locales.

## Resultado esperado

Que la plataforma ayude al taller no solo a operar mejor, sino también a atraer más oportunidades comerciales.

<div class="page-break"></div>

# Registro de Decisiones de Arquitectura

## ADR-001 — El proyecto como centro del sistema

### Decisión

ALUXOR / BR se organiza alrededor del proyecto y no alrededor de módulos independientes.

### Razón

El taller no opera por módulos aislados. Opera por proyectos que atraviesan ventas, diseño, materiales, compras, inventario, fabricación, instalación y entrega.

### Consecuencia

Toda funcionalidad futura deberá indicar cómo ayuda al proyecto a avanzar, documentarse o aprender.

---

## ADR-002 — Separación entre módulos y motores

### Decisión

La plataforma separa la experiencia visible del usuario de los motores internos de negocio.

### Razón

Los módulos pueden cambiar visualmente, pero las reglas, cálculos, estados y automatizaciones deben mantenerse consistentes.

### Consecuencia

BR Engine, Workflow Engine y Cut Optimizer deben concentrar lógica reutilizable y evitar duplicidad de reglas dentro de componentes de interfaz.

---

## ADR-003 — IA como capa de apoyo, no de reemplazo

### Decisión

La IA en ALUXOR / BR debe asistir, recomendar, advertir y aprender, pero no reemplazar el juicio del usuario.

### Razón

Los talleres dependen de experiencia humana, contexto físico, negociación, criterio técnico y responsabilidad operativa.

### Consecuencia

Toda capacidad de IA deberá ser explicable, revisable y controlada por el usuario.

<div class="page-break"></div>

# Anexos

## Glosario inicial

**Proyecto:** Unidad central del sistema. Representa el trabajo completo solicitado por un cliente, desde el primer contacto hasta el historial posterior.

**Workspace:** Entorno principal donde el usuario trabaja, revisa y administra el proyecto.

**BR Engine:** Motor de reglas de negocio, cálculos, costos y utilidades.

**Workflow Engine:** Motor de estados, transiciones y avance operativo del proyecto.

**Cut Optimizer:** Motor de optimización física de cortes y aprovechamiento de materiales.

**Project Companion:** Capa de acompañamiento contextual del proyecto.

**Inspector Inteligente:** Capa de revisión, diagnóstico y advertencia.

**Historial:** Memoria operativa del sistema y base futura para aprendizaje.

## Regla de mantenimiento del documento

Este documento debe actualizarse cada vez que:

- Se cierre una fase.
- Se tome una decisión arquitectónica importante.
- Se agregue un módulo nuevo.
- Se modifique la filosofía del producto.
- Se detecte deuda técnica relevante.
- Se redefina una prioridad del roadmap.

El Libro Maestro no debe quedar separado de la realidad del producto. Su valor depende de mantenerse vivo, honesto y conectado con el estado real de ALUXOR / BR.

<div class="page-break"></div>

# Relación entre el Libro Maestro y el Roadmap Maestro

ALUXOR / BR mantiene dos documentos estratégicos complementarios.

## Libro Maestro

Describe la identidad del producto, su filosofía, arquitectura, principios, visión de largo plazo y las decisiones que definen su evolución.

Cambia lentamente y preserva la historia del proyecto.

## Roadmap Maestro de Desarrollo

Es el documento operativo utilizado para dirigir el desarrollo del sistema.

Describe las eras, fases, prioridades, backlog, dependencias, criterios de aceptación y estado de ejecución.

Se actualiza continuamente conforme evoluciona el producto.

## Principio

El Libro Maestro responde "por qué" y "hacia dónde" evoluciona ALUXOR / BR.

El Roadmap Maestro responde "qué sigue", "qué estamos construyendo" y "cómo llegaremos a la siguiente era".
<div class="page-break"></div>

# Problema de la Industria

La industria de la fabricación personalizada, especialmente en talleres de carpintería, aluminio y vidrio, enfrenta desde hace décadas una fragmentación crítica de la información. La mayoría de los talleres opera con sistemas improvisados, donde la memoria individual, hojas de cálculo y mensajes dispersos en WhatsApp se convierten en los principales repositorios de conocimiento y operación diaria.

Esta dependencia en la memoria y en herramientas informales genera un entorno propenso a errores. Los datos relevantes para cotizaciones, compras, fabricación y entregas suelen estar repartidos en archivos personales, libretas físicas, conversaciones telefónicas y aplicaciones de mensajería. Cuando un miembro clave del equipo se ausenta o deja el taller, gran parte del conocimiento operativo se pierde, obligando a reconstruir procesos y decisiones desde cero.

El uso de hojas de cálculo, aunque flexible y familiar, introduce riesgos significativos: errores matemáticos, fórmulas mal aplicadas, versiones desactualizadas y falta de control sobre quién modifica qué información. Estos errores pueden traducirse directamente en pérdidas económicas, desperdicio de material, retrasos en la entrega y conflictos con los clientes.

La comunicación fragmentada a través de WhatsApp y otras aplicaciones de mensajería añade un nivel de informalidad que dificulta la trazabilidad. Las decisiones importantes, cambios de última hora y aprobaciones quedan enterradas entre cientos de mensajes, sin un registro estructurado ni una forma sencilla de auditar el proceso. La falta de centralización impide saber con claridad quién autorizó qué, cuándo se tomó una decisión y cuál fue el impacto real sobre el proyecto.

La ausencia de trazabilidad convierte cada proyecto en una aventura aislada. No existe una memoria histórica confiable de los errores cometidos, las soluciones implementadas o los aprendizajes obtenidos. Como resultado, los mismos problemas tienden a repetirse una y otra vez, y el taller depende excesivamente de la experiencia individual en lugar de construir un conocimiento colectivo y reutilizable.

Intentar resolver estos retos con ERPs genéricos ha demostrado ser ineficaz para la mayoría de los talleres pequeños y medianos. Los ERPs tradicionales están diseñados para industrias de gran escala, con flujos rígidos, terminología compleja y módulos poco adaptados a la realidad de la fabricación personalizada. Su implementación suele ser costosa, lenta y termina generando más fricción que soluciones, obligando al taller a adaptar sus procesos al sistema en lugar de que el sistema se adapte al taller.

La consecuencia de esta fragmentación es una operación reactiva, donde la mayor parte del tiempo se invierte en buscar información, corregir errores y resolver emergencias, en vez de agregar valor al cliente y al negocio. Los talleres que no logran superar este problema quedan atrapados en un ciclo de improvisación, baja rentabilidad y crecimiento limitado.

Por todo lo anterior, resulta fundamental construir una plataforma especializada, capaz de centralizar la información, reducir la dependencia en la memoria, prevenir errores matemáticos, garantizar trazabilidad en cada etapa y aprender de cada proyecto para que el conocimiento se convierta en un activo permanente del taller.

<div class="page-break"></div>

# Filosofía del Producto

## Simplicidad para el usuario

El diseño de ALUXOR / BR parte de la premisa de que la complejidad operativa debe estar oculta al usuario. La interfaz y los flujos deben ser intuitivos, claros y adaptados al lenguaje y necesidades reales del taller. Cada acción debe sentirse natural, sin requerir capacitación extensa ni conocimientos técnicos avanzados.

## Complejidad dentro del sistema

La sofisticación técnica y la lógica de negocio deben estar encapsuladas en los motores internos del sistema. El usuario no debe preocuparse por fórmulas, reglas de cálculo o validaciones complejas; el sistema se encarga de garantizar consistencia, precisión y automatización, permitiendo que el taller opere con confianza y enfoque en el trabajo real.

## El proyecto antes que los módulos

ALUXOR / BR se organiza alrededor del proyecto, no de módulos aislados. Todas las funcionalidades existen para acompañar el avance de un proyecto desde el primer contacto hasta el aprendizaje posterior. Esta filosofía asegura que la información fluya de manera natural y que cada módulo aporte valor al ciclo completo, evitando silos de información.

## Capturar una vez, reutilizar siempre

Cada dato debe capturarse una sola vez y ser reutilizado en todo el sistema. Esta regla minimiza el trabajo repetitivo, reduce errores y garantiza que la información esté siempre alineada entre cotización, compras, inventario, fabricación y aprendizaje histórico.

## Aprender de cada proyecto

El sistema está diseñado para registrar, analizar y aprender de cada proyecto realizado. Los errores, aciertos, tiempos y decisiones se convierten en insumos para mejorar procesos futuros, permitiendo que el taller evolucione y profesionalice su operación con el tiempo.

## Nunca perder conocimiento

La memoria del taller debe estar en el sistema, no en las personas. Cada aprendizaje, solución y decisión queda documentada, asegurando que el conocimiento sobreviva a cambios de personal, crecimiento del negocio y nuevos retos. La plataforma se convierte así en el verdadero activo intelectual del taller.

<div class="page-break"></div>

# Workspace

El Workspace de ALUXOR / BR está diseñado como un entorno de trabajo de tres columnas, inspirado en la necesidad de mantener siempre el contexto del proyecto y facilitar la navegación entre etapas, información y acciones clave.

La columna izquierda actúa como la navegación principal, permitiendo al usuario moverse entre proyectos, módulos y flujos operativos sin perder de vista el estado general. Esta columna es responsable de brindar acceso rápido a las secciones críticas y mantener la estructura del sistema visible en todo momento.

La columna central es el espacio de trabajo activo, donde el usuario realiza la mayor parte de las tareas: cotizar, revisar materiales, registrar compras, planificar fabricación, entre otros. Aquí se concentra la información relevante del proyecto y se ejecutan las acciones que hacen avanzar el flujo operativo.

La columna derecha está reservada para el Inspector Inteligente y el Project Companion. Esta columna ofrece asistencia contextual, advertencias, sugerencias y aprendizaje en tiempo real, permitiendo al usuario tomar mejores decisiones y prevenir errores antes de que ocurran.

La filosofía detrás de este diseño es clara: el usuario nunca debe perder el contexto de lo que está haciendo. Cambiar de etapa, revisar información histórica o recibir advertencias debe ocurrir sin salir del flujo de trabajo. El Workspace unificado asegura continuidad, eficiencia y foco, evitando la dispersión que ocurre en sistemas fragmentados o con múltiples ventanas.

<div class="page-break"></div>

# Caso de Estudio — Fase 22

La Fase 22, centrada en el desarrollo e integración del Cut Optimizer, marcó un hito estratégico en la evolución de ALUXOR / BR. Este motor no solo resolvió un problema técnico de optimización de cortes, sino que demostró la importancia de validar físicamente cada cálculo y su impacto directo en la operación del taller.

La validación física fue clave: cada optimización fue contrastada con cortes reales, asegurando que las recomendaciones del sistema fueran viables en el taller y no solo en teoría. Este enfoque garantizó confianza en los resultados y permitió detectar casos límite, errores de interpretación y oportunidades de mejora en la lógica del motor.

La integración del Cut Optimizer con el BR Engine y el resto de la plataforma transformó la optimización de cortes en un proceso conectado con costos, compras, inventario y fabricación. El impacto económico de cada decisión de corte se reflejó automáticamente en la utilidad del proyecto, cerrando el ciclo entre planificación y ejecución.

La preparación para producción fue otro logro relevante. El motor generó información visual (SVG), datos accionables y estructuras listas para ser consumidas por los módulos de fabricación y control de calidad, acelerando la transición entre etapas y reduciendo errores manuales.

Finalmente, la Fase 22 estableció un estándar de calidad y confiabilidad mediante la incorporación de más de 45 pruebas automatizadas, builds estables y una API lista para integración futura. Este enfoque sentó las bases para la escalabilidad, el mantenimiento y la evolución de la plataforma, demostrando que cada motor debe ser robusto, validado y preparado para operar en escenarios reales.

<div class="page-break"></div>

# Riesgos y Deuda Técnica

## Riesgos

| Riesgo                                    | Impacto                                            | Mitigación                                         |
|-------------------------------------------|----------------------------------------------------|----------------------------------------------------|
| Inconsistencia en la experiencia de usuario (UX) | Usuarios pueden confundirse o cometer errores.      | Definir y aplicar guías de diseño unificadas.      |
| Integración incompleta entre módulos      | Información duplicada o pérdida de trazabilidad.    | Revisiones cruzadas y pruebas de integración.       |
| Dependencia excesiva en usuarios clave    | Pérdida de conocimiento si alguien se va.           | Documentar procesos y centralizar información.      |
| Falta de documentación técnica actualizada| Dificulta el mantenimiento y la incorporación de nuevos desarrolladores. | Mantener documentación viva y revisiones periódicas.|
| Rendimiento insuficiente en proyectos grandes | Lenta adopción y frustración del usuario.           | Optimizar consultas y pruebas de carga.             |
| Retos en la preparación para IA           | La plataforma no aprende correctamente.             | Estructurar datos y eventos desde fases tempranas.  |

## Deuda Técnica

| Área                    | Estado           | Prioridad   |
|-------------------------|------------------|-------------|
| Consistencia de UX      | Parcial          | Alta        |
| Integración de módulos  | En progreso      | Alta        |
| Documentación           | Parcial          | Media       |
| Pruebas automatizadas   | Avanzada         | Alta        |
| Rendimiento             | Mejorable        | Media       |
| Preparación para IA     | Inicial          | Alta        |
| Escalabilidad           | Suficiente       | Media       |
| Refactorización de motores | Planificada   | Media       |

<div class="page-break"></div>

# Plantilla Oficial para Nuevas Fases

## Estado

_(Indicar: Planeada, En progreso, Terminada, etc.)_

## Objetivo

_(Definir el objetivo principal de la fase)_

## Problema

_(Describir el problema específico que resuelve la fase)_

## Alcance

_(Listar lo que incluye la fase)_

## Fuera de alcance

_(Listar explícitamente lo que NO incluye la fase)_

## Dependencias

_(Identificar módulos, motores o decisiones previas necesarias)_

## Riesgos

_(Listar riesgos y su posible impacto)_

## Entregables

_(Definir los entregables concretos de la fase)_

## Criterios de aceptación

_(Establecer los criterios para considerar la fase como terminada)_

## Aprendizajes

_(Registrar los aprendizajes y recomendaciones para fases futuras)_

<div class="page-break"></div>

# Métricas de Éxito

Para evaluar el impacto estratégico de ALUXOR / BR, se definen los siguientes KPIs:

- **Tiempo de cotización:** Reducción del tiempo promedio para generar una cotización profesional.
- **Errores matemáticos prevenidos:** Número de errores detectados y corregidos antes de impactar en el proyecto.
- **Desperdicio de material:** Porcentaje de material desperdiciado vs. estimado y real.
- **Rentabilidad por proyecto:** Margen de utilidad real vs. estimado al cierre del proyecto.
- **Entrega a tiempo:** Porcentaje de proyectos entregados en la fecha comprometida.
- **Precisión de inventario:** Diferencia entre inventario físico y digital al cierre de cada proyecto.
- **Flujo de trabajo completado:** Proporción de proyectos que siguen el flujo maestro sin omisiones.
- **Adopción de usuarios:** Número de usuarios activos y frecuencia de uso por módulo.
- **Precisión de recomendaciones de IA:** Tasa de acierto de las recomendaciones automáticas frente a decisiones humanas.

Estas métricas permitirán medir el progreso real del taller y el valor agregado por la plataforma, guiando la evolución del producto hacia resultados tangibles.

<div class="page-break"></div>

# Conclusión Fundadora

ALUXOR / BR no es un software terminado, ni pretende ser una solución estática. Es un sistema operativo en constante evolución, diseñado para acompañar a los talleres de fabricación personalizada en su crecimiento y profesionalización a largo plazo.

La verdadera innovación de ALUXOR / BR está en preservar el conocimiento colectivo, reducir la dependencia en la memoria individual y transformar cada proyecto en una oportunidad de aprendizaje permanente. Cada módulo, motor y funcionalidad existe para ayudar al taller a operar con mayor precisión, orden y rentabilidad, sin perder la esencia artesanal que caracteriza al sector.

El compromiso fundacional es mantener la plataforma viva, adaptativa y alineada a las necesidades reales del usuario. La evolución continua, la integración inteligente y la captura de aprendizajes serán siempre prioridades sobre la simple acumulación de funciones.

ALUXOR / BR aspira a convertirse en la base operativa de miles de talleres, ayudándoles no solo a evitar errores y organizarse mejor, sino a crecer como negocios sostenibles, rentables y preparados para los retos del futuro. La preservación del conocimiento, la trazabilidad y la mejora continua son los pilares sobre los que se construirá el éxito compartido.
