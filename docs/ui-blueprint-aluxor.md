

# ALUXOR UI Blueprint
## Versión 1.0
### BR Studios

> Plano maestro de la experiencia de usuario de ALUXOR.
>
> Este documento define cómo debe verse, sentirse y comportarse la aplicación independientemente de la implementación técnica.

---

# Propósito

El UI Blueprint establece la dirección de diseño para ALUXOR.

Su objetivo es garantizar una experiencia consistente, clara y escalable conforme evolucionen el BR Design System, el Workflow Engine y el resto del ecosistema BR Studios.

---

# Visión

ALUXOR no debe sentirse como un formulario tradicional.

Debe sentirse como un compañero de trabajo que guía al usuario durante todo el ciclo de un proyecto:

Recepción → Medición → Materiales → Producción → Entrega.

# Arquitectura Centrada en Proyectos

La pantalla principal de ALUXOR representa un proyecto activo.

No representa un módulo.

El proyecto es la unidad central del sistema.

Todas las capacidades del ERP giran alrededor del proyecto activo.

Esto significa que:

- El usuario entra a un proyecto, no a un módulo.
- El Timeline representa la evolución del proyecto.
- Las estaciones muestran el estado operativo del proyecto.
- El Project Companion acompaña al proyecto actual.
- El Resumen siempre pertenece al proyecto activo.

Los módulos continúan existiendo como capacidades internas del sistema:

- Cotización.
- Compras.
- Inventario.
- Producción.
- Fabricación.
- Instalación.
- Historial.
- Documentos.

Sin embargo, para el usuario todos forman parte de un mismo flujo continuo.

El objetivo es que la navegación se sienta natural:

Proyecto
→ Estaciones
→ Acciones
→ Resultados

No:

Módulo
→ Pantalla
→ Pantalla
→ Pantalla

Este principio deberá orientar todas las decisiones futuras de UX, Workflow Engine, sincronización, colaboración y evolución del producto.

---

# Principios

- Una sola fuente de verdad.
- Un solo paso activo.
- Menos scroll.
- Más contexto.
- Menos clics.
- Navegación evidente.
- Responsive desde el diseño.
- Información reorganizada, nunca escondida sin motivo.
- El sistema siempre indica qué sigue.

---

# Layout principal

```text
┌─────────────────────────────────────────────────────────────┐
│ Hero compacto                                               │
├──────────────┬───────────────────────────────┬──────────────┤
│ Timeline     │ Estación de trabajo           │ Companion    │
│              │                               │              │
│              │                               │              │
├──────────────┴───────────────────────────────┴──────────────┤
│ Resumen del proyecto                                        │
└─────────────────────────────────────────────────────────────┘
```

El objetivo es concentrar la atención en una sola tarea sin perder el contexto del proyecto.

---

# Hero

Debe contener únicamente:

- Proyecto.
- Cliente.
- Estado.
- Avance.
- Fecha de entrega.
- Acciones principales.

Debe ser compacto y evitar información duplicada.

---

# Timeline

Representa las estaciones del proyecto:

1. Recepción.
2. Medición.
3. Materiales.
4. Accesorios.
5. Producción.
6. Validación.
7. Cotización.

Estados:

- Pendiente.
- Activo.
- Completo.
- Atención.
- Bloqueado.

---

# Estaciones de trabajo

Cada estación debe tener:

- Objetivo.
- Información principal.
- Validaciones.
- Resumen al cerrarse.
- Acción "Guardar y continuar".

Solo una estación permanece abierta por defecto.

---

# Project Companion

El Companion acompaña al usuario mostrando información contextual.

Nunca reemplaza al usuario.

Funciones:

- Recomendar.
- Advertir.
- Resumir.
- Mostrar el siguiente paso.

---

# Responsive

## Escritorio

- Sidebar.
- Timeline visible.
- Workspace.
- Companion.

## Tablet

- Sidebar comprimible.
- Companion debajo del contenido cuando sea necesario.

## Móvil

- Una columna.
- Una estación activa.
- Timeline colapsable.
- Companion desplegable.
- Botones táctiles mínimos de 44 px.
- Tablas convertidas en tarjetas.

---

# Componentes BR

Toda la interfaz utilizará componentes del BR Design System:

- BRCard.
- BRPanel.
- BRButton.
- BRBadge.
- BRChip.
- BRSection.
- BRTimeline.
- BRProgress.
- BRToolbar.

---

# Relación con el Roadmap

## Fase 23.5

Construcción del BR Design System y UX Foundation.

## Fase 24

Integración visual del Workflow Engine.

## Fase 25

Offline First y sincronización.

## Fase 26+

Colaboración, IA y evolución del ecosistema.

---

# Evolución

Este documento es vivo.

Toda decisión importante de UX debe reflejarse aquí antes de implementarse.

---

> Una buena interfaz no llama la atención.
>
> Hace que el trabajo fluya.
>
> — BR Studios