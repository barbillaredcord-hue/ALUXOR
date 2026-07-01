

# BR Design System
## Versión 1.0
### BR Studios

> Lenguaje visual, funcional y operativo compartido por los productos desarrollados por BR Studios.

---

# Propósito

El BR Design System define cómo deben verse, sentirse y comportarse las aplicaciones de BR Studios.

No es solo una paleta de colores.
No es solo una colección de componentes.
No es solo una guía visual.

Es la base para construir productos claros, consistentes, profesionales y escalables.

Aplica inicialmente a ALUXOR / BR, pero debe poder extenderse a otros productos del ecosistema BR Studios.

---

# Principio central

Diseñamos herramientas de trabajo.

Cada pantalla debe ayudar al usuario a avanzar, decidir, corregir o entender algo con menos esfuerzo.

Una buena interfaz no llama la atención.
Hace que el trabajo fluya.

---

# Productos contemplados

Este sistema debe poder aplicarse a:

- ALUXOR / BR.
- Legal Contable App.
- B.R Platform.
- BR.autocarmation.
- Futuros productos de BR Studios.

---

# Filosofía visual

Los productos BR Studios deben transmitir:

- Claridad.
- Precisión.
- Confianza.
- Modernidad.
- Operación real.
- Elegancia discreta.
- Sensación de producto profesional.

No buscamos interfaces saturadas.
No buscamos efectos innecesarios.
No buscamos pantallas que parezcan demostraciones visuales sin utilidad.

Buscamos herramientas que se sientan listas para trabajar.

---

# Principios de UX

## 1. Una sola fuente de verdad

Cada dato importante debe tener un origen claro.

No duplicar información.
No mostrar estados contradictorios.
No repetir el mismo dato en diferentes tarjetas si no aporta contexto nuevo.

---

## 2. El sistema guía

El usuario nunca debe preguntarse qué sigue.

Cada flujo debe indicar:

- Estado actual.
- Próxima acción.
- Información faltante.
- Riesgos o bloqueos.
- Resultado esperado.

---

## 3. Menos scroll, más contexto

El espacio vertical es costoso.

Las pantallas deben mostrar la mayor cantidad de contexto útil posible sin saturar.

Preferir:

- Secciones compactas.
- Resúmenes cerrados.
- Una sola estación activa.
- Navegación por pasos.
- Paneles contextuales.

Evitar:

- Formularios enormes abiertos por defecto.
- Tarjetas repetidas.
- Encabezados demasiado altos.
- Espacios muertos.

---

## 4. Escritorio primero, móvil preparado

BR Studios diseña principalmente para trabajo real en escritorio: oficina, taller, mostrador, laptop o monitor externo.

Pero toda aplicación debe ser usable también en móvil.

Esto significa:

- No diseñar únicamente para pantallas grandes.
- No depender de hover para acciones críticas.
- No usar paneles flotantes invasivos en móvil.
- No exigir zoom para operar.
- Reorganizar la información en móvil en lugar de ocultarla sin razón.
- Mantener botones táctiles suficientemente grandes.
- Priorizar una sola acción principal por pantalla en móvil.

---

## 5. Responsive inteligente

Responsive no significa hacer todo más pequeño.

Responsive significa reorganizar.

En escritorio:

- Sidebar.
- Workspace central.
- Companion o panel contextual.
- Tablas compactas.
- Timeline visible.

En tablet:

- Workspace central prioritario.
- Sidebar comprimible.
- Companion debajo o colapsable.
- Formularios en una o dos columnas.

En móvil:

- Una columna.
- Una estación activa.
- Acciones principales fijas o fácilmente accesibles.
- Tablas convertidas en tarjetas.
- Companion como panel colapsable.
- Resumen compacto visible sin invadir.

---

## 6. Todo comunica estado

Cada pantalla debe responder:

- ¿Dónde estoy?
- ¿Qué ya hice?
- ¿Qué falta?
- ¿Qué sigue?
- ¿Hay algún riesgo?

---

## 7. El software acompaña

La aplicación debe sentirse como un compañero de trabajo.

No debe ser un formulario pasivo.

Debe:

- Sugerir.
- Advertir.
- Resumir.
- Guiar.
- Recordar contexto.

---

# Lenguaje visual

## Superficies

Las superficies deben separar niveles de información.

- Fondo general.
- Panel principal.
- Tarjeta elevada.
- Panel contextual.
- Modal o overlay.

