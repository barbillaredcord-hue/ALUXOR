# 05 — Testing y Validación
# BR Smart Cut Engine

---

# Objetivo

Toda modificación al Smart Cut Engine deberá validarse automáticamente antes de considerarse terminada.

La calidad del motor dependerá de la confiabilidad de sus pruebas.

Cada nueva capacidad deberá acompañarse de pruebas unitarias y de integración.

---

# Filosofía

Nunca asumir que el algoritmo funciona.

Siempre demostrarlo mediante pruebas reproducibles.

Una optimización correcta debe producir exactamente el mismo resultado cuando las condiciones de entrada sean idénticas.

---

# Tipos de pruebas

El Smart Cut Engine deberá contar con varios niveles de validación.

## Pruebas Unitarias

Validan funciones individuales.

Ejemplos:

- cálculo de área
- validación de kerf
- validación de márgenes
- detección de colisiones
- rotación
- cálculo de desperdicio
- generación de sobrantes

Cada función crítica deberá tener pruebas independientes.

---

## Pruebas de Integración

Validan el funcionamiento conjunto de:

Quote

↓

Material Calculator

↓

Material Studio

↓

Smart Cut Engine

↓

Resultado

La integración nunca deberá romper el flujo existente.

---

## Pruebas Visuales

Comprobar que:

las piezas no se sobreponen

las coordenadas son correctas

los sobrantes aparecen correctamente

las hojas representan exactamente la solución

---

## Pruebas de Rendimiento

El motor deberá mantenerse dentro de tiempos razonables.

Objetivos recomendados:

Hasta 50 piezas:

menos de 100 ms

Hasta 200 piezas:

menos de 500 ms

Hasta 500 piezas:

menos de 2 segundos

---

# Casos mínimos obligatorios

Antes de aprobar la fase deberán existir pruebas para:

## Caso 1

Una pieza dentro de una hoja.

Resultado esperado:

100 % válido.

---

## Caso 2

Varias piezas sin rotación.

---

## Caso 3

Piezas con rotación permitida.

---

## Caso 4

Piezas con rotación prohibida.

---

## Caso 5

Material con dirección de veta.

---

## Caso 6

Kerf diferente de cero.

---

## Caso 7

Márgenes personalizados.

---

## Caso 8

Uso de sobrantes.

---

## Caso 9

Sobrantes insuficientes.

---

## Caso 10

Necesidad de abrir una hoja nueva.

---

## Caso 11

Pieza demasiado grande.

Debe producir advertencia.

Nunca desaparecer.

---

## Caso 12

Zona dañada dentro de una hoja.

---

## Caso 13

Zona reservada.

---

## Caso 14

Proyecto con cientos de piezas.

---

## Caso 15

Comparación entre múltiples estrategias.

---

# Validaciones físicas

Cada prueba deberá comprobar:

No existen piezas superpuestas.

Todas las piezas permanecen dentro de la hoja.

Se respetan los márgenes.

Se respeta el kerf.

Se respeta la veta.

Se respetan las restricciones de rotación.

No desaparece ninguna pieza.

---

# Determinismo

Ejecutar la misma optimización varias veces deberá producir exactamente el mismo resultado.

Si el motor utiliza semillas, deberán mantenerse constantes durante las pruebas.

---

# Cobertura

Las pruebas deberán cubrir:

normalización

validación

optimización

evaluación

selección

métricas

resultado

errores

---

# Validación Manual

Además de las pruebas automáticas deberá verificarse manualmente:

Visualización correcta.

Panel de métricas.

Comparador.

Advertencias.

Vista de hojas.

Vista de sobrantes.

Responsive.

---

# Build

Toda implementación deberá completar correctamente:

npm run test

npm run build

Sin errores.

Sin advertencias críticas.

---

# Calidad del Código

Antes de finalizar deberán comprobarse:

Sin errores de TypeScript.

Sin imports muertos.

Sin código duplicado.

Sin variables sin utilizar.

Sin comentarios temporales.

Sin console.log de depuración.

Sin TODO pendientes relacionados con esta fase.

---

# Compatibilidad

Las cotizaciones existentes deberán seguir funcionando.

No deberán romperse proyectos antiguos.

No deberán modificarse estructuras persistentes incompatibles.

---

# Git

Antes de crear el commit final deberá verificarse:

git status

git diff

git diff --check

Todo deberá encontrarse limpio.

---

# Criterios de Aceptación

La fase únicamente podrá considerarse terminada cuando:

✓ Todas las pruebas unitarias pasen.

✓ Todas las pruebas de integración pasen.

✓ El build sea exitoso.

✓ No existan errores de TypeScript.

✓ No existan regresiones funcionales.

✓ La interfaz continúe funcionando.

✓ El Smart Cut Engine genere soluciones físicamente válidas.

✓ La cotización permanezca como fuente única de verdad.

✓ El usuario pueda aplicar o descartar la optimización.

---

# Objetivo Final

El Smart Cut Engine deberá ofrecer resultados confiables y repetibles.

Cada nueva mejora futura deberá mantener este mismo nivel de calidad mediante pruebas automáticas y validaciones manuales, garantizando que la evolución del motor nunca comprometa la estabilidad de ALUXOR / BosqueReal.