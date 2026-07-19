# BRTuNegocio

## Origen

- Nació como ALUXOR.
- Evolucionó para operar ALUXOR y BosqueReal.
- Su objetivo es convertirse en un ERP especializado para talleres de aluminio, vidrio y carpintería.

## Objetivo inmediato

- Tener una aplicación estable.
- Poder operar el negocio real desde la plataforma.
- Evitar desorganización, pérdida de información y dependencia de procesos manuales.
- Preparar la empresa para crecer.

## Regla de enfoque

- Máximo 15–20% del tiempo para la FLDSMDFR.
- Mínimo 80–85% para estabilidad y funcionalidad real del negocio.

## FLDSMDFR

- Significa `Flint Lockwood Diatonic Super Mutating Dynamic Food Replicator`.
- Es el centro interno de estado, dirección y evolución del negocio.
- Cada empresa registrada en BRTuNegocio deberá tener su propia FLDSMDFR.
- Los datos de una empresa no deben mezclarse con los de otra.
- La FLDSMDFR de ALUXOR / BosqueReal no representa el estado global del sistema BRTuNegocio.
- La separación real por empresa se implementará posteriormente.

Cada sprint debe dejar dos resultados: una mejora real para el negocio y una actualización breve de la FLDSMDFR.

# Separación de FLDSMDFR

Existe una FLDSMDFR para cada empresa y contiene exclusivamente información de su negocio.

Existe también una FLDSMDFR del Sistema, destinada exclusivamente al desarrollo interno de BRTuNegocio.

La información de ambas nunca debe mezclarse.

La FLDSMDFR del Sistema únicamente será visible para el workspace interno de ALUXOR.

**TODO:** La condición temporal utilizada actualmente, `settings.company_name === "ALUXOR / BosqueReal"`, será reemplazada por un indicador permanente del workspace: `is_system_workspace`.

# Modelo de FLDSMDFR Empresarial

La FLDSMDFR empresarial representa oficialmente el estado del negocio mediante estos apartados:

- Estado
- Objetivos
- Roadmap
- Pendientes
- Decisiones
- Historial
- Indicadores
- Próximos pasos
- Origen de información
- Principios

El estado resume la situación actual de la empresa. Los objetivos definen su dirección y el roadmap muestra su evolución propia. Los pendientes reúnen necesidades manuales, detecciones del sistema y recomendaciones de Companion. Las decisiones conservan determinaciones importantes y el historial refleja la evolución de la empresa.

Los indicadores representarán información del negocio y los próximos pasos podrán derivarse del ERP, Companion y los pendientes. Cada elemento deberá identificar su origen como Sistema, Usuario, Companion o ERP. Los principios garantizan que cada empresa tenga una FLDSMDFR independiente y que nunca se mezcle con la FLDSMDFR del Sistema.

En esta fase todos los apartados siguen siendo exclusivamente visuales, sin persistencia ni conexión con módulos del ERP.

# Capa Business State

La FLDSMDFR nunca consultará directamente los módulos del ERP. Toda su información deberá obtenerse mediante Business State.

Business State será la fuente única del estado operativo de cada empresa y la capa de adaptación entre el ERP y la FLDSMDFR. La FLDSMDFR no deberá conocer cómo funcionan internamente Producción, Inventario o Cotizaciones.

Posteriormente Companion utilizará exactamente la misma fuente, sin consultar directamente los módulos.

## Responsabilidad de Business State

Business State no contiene lógica de negocio.

Su única responsabilidad es concentrar y adaptar la información proveniente del ERP para consumidores como la FLDSMDFR y Companion.

Los cálculos, reglas de negocio y decisiones permanecen dentro de sus módulos correspondientes.

Business State nunca debe convertirse en un módulo con lógica de negocio.

# Integración ERP → Business State

Business State comienza a consumir información real del ERP de forma progresiva.

Cada módulo del ERP se conectará únicamente cuando exista una fuente reutilizable. Nunca deberá duplicarse lógica para completar un indicador.

La independencia respecto a la interfaz es obligatoria: Business State no consultará componentes visuales ni dependerá de su implementación.

## Estado actual conocido

- Cotización
- Producción
- Compras
- Recepción
- Inventario
- Fabricación
- Historial
- Catálogo
- Project Flow
- Project Companion
- Inspector Inteligente
- BR Engine
- Workflow Engine
- Cut Optimizer

Algunos módulos pueden estar en distintos niveles de madurez y deben validarse en operación real antes de considerarse terminados.

## Pendientes iniciales

- Consolidar la FLDSMDFR sin sobredesarrollarla
- Revisar y dividir `useQuotes.js`
- Reducir `QuoteSection.jsx`
- Revisar `useProduction.js`
- Revisar `ProductionSection.jsx`
- Validar el flujo real completo del negocio
- Crear Context únicamente cuando haya una necesidad comprobada
- Mejorar documentación progresivamente

## Regla para nuevos pendientes

Las mejoras, ideas y pendientes propios del negocio deberán registrarse en la FLDSMDFR empresarial.

Toda deuda técnica, arquitectura, decisión técnica y pendiente de desarrollo pertenece exclusivamente a la FLDSMDFR · Sistema. Nunca deberá almacenarse en la FLDSMDFR empresarial.