La jerarquía visual debe ser clara sin abusar de sombras.

---

## Color

La paleta base de BR Studios debe partir de tonos:

- Beige claro.
- Blanco cálido.
- Negro / grafito metálico.
- Verde operativo.
- Dorado o amarillo herramienta como acento.
- Tonos suaves para advertencia, éxito y error.

Los colores no deben usarse solo por estética.

Deben comunicar función.

---

## Tipografía

La tipografía debe priorizar lectura rápida.

Escalas sugeridas:

- Display.
- Title.
- Heading.
- Body.
- Caption.
- Micro.

En móvil, reducir densidad sin sacrificar legibilidad.

---

## Espaciado

Usar una escala consistente.

- xs
- sm
- md
- lg
- xl
- 2xl

Evitar números mágicos.

El espaciado debe hacer que la interfaz respire, pero no debe provocar scroll innecesario.

---

## Radios

Escala sugerida:

- xs
- sm
- md
- lg
- xl
- pill

Los radios deben sentirse modernos, pero no infantiles.

---

## Sombras

Las sombras deben indicar elevación y jerarquía.

Escala sugerida:

- soft
- medium
- floating
- overlay

Evitar sombras pesadas sin propósito.

---

## Motion

Las animaciones deben ser discretas.

Duraciones sugeridas:

- fast
- normal
- slow

Reglas:

- No distraer.
- No retrasar el trabajo.
- No animar información crítica de forma confusa.
- Respetar usuarios con reducción de movimiento.

---

# Componentes base

Los componentes iniciales del BR Design System serán:

- BRButton.
- BRCard.
- BRPanel.
- BRSection.
- BRBadge.
- BRChip.
- BRInput.
- BRTextarea.
- BRSelect.
- BRToolbar.
- BRTimeline.
- BRProgress.
- BRStat.
- BRModal.
- BRTooltip.

---

# Layouts base

## Workspace

Estructura principal para aplicaciones operativas.

Debe poder adaptarse a:

- Sidebar + contenido.
- Sidebar + contenido + companion.
- Contenido completo sin sidebar.
- Móvil de una columna.

---

## Timeline

Debe representar progreso operativo.

Estados mínimos:

- Pendiente.
- Activo.
- Completo.
- Requiere atención.
- Bloqueado.

---

## Companion

Panel contextual que acompaña al usuario.

No debe invadir el área principal.

En escritorio puede vivir como panel lateral.
En móvil debe ser colapsable o aparecer debajo de la estación activa.

---

## Editor

Área donde el usuario captura, revisa o corrige información.

Debe priorizar foco y reducir distracciones.

---

# Reglas para móvil

Toda pantalla debe validarse pensando en móvil.

Reglas mínimas:

- Botones táctiles de al menos 44px de alto.
- Una sola columna cuando el ancho sea reducido.
- Evitar tablas horizontales largas.
- Convertir filas complejas en tarjetas.
- Mantener visible la acción principal.
- Evitar paneles sticky que tapen contenido.
- Usar resúmenes compactos.
- Reducir encabezados grandes.
- Mantener estados y progreso visibles.

Móvil no es una versión secundaria.

Es una forma distinta de trabajar.

---

# Aplicación inicial en ALUXOR

La Fase 23.5 aplicará este sistema a ALUXOR en el siguiente orden:

1. Hero compacto.
2. Workspace 2.0.
3. Timeline permanente.
4. Cotizador guiado por estaciones.
5. Resúmenes inteligentes.
6. Project Companion contextual.
7. Responsive industrial.
8. Eliminación de duplicidades visuales.

---

# Criterios de aceptación

El Design System v1.0 se considera listo cuando:

- Existe una guía visual documentada.
- Existen tokens base definidos.
- Existen componentes base iniciales.
- ALUXOR puede empezar a migrar pantallas sin improvisar estilos.
- Las reglas contemplan escritorio, tablet y móvil.
- La interfaz reduce scroll y duplicidad.
- El usuario entiende el flujo sin explicación externa.

---

# Evolución

Este documento es vivo.

Cada cambio importante debe:

- Documentarse.
- Justificarse.
- Mantener consistencia.
- Evitar romper patrones existentes sin razón.

---

# Frase guía

> Una buena interfaz no llama la atención.
> Hace que el trabajo fluya.

BR Studios