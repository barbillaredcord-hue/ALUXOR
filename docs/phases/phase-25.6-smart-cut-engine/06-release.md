# 06 — Release
# Fase 25.6 — BR Smart Cut Engine

---

# Objetivo

Este documento define los criterios obligatorios para considerar terminada la implementación de la Fase 25.6.

La fase no se considerará finalizada únicamente porque el código compile.

Deberá cumplir todos los requisitos funcionales, arquitectónicos y de calidad definidos en esta documentación.

---

# Checklist General

Antes de finalizar deberán cumplirse todos los siguientes puntos.

## Arquitectura

✓ La Cotización continúa siendo la fuente única de verdad.

✓ Material Calculator permanece sin romperse.

✓ Material Studio continúa funcionando.

✓ El Smart Cut Engine permanece desacoplado de React.

✓ No existe lógica duplicada.

✓ No existen dependencias innecesarias.

---

## Funcionalidad

✓ El motor valida físicamente las piezas.

✓ El motor respeta kerf.

✓ El motor respeta márgenes.

✓ El motor respeta rotación.

✓ El motor respeta dirección de veta.

✓ El motor reutiliza sobrantes compatibles.

✓ El motor genera nuevas hojas únicamente cuando es necesario.

✓ El motor nunca elimina piezas.

✓ El motor devuelve advertencias claras.

---

## Interfaz

✓ Material Studio muestra la propuesta.

✓ El usuario puede revisar la solución.

✓ El usuario puede comparar resultados.

✓ Se muestran métricas completas.

✓ Se muestran sobrantes.

✓ Se muestran desperdicios.

✓ Se muestran advertencias.

✓ La optimización nunca se aplica automáticamente.

---

## Calidad

✓ No existen errores de TypeScript.

✓ No existen errores de ESLint.

✓ No existen imports muertos.

✓ No existen variables sin utilizar.

✓ No existen TODO relacionados con esta fase.

✓ No existen console.log de depuración.

---

# Compatibilidad

Todas las cotizaciones existentes deberán seguir funcionando.

No deberán romperse proyectos creados antes de esta fase.

Los nuevos campos deberán ser opcionales.

Siempre deberán existir valores predeterminados compatibles.

---

# Rendimiento

El motor deberá mantener tiempos razonables.

Objetivos recomendados:

Hasta 50 piezas:

menos de 100 ms.

Hasta 200 piezas:

menos de 500 ms.

Hasta 500 piezas:

menos de 2 segundos.

Estos objetivos podrán optimizarse en fases futuras.

---

# Validación Manual

Antes del Release deberá verificarse manualmente:

□ Optimización simple.

□ Optimización compleja.

□ Uso de sobrantes.

□ Rotación.

□ Dirección de veta.

□ Márgenes.

□ Kerf.

□ Visualización.

□ Responsive.

□ Comparador de soluciones.

□ Aplicación de resultados.

---

# Validación Automática

Antes del commit final deberán ejecutarse:

npm run test

npm run build

git diff --check

Todos deberán finalizar correctamente.

---

# Git

Antes de realizar el commit:

git status

deberá mostrar únicamente los archivos esperados.

No deberán incluirse archivos temporales.

No deberán incluirse archivos de pruebas locales.

No deberán incluirse archivos generados accidentalmente.

---

# Commit

Cuando toda la fase haya sido validada, crear un único commit descriptivo.

Ejemplo:

feat(material-studio): implement BR Smart Cut Engine Phase 25.6

No realizar múltiples commits pequeños para una misma fase.

---

# Push

No realizar push hasta verificar completamente:

Build.

Pruebas.

Revisión manual.

Código.

Documentación.

---

# Documentación

La documentación deberá actualizarse cuando sea necesario.

Especialmente:

Arquitectura.

Material Studio.

Cut Optimizer.

Roadmap.

Continuidad del proyecto.

---

# Objetivo de Calidad

La calidad tiene prioridad sobre la velocidad.

Nunca deberá sacrificarse estabilidad por implementar una característica antes.

Si una funcionalidad compromete la arquitectura existente, deberá replantearse antes de integrarse.

---

# Resultado Esperado

Al finalizar la Fase 25.6, ALUXOR / BosqueReal deberá disponer de un Smart Cut Engine profesional, físicamente válido, desacoplado, escalable y preparado para evolucionar hacia futuras capacidades como:

- Inventario inteligente de sobrantes.
- Optimización multi-material.
- Optimización CNC.
- Optimización distribuida.
- IA para selección de estrategias.
- Planeación avanzada de producción.

El resultado deberá ser una base sólida para las siguientes fases del ERP, manteniendo la estabilidad, la claridad arquitectónica y la calidad del código en todo momento.

---

# Fin de la Fase 25.6

Una vez cumplidos todos los criterios anteriores, la Fase 25.6 podrá considerarse oficialmente completada y el proyecto quedará preparado para iniciar la siguiente etapa del desarrollo del ecosistema ALUXOR / BosqueReal.