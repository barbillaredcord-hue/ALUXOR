# FASE 25.6
# BR Smart Cut Engine

## Proyecto

ALUXOR / BosqueReal

Repositorio:
ALUXOR

Branch:
main

---

# Objetivo

Esta fase transforma el Cut Optimizer existente en un motor profesional de optimización física de materiales.

No se trata únicamente de acomodar rectángulos.

Debe convertirse en un motor capaz de representar el comportamiento real de un taller de carpintería, aluminio y vidrio.

El objetivo es minimizar desperdicio respetando completamente las restricciones físicas del material.

---

# Importante

NO crear un optimizador paralelo.

NO romper la arquitectura existente.

NO reemplazar Material Calculator.

NO romper BR Material Studio.

La cotización continúa siendo la fuente única de verdad.

El Smart Cut Engine únicamente calcula y propone resultados.

---

# Orden obligatorio

Leer completamente los siguientes documentos antes de implementar.

1.
01-objectives.md

2.
02-architecture.md

3.
03-engine.md

4.
04-ui.md

5.
05-testing.md

6.
06-release.md

No comenzar implementación sin haber entendido todos los documentos.

---

# Objetivo final

El motor nunca debe preferir un porcentaje atractivo sobre la realidad física.

Es mejor informar:

"Falta colocar una pieza"

que devolver

"97% de aprovechamiento"

si alguna pieza fue omitida.

La optimización siempre debe ser físicamente válida.