# Principios Arquitectónicos — ALUXOR / BR

## Project First Architecture

ALUXOR se organiza alrededor del proyecto.

El usuario trabaja sobre un proyecto activo, no sobre pantallas o módulos aislados.

## Proyecto como unidad central

El proyecto concentra:

- Cliente.
- Cotización.
- Materiales.
- Compras.
- Inventario.
- Fabricación.
- Instalación.
- Entrega.
- Historial.
- Aprendizaje.

## Módulos como capacidades

Los módulos no son el centro del sistema. Funcionan como capacidades internas que ayudan al proyecto a avanzar.

Módulos vigentes:

- Cotización.
- Producción.
- Compras.
- Recepción.
- Inventario.
- Fabricación.
- Historial.
- Catálogo.
- Project Companion.
- Inspector Inteligente.

## Motores como reglas

Los motores concentran reglas, coordinación y cálculos.

Motores vigentes:

- BR Engine.
- Workflow Engine.
- Cut Optimizer.
- Project Companion.

## BR Design System

BR Design System es la base visual aprobada para ALUXOR.

Principios:

- Claridad.
- Densidad útil.
- Baja carga cognitiva.
- Componentes consistentes.
- Experiencia profesional.
- Contexto visible del proyecto activo.

## Workspace 2.0

Workspace 2.0 debe estar guiado por estaciones.

Debe mantener:

- Proyecto activo visible.
- Progreso operativo claro.
- Acciones disponibles por etapa.
- Resumen compacto.
- Project Companion contextual.

## Historial remoto

Estado actual:

- `history.js` preparado para consumir `VITE_HISTORY_API_URL`.
- Backend remoto de historial aún no implementado.

Regla documental:

No describir el historial remoto como implementado hasta que exista backend remoto funcional.

## Fase 24

Fase 24 aún no ha iniciado.

Solo debe iniciar después del cierre completo de Fase 23.5.

Fase 23.5 tiene tres días:

1. Día 1 — Fundamentos arquitectónicos y visuales.
2. Día 2 — Workspace 2.0.
3. Día 3 — Validación, pulido y cierre.

Día 2 está en progreso. Día 3 está pendiente y es obligatorio antes de iniciar Fase 24.
