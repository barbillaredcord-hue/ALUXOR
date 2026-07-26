# 03 — BR Smart Cut Engine
# Motor de Optimización

---

# Objetivo

El BR Smart Cut Engine será el núcleo responsable de resolver la distribución física de piezas dentro de hojas y sobrantes disponibles.

Su responsabilidad será encontrar la mejor solución posible respetando completamente las restricciones físicas del material.

El motor nunca deberá producir soluciones imposibles únicamente para mejorar porcentajes de aprovechamiento.

---

# Filosofía

El objetivo no es únicamente reducir desperdicio.

El objetivo real es producir una solución que un operador pueda fabricar exactamente igual dentro del taller.

Si una solución no puede fabricarse físicamente, deberá considerarse inválida.

---

# Flujo General

Entrada

↓

Normalización

↓

Validación

↓

Generación de candidatos

↓

Evaluación

↓

Selección

↓

Resultado

↓

Aplicación (si el usuario confirma)

---

# Entrada

El motor recibirá únicamente información ya validada por la cotización.

Entre ella:

- piezas
- dimensiones
- material
- espesor
- cantidad
- kerf
- márgenes
- veta
- rotación
- prioridad
- hojas disponibles
- sobrantes disponibles
- configuración del usuario

---

# Normalización

Antes de comenzar la optimización deberá:

Convertir todas las unidades.

Expandir cantidades.

Eliminar datos innecesarios.

Asignar identificadores únicos.

Preparar estructuras internas.

La optimización nunca deberá trabajar directamente sobre la estructura original de Quote.

---

# Validación

Antes de generar candidatos deberá comprobar:

Todas las piezas tienen dimensiones válidas.

No existen medidas negativas.

Las hojas poseen tamaño válido.

El kerf es válido.

Los márgenes son válidos.

Las restricciones de veta son coherentes.

Las piezas caben al menos en una hoja.

Si alguna validación falla deberá detener la optimización.

---

# Orden Inicial

Antes de colocar piezas el motor deberá ordenarlas.

El orden recomendado será:

1.
Mayor área.

2.
Mayor lado.

3.
Mayor prioridad.

4.
Piezas sin rotación.

5.
Piezas normales.

Este orden mejora considerablemente la eficiencia del acomodo.

---

# Estrategias

El motor no dependerá de un único algoritmo.

Deberá ejecutar varias estrategias independientes.

Ejemplos:

Shelf

MaxRects

Skyline

Guillotine

First Fit

Best Fit

Bottom Left

Las estrategias podrán ampliarse en futuras versiones.

---

# Generación de Candidatos

Cada estrategia generará una solución completa.

Nunca deberá detenerse tras encontrar la primera solución válida.

El motor deberá comparar varias alternativas.

---

# Restricciones Físcias

Cada pieza deberá respetar:

kerf

márgenes

rotación

veta

zonas bloqueadas

zonas reservadas

espacio libre

límites físicos

Si alguna restricción se viola, la colocación será inválida.

---

# Rotación

Cada pieza podrá definir:

Rotación prohibida.

Rotación permitida.

Rotación obligatoria.

El motor nunca deberá rotar automáticamente una pieza cuando exista una restricción explícita.

---

# Veta

Cuando un material tenga dirección de veta:

El motor deberá respetarla.

No podrá girar piezas si esto altera la orientación requerida.

---

# Kerf

El espesor del corte deberá considerarse entre todas las piezas.

Nunca podrán tocarse directamente.

Toda separación mínima será:

kerf configurado

+

margen correspondiente

---

# Márgenes

Cada hoja podrá definir márgenes no utilizables.

El motor nunca colocará piezas dentro de dichas zonas.

---

# Zonas Bloqueadas

Una hoja podrá contener:

golpes

roturas

humedad

manchas

defectos

Estas zonas serán completamente inutilizables.

---

# Sobrantes

Los sobrantes deberán tratarse exactamente igual que una hoja.

Con:

ancho

alto

identificador

material

espesor

historial

No existirán diferencias dentro del motor.

---

# Selección de Material

Antes de abrir una hoja nueva el motor deberá intentar utilizar:

sobrantes compatibles

↓

hojas existentes

↓

hojas nuevas

Siempre respetando la calidad de la solución.

---

# Evaluación

Cada solución recibirá una puntuación.

La puntuación deberá considerar:

desperdicio

hojas utilizadas

cortes

fragmentación

reutilización

sobrantes útiles

complejidad

tiempo estimado

No deberá depender únicamente del porcentaje de aprovechamiento.

---

# Selección

Una vez evaluadas todas las soluciones el motor seleccionará la mejor.

Nunca seleccionará la primera.

Nunca seleccionará una inválida.

---

# Métricas

Cada resultado deberá incluir:

porcentaje aprovechado

porcentaje desperdiciado

área utilizada

área libre

cantidad de hojas

cantidad de sobrantes usados

cantidad de piezas

cantidad de cortes

sobrantes generados

tiempo de optimización

estrategia ganadora

---

# Advertencias

El motor deberá informar situaciones relevantes.

Ejemplos:

Una pieza no cabe.

Se requirió otra hoja.

La veta impidió rotación.

No existen sobrantes compatibles.

Se reutilizó un sobrante.

Existe desperdicio elevado.

---

# Soluciones Imposibles

Nunca deberán ocultarse errores.

Si una pieza no cabe deberá informarse explícitamente.

Nunca deberá desaparecer.

Nunca deberá escalarse.

Nunca deberá recortarse.

Nunca deberá ignorarse.

---

# Determinismo

Con la misma entrada el resultado deberá repetirse.

Esto permitirá:

QA

Debug

Pruebas automáticas

Auditorías

---

# Rendimiento

El motor deberá mantener tiempos adecuados incluso con proyectos grandes.

Objetivos recomendados:

Hasta 50 piezas:

menos de 100 ms.

Hasta 200 piezas:

menos de 500 ms.

Hasta 500 piezas:

menos de 2 segundos.

Estos valores son objetivos, no límites estrictos.

---

# Extensibilidad

El motor deberá diseñarse para admitir futuras capacidades.

Entre ellas:

optimización CNC

optimización 3D

optimización lineal

múltiples materiales

múltiples máquinas

inventario permanente

optimización distribuida

IA para selección de estrategias

---

# Resultado Final

El Smart Cut Engine devolverá únicamente una propuesta.

Nunca modificará directamente la cotización.

La aplicación será responsable de mostrar la solución al usuario y permitirle decidir si desea aplicarla.

Este principio deberá mantenerse en todas las fases futuras del proyecto.