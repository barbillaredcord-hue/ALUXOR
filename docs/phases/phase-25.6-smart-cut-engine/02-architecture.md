# 02 — Arquitectura
# BR Smart Cut Engine

---

# Objetivo

Antes de implementar cualquier mejora del Smart Cut Engine es obligatorio comprender la arquitectura existente de ALUXOR.

Esta fase NO consiste en reemplazar componentes existentes.

Consiste en extender la arquitectura actual respetando completamente los principios del proyecto.

---

# Principios Arquitectónicos

El Smart Cut Engine deberá integrarse como un motor especializado dentro del ecosistema ALUXOR.

Nunca deberá convertirse en la nueva fuente de verdad.

La fuente única de verdad continuará siendo la Cotización.

---

# Fuente única de verdad

La Cotización continuará almacenando:

- piezas
- materiales
- grupos
- cantidades
- dimensiones
- asignaciones
- costos
- relaciones

El Smart Cut Engine únicamente leerá esta información para generar propuestas de optimización.

Nunca deberá almacenar información propia permanente.

---

# Flujo Canónico

El flujo correcto será siempre:

Quote

↓

Material Calculator

↓

Material Studio

↓

Smart Cut Engine

↓

Resultado

↓

Confirmación del usuario

↓

Actualización de Quote

Nunca deberá existir un flujo inverso.

---

# Responsabilidad de cada módulo

## Quote

Responsable de:

- almacenar información
- persistencia
- autosave
- edición
- historial
- relaciones

No calcula distribuciones físicas.

---

## Material Calculator

Responsable de:

- calcular áreas
- calcular cantidades
- estimaciones
- costos
- desperdicio estimado

No realiza acomodos físicos.

---

## Material Studio

Responsable de:

- mostrar información
- configurar parámetros
- lanzar optimización
- visualizar resultados
- permitir comparación

No implementa algoritmos de optimización.

---

## Smart Cut Engine

Responsable exclusivamente de:

- validar físicamente
- acomodar piezas
- generar candidatos
- comparar soluciones
- escoger la mejor
- devolver resultados

No modifica directamente la cotización.

---

# Arquitectura en Capas

El motor deberá mantenerse dividido en capas independientes.

## Capa 1

Entrada

Normaliza toda la información proveniente de Quote.

---

## Capa 2

Validación

Verifica:

- medidas
- materiales
- kerf
- márgenes
- veta
- rotación
- hojas
- sobrantes

No comienza la optimización mientras existan errores.

---

## Capa 3

Motor de Optimización

Genera múltiples soluciones.

No conoce la interfaz gráfica.

No conoce React.

Debe ser completamente reutilizable.

---

## Capa 4

Evaluación

Compara candidatos.

Calcula puntuaciones.

Selecciona la mejor solución.

---

## Capa 5

Resultados

Devuelve:

- hojas
- posiciones
- sobrantes
- desperdicio
- métricas
- advertencias

No realiza persistencia.

---

# Separación entre UI y Motor

El algoritmo nunca deberá depender de:

React

Componentes

Hooks

Estado visual

Context Providers

Material Studio únicamente consumirá resultados.

Toda la lógica deberá permanecer fuera de la interfaz.

---

# Funciones Puras

Siempre que sea posible, el núcleo deberá construirse mediante funciones puras.

Una función pura:

- no modifica variables externas
- no modifica parámetros
- no escribe archivos
- no utiliza estado global
- siempre produce el mismo resultado para la misma entrada

Esto facilitará:

- pruebas
- mantenimiento
- rendimiento
- reutilización

---

# Determinismo

Cuando se utilice una semilla de optimización, el resultado deberá ser exactamente reproducible.

Misma entrada

+

Misma configuración

+

Misma semilla

=

Mismo resultado

Esto será obligatorio para:

- debugging
- QA
- auditoría
- pruebas

---

# Independencia

El Smart Cut Engine no deberá conocer:

Supabase

Storage

Realtime

Workspace

Usuarios

Producción

Compras

Inventario

Autenticación

Su única responsabilidad será resolver problemas de optimización física.

---

# Contratos

Todas las entradas deberán utilizar contratos claramente definidos.

Ejemplo conceptual:

Piece

Sheet

Region

Constraint

Placement

Solution

Metrics

No deberán utilizarse estructuras ambiguas.

---

# Inmutabilidad

Las entradas nunca deberán modificarse.

Toda transformación generará nuevos objetos.

Nunca:

Modificar piezas originales.

Modificar hojas originales.

Modificar parámetros originales.

---

# Adaptadores

Si fuera necesario modificar contratos existentes deberá utilizarse un adaptador.

Nunca romper compatibilidad con:

Material Calculator

Quote

Material Studio

Cut Optimizer existente

---

# Compatibilidad Legacy

Las cotizaciones antiguas deberán seguir funcionando.

Los nuevos campos deberán ser opcionales.

Ejemplos:

groupId

materialAssignments

grainDirection

allowRotation

priority

Si una cotización antigua no posee alguno de estos campos, el sistema deberá asignar valores predeterminados sin fallar.

---

# Optimización como Servicio

El Smart Cut Engine deberá comportarse como un servicio interno.

Entrada

↓

Procesamiento

↓

Resultado

No deberá depender del ciclo de vida de React.

---

# Errores

Los errores deberán clasificarse.

Errores de entrada

Errores físicos

Errores internos

Errores de configuración

No deberán mezclarse.

---

# Escalabilidad

La arquitectura deberá prepararse para futuras capacidades.

Entre ellas:

- múltiples almacenes
- múltiples materiales
- inventario permanente de sobrantes
- perfiles lineales
- CNC
- múltiples máquinas
- optimización distribuida

Estas capacidades no se implementarán todavía.

Únicamente deberá prepararse una arquitectura adecuada.

---

# Qué NO debe hacerse

No crear un segundo Material Calculator.

No crear un segundo Quote.

No duplicar lógica.

No duplicar estructuras.

No copiar algoritmos completos existentes.

No introducir dependencias pesadas sin justificación.

No escribir lógica de negocio dentro de componentes React.

No mezclar UI con algoritmo.

---

# Objetivo Arquitectónico Final

Al finalizar esta fase el Smart Cut Engine deberá convertirse en un componente desacoplado, reutilizable, comprobable y mantenible.

Su única responsabilidad será resolver el problema de optimización física respetando completamente la arquitectura existente de ALUXOR.

Toda la lógica de optimización deberá permanecer encapsulada dentro del motor, mientras que la interfaz únicamente visualizará resultados y permitirá al usuario decidir cuándo aplicar la solución.