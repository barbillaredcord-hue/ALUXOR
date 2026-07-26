# 01 — Objetivos de la Fase 25.6
# BR Smart Cut Engine

---

# Propósito

El objetivo de esta fase es evolucionar el Cut Optimizer existente hasta convertirlo en un motor profesional de optimización física para tableros y láminas utilizado por ALUXOR / BosqueReal.

El sistema debe dejar de ser únicamente un optimizador de cortes y convertirse en un motor capaz de representar correctamente el comportamiento real de un taller de carpintería, aluminio y vidrio.

Todas las decisiones del motor deben estar basadas en restricciones físicas reales y no únicamente en cálculos de área.

---

# Visión

El BR Smart Cut Engine deberá ser capaz de responder preguntas como:

- ¿Cuántas hojas nuevas necesito realmente?
- ¿Puedo reutilizar sobrantes antes de comprar otra hoja?
- ¿Qué distribución genera menos desperdicio?
- ¿Cuál opción requiere menos cortes?
- ¿Qué solución conviene más para producción?
- ¿Cuál solución reduce costos?
- ¿Qué piezas no pudieron colocarse?
- ¿Qué sobrantes serán útiles para futuros proyectos?

El motor deberá responder estas preguntas utilizando una validación física real del acomodo.

---

# Objetivos principales

Esta fase tiene seis objetivos principales.

## 1. Validación física

El resultado nunca deberá ser únicamente una estimación matemática.

Cada pieza deberá:

- existir
- conservar sus dimensiones
- tener coordenadas válidas
- encontrarse dentro del material
- respetar todas las restricciones

Una pieza jamás podrá desaparecer durante la optimización.

---

## 2. Minimizar consumo de material

El motor deberá intentar reducir:

- hojas nuevas
- desperdicio
- fragmentación
- costo

sin violar restricciones físicas.

Nunca deberá sacrificar una pieza solamente para mejorar un porcentaje de aprovechamiento.

---

## 3. Reutilización inteligente de sobrantes

Antes de consumir hojas nuevas el motor deberá evaluar los sobrantes disponibles compatibles.

No deberá reutilizar sobrantes únicamente porque existen.

También deberá analizar:

- tamaño
- utilidad futura
- costo
- fragmentación
- cantidad de cortes

El objetivo es tomar decisiones inteligentes, no únicamente consumir sobrantes.

---

## 4. Representación del mundo real

El motor deberá representar correctamente:

- kerf
- márgenes
- veta
- rotación
- zonas dañadas
- zonas reservadas
- áreas utilizables
- sobrantes
- desperdicio

No bastará con calcular áreas.

Todas las restricciones deberán ser geométricamente válidas.

---

## 5. Arquitectura limpia

El Smart Cut Engine deberá integrarse completamente con la arquitectura existente.

No deberá:

- duplicar lógica
- crear motores paralelos
- romper Material Calculator
- romper Quote
- romper Material Studio

La cotización continuará siendo la fuente única de verdad.

El Smart Cut Engine únicamente calculará propuestas físicamente válidas.

---

## 6. Base para futuras fases

Esta fase deberá dejar preparado el proyecto para futuras capacidades como:

- inventario permanente de sobrantes
- optimización entre múltiples hojas
- múltiples almacenes
- distintos tipos de maquinaria
- optimización CNC
- optimización lineal
- múltiples materiales simultáneos

Estas capacidades no se implementarán todavía.

Únicamente se preparará una arquitectura adecuada.

---

# Qué debe resolver esta fase

Al finalizar la implementación el motor deberá poder:

- acomodar todas las piezas posibles
- detectar piezas imposibles
- reutilizar sobrantes
- minimizar hojas nuevas
- calcular desperdicio real
- calcular sobrantes reutilizables
- comparar soluciones
- escoger automáticamente la mejor
- mostrar métricas confiables
- validar físicamente todos los resultados

---

# Qué NO pretende resolver

Esta fase no incluye:

- optimización CNC
- generación de G-Code
- figuras irregulares
- polígonos
- curvas
- corte por láser
- optimización de perfiles lineales
- inventario cloud de sobrantes
- inteligencia artificial generativa
- visión computacional

Todas estas funciones pertenecen a fases posteriores.

---

# Principios de diseño

Durante toda la implementación deberán respetarse los siguientes principios.

## La realidad física tiene prioridad

Nunca deberá mostrarse una solución imposible solamente porque mejora el porcentaje de aprovechamiento.

---

## La integridad tiene prioridad

Todas las piezas deben existir antes y después de optimizar.

No puede desaparecer ninguna pieza.

---

## La explicación tiene prioridad

El sistema deberá explicar por qué tomó una decisión.

Ejemplos:

- Se reutilizó un sobrante.
- Fue necesaria una hoja adicional.
- Una pieza no cabe.
- La veta impide rotación.
- El kerf obliga a abrir otra hoja.

El usuario debe entender el resultado.

---

## La arquitectura tiene prioridad

El Smart Cut Engine debe adaptarse al proyecto.

El proyecto no debe adaptarse al motor.

---

## La seguridad tiene prioridad

La optimización nunca modificará automáticamente la cotización.

Primero generará una propuesta.

La aplicación solamente actualizará la cotización cuando el usuario confirme la solución.

---

# Resultado esperado

Al finalizar la Fase 25.6 ALUXOR deberá contar con un motor de optimización comparable al de software profesional para talleres de fabricación, capaz de producir distribuciones físicamente válidas, reutilizar sobrantes, minimizar costos y servir como base para la evolución futura del ERP.

Este motor deberá convertirse en el núcleo de todas las decisiones relacionadas con materiales dentro del ecosistema ALUXOR / BosqueReal.