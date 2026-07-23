# ALUXOR / BosqueReal

## Brand Book v1.0

### Identidad visual oficial

| Control | Definición |
| --- | --- |
| Versión | 1.0 |
| Estado | Vigente |
| Marca | ALUXOR / BosqueReal |
| Producto | Cotizador Profesional / ERP |
| Autoridad gráfica actual | Recursos PNG oficiales indicados en este documento |

## 1. Introducción

Este Brand Book establece el uso consistente de la identidad visual de ALUXOR / BosqueReal en medios digitales, impresos y operativos. Su propósito es proteger la legibilidad, el reconocimiento y el carácter de la marca sin interferir con los colores funcionales del ERP.

ALUXOR representa la dimensión técnica, precisa e industrial de la marca. BosqueReal comunica oficio, materialidad y cercanía con el taller. **COTIZADOR PROFESIONAL** es el descriptor del producto digital y no sustituye el nombre oficial.

La personalidad de marca es:

- Profesional y confiable.
- Industrial y precisa.
- Premium sin ostentación.
- Cercana al taller y a los materiales reales.
- Tecnológica sin perder el carácter artesanal.

Este documento cubre identidad, color, tipografía, espaciado, tamaños, fondos, composición y aplicaciones. No crea recursos vectoriales, artes finales ni variantes que todavía no existen.

## 2. Identidad principal

- **Nombre oficial:** ALUXOR / BosqueReal.
- **Descriptor:** COTIZADOR PROFESIONAL.
- **Isotipo:** monograma que integra las iniciales y formas constructivas de la marca.

### Significado visual

- **Aluminio:** precisión, estructura, resistencia y fabricación técnica.
- **Vidrio:** transparencia, luz, detalle y arquitectura.
- **Madera:** oficio, calidez y vínculo con BosqueReal.
- **Bordes dorados:** calidad, cuidado y posicionamiento premium.
- **Fondo verde bosque:** estabilidad, confianza, materialidad y carácter institucional.

### Recursos oficiales existentes

| Recurso | Ruta pública | Uso principal |
| --- | --- | --- |
| Logo maestro | `/branding/br-logo-master.png` | Fuente raster oficial y aplicaciones de alta resolución |
| Logo horizontal | `/branding/br-logo-horizontal.png` | Login, sidebar amplio, encabezados, PDF y documentos |
| Logo de aplicación | `/branding/br-logo-app.png` | Isotipo para iconos, avatar, favicon y PWA |

En el repositorio pueden consultarse en [br-logo-master.png](../../public/branding/br-logo-master.png), [br-logo-horizontal.png](../../public/branding/br-logo-horizontal.png) y [br-logo-app.png](../../public/branding/br-logo-app.png).

No existe todavía un SVG maestro oficial. Ningún archivo reconstruido o vectorizado automáticamente debe presentarse como original autorizado.

## 3. Paleta oficial de colores

### Paleta institucional

| Color | HEX | RGB | Uso |
| --- | --- | --- | --- |
| Verde Bosque Profundo | `#18231D` | 24, 35, 29 | Fondo institucional, encabezados, navegación y piezas premium |
| Verde Bosque Medio | `#263A30` | 38, 58, 48 | Superficies secundarias y paneles |
| Dorado Institucional | `#C6A15B` | 198, 161, 91 | Bordes, detalles premium, indicadores y acentos limitados |
| Dorado Claro | `#E0C27A` | 224, 194, 122 | Resaltados sobre fondos oscuros |
| Aluminio Claro | `#D8DDE0` | 216, 221, 224 | Fondos claros, divisores y referencias al aluminio |
| Aluminio Oscuro | `#6F787D` | 111, 120, 125 | Texto secundario, iconos y estados neutrales |
| Madera | `#8A5A35` | 138, 90, 53 | Acentos asociados con carpintería y materiales |
| Marfil | `#F4F1E8` | 244, 241, 232 | Fondos claros institucionales |
| Negro Carbón | `#111512` | 17, 21, 18 | Texto y fondos de alto contraste |
| Blanco | `#FFFFFF` | 255, 255, 255 | Fondos, texto invertido y espacios de claridad |

### Tonos operativos existentes en el ERP

La interfaz ya utiliza `#0B1F18` como fondo profundo y color PWA, `#14241C` en navegación, `#22745F` como verde funcional y `#F0C84E` como acento operativo. Pueden mantenerse en el producto digital. No sustituyen automáticamente la paleta institucional en piezas comerciales o impresas.

### Combinaciones aprobadas

- Blanco, Marfil o Aluminio Claro sobre Verde Bosque Profundo o Negro Carbón.
- Verde Bosque Profundo o Negro Carbón sobre Blanco, Marfil o Aluminio Claro.
- Dorado Claro sobre Verde Bosque Profundo o Negro Carbón para detalles breves.
- Verde Bosque Medio con texto Blanco cuando el contraste medido sea suficiente.
- Madera como detalle secundario junto con Marfil, Blanco o Verde Bosque Profundo.

### Combinaciones prohibidas

- Dorado sobre Marfil o Blanco cuando no alcance contraste suficiente.
- Aluminio Oscuro sobre Verde Bosque Medio para texto pequeño.
- Madera sobre Verde Bosque Medio sin contenedor o separación clara.
- Dorado como fondo dominante de páginas, uniformes o pantallas.
- Colores neón, degradados saturados o combinaciones que compitan con los materiales del isotipo.

El dorado debe ocupar, como referencia, un máximo aproximado del **10 %** de una composición institucional. Puede superarse únicamente en detalles propios del logo original; nunca debe dominar la superficie.

Para texto normal se recomienda una relación de contraste mínima de **4.5:1**; para texto grande, **3:1**. Controles, iconos esenciales y límites visuales deben conservar al menos **3:1** respecto a su entorno. Los colores decorativos nunca reemplazan por sí solos etiquetas, iconos o mensajes de estado.

## 4. Tipografías

No se requieren ni se autorizan fuentes externas para esta versión.

### Interfaz y documentos

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Datos técnicos

```css
font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

### Jerarquía recomendada

| Nivel | Tamaño | Peso | Altura de línea | Espaciado |
| --- | --- | --- | --- | --- |
| Display | 40–48 px | 700 | 1.05–1.15 | `-0.02em` |
| H1 | 32 px | 700 | 1.1–1.2 | `-0.015em` |
| H2 | 24 px | 650–700 | 1.2–1.3 | `-0.01em` |
| H3 | 20 px | 600 | 1.25–1.35 | normal |
| Texto principal | 16 px | 400 | 1.5–1.65 | normal |
| Texto secundario | 14 px | 400 | 1.45–1.6 | normal |
| Etiquetas | 12–13 px | 600 | 1.3–1.45 | `0.02em` |
| Datos técnicos | 13–14 px | 400–600 | 1.4–1.55 | normal |

Las mayúsculas se reservan para etiquetas breves, folios, estados y el descriptor. **COTIZADOR PROFESIONAL** debe escribirse completo, en mayúsculas, con espaciado amplio entre letras cuando forme parte de una composición institucional. No debe reconstruirse con otra tipografía dentro del logo.

No usar más de dos familias tipográficas en una misma pieza. Evitar párrafos largos en mayúsculas, condensaciones artificiales y pesos que reduzcan la legibilidad.

## 5. Sistema de espaciados

La escala base es de 4 px:

| Token conceptual | Medida | Uso |
| --- | --- | --- |
| Micro | 4 px | Ajustes entre icono y etiqueta |
| Compacto | 8 px | Elementos estrechamente relacionados |
| Control pequeño | 12 px | Controles y grupos pequeños |
| Estándar | 16 px | Separación general y padding mínimo de tarjeta |
| Grupo | 24 px | Tarjetas, grupos de campos y títulos |
| Bloque | 32 px | Bloques de contenido |
| Sección | 48 px | Separación entre secciones |
| Institucional | 64 px | Portadas y áreas amplias |

Reglas de aplicación:

- Tarjetas: padding recomendado de 16 a 24 px.
- Título y contenido: 12 a 16 px; entre secciones, 32 a 48 px.
- Logo y texto independiente: mínimo 16 px, salvo que el texto ya forme parte del recurso.
- Documentos impresos: margen interior recomendado de 15 a 20 mm; nunca menos de la zona segura de impresión.
- Área de protección del logo: espacio libre mínimo equivalente al **20 % de la altura del isotipo** en los cuatro lados.
- Ningún texto, borde, fotografía, unión física o dato de contacto debe entrar en el área de protección.

## 6. Tamaños mínimos

| Aplicación | Mínimo | Regla |
| --- | --- | --- |
| Logo completo digital | 220 px de ancho | Debajo de esta medida usar versión simplificada |
| Logo completo impreso | 45 mm de ancho | Confirmar legibilidad del descriptor con prueba física |
| Isotipo digital | 32 × 32 px | Entre 16 y 31 px usar favicon optimizado |
| Isotipo impreso | 12 mm de ancho | Simplificar acabados si el proceso lo exige |

El descriptor **COTIZADOR PROFESIONAL** debe retirarse cuando no sea legible. No se permite texto dentro de iconos pequeños.

### Reglas por medio

- **Favicons:** usar el isotipo optimizado, nunca el logo completo.
- **PWA:** usar isotipo cuadrado con margen seguro; la versión maskable debe tolerar recortes del sistema.
- **Sidebar:** usar logo completo únicamente si conserva al menos 220 px; en espacios compactos usar isotipo y nombre en texto accesible.
- **Login:** preferir logo horizontal completo, centrado y con área de protección.
- **PDF:** usar logo horizontal completo en encabezado o portada, sin competir con total, folio o título.
- **Uniformes:** respetar los mínimos del proceso de bordado y eliminar detalles que no puedan reproducirse limpiamente.
- **Vehículos:** dimensionar según el panel disponible y verificar lectura a distancia antes de producción.

## 7. Fondos permitidos

### Permitidos

- Verde Bosque Profundo.
- Negro Carbón.
- Blanco, Marfil o Aluminio Claro.
- Fotografías oscuras con overlay institucional.
- Madera de contraste bajo mediante un contenedor de protección.

### No permitidos

- Fondos con ruido visible detrás del logo.
- Verdes similares que hagan desaparecer el contorno.
- Degradados saturados, colores neón o fondos dorados completos.
- Fotografías sin capa de protección.
- Superficies que obliguen a deformar el logo para llenar el espacio.

### Overlays aprobados

- Negro Carbón al 55–75 %.
- Verde Bosque al 65–85 %.
- Blanco o Marfil al 85–95 % cuando se requiera una presentación clara.

El overlay debe ser uniforme dentro del área de protección y conservar el contraste de todos los componentes del logo.

## 8. Versiones claras y oscuras

### Versión principal oscura

Usa fondo Verde Bosque Profundo o Negro Carbón, logo completo original, texto claro y detalles dorados. Es la versión preferida para comunicación institucional y superficies premium.

### Versión clara

Usa fondo Blanco o Marfil y texto complementario en Verde Bosque Profundo o Negro Carbón. El recurso oficial debe mantener aluminio, madera y bordes dorados con suficiente contraste; puede colocarse dentro de un contenedor oscuro cuando el PNG lo requiera.

### Versión monocromática futura

Se reserva para bordado, grabado, sellos o impresión de una tinta. Debe producirse profesionalmente. Todavía no existe como recurso oficial y no sustituye los PNG actuales.

### Versión isotipo

Se utiliza en favicon, PWA, avatar y espacios reducidos. No incorpora el nombre ni el descriptor cuando estos resulten ilegibles.

No se afirma ni se presupone la existencia de un SVG oficial.

## 9. Usos incorrectos

Está prohibido:

- Estirar, comprimir, rotar o recortar el logo.
- Cambiar los materiales del isotipo o alterar los colores institucionales.
- Añadir sombras exageradas, contornos o efectos no oficiales.
- Separar o reordenar arbitrariamente sus elementos.
- Colocarlo sobre fondos sin contraste o con ruido.
- Cambiar, traducir o reconstruir el descriptor.
- Sustituir la tipografía integrada sin autorización.
- Usar archivos rasterizados de baja resolución o ampliarlos más allá de su calidad útil.
- Crear una supuesta versión vectorial, monocromática o editable sin aprobación.

## 10. Aplicaciones oficiales

### A. Vehículos

- Logo completo en puertas y laterales; isotipo en cofre o parte trasera.
- Usar fondo verde bosque, blanco o negro.
- Separar datos de contacto del área de protección.
- Evitar uniones, manijas, molduras y curvas críticas.
- Ajustar el tamaño al panel y validar lectura a distancia.
- Reservar el material reflejante para datos secundarios, no para toda la marca.

### B. Uniformes

- Isotipo bordado en pecho izquierdo y logo horizontal en espalda.
- Playeras negras: versión clara o recurso dentro de contenedor apropiado.
- Playeras claras: versión oscura.
- Gorra: solo isotipo.
- Simplificar texturas demasiado finas mediante un arte de bordado profesional futuro.
- Mantener el área de protección en todas las aplicaciones.

### C. Tarjetas de presentación

- Frente institucional con logo; reverso con datos de contacto.
- Formato sugerido: 90 × 50 mm.
- Sangrado: 3 mm. Zona segura: 4 mm.
- Preferir papel mate o acabado soft-touch.
- Usar dorado como detalle; el foil no es obligatorio.

### D. Lonas

- Priorizar lectura a distancia y alto contraste.
- Retirar el descriptor si queda demasiado pequeño.
- Mantener el mensaje comercial separado del logo.
- Evitar exceso de información y respetar márgenes mínimos del 5 %.
- Aplicar overlay institucional sobre fotografías.

### E. Facturas y documentos administrativos

- Logo horizontal discreto en el encabezado.
- Información fiscal alineada, legible y fuera del área de protección.
- Limitar el color para favorecer impresión y fotocopia.
- Usar versión clara o, cuando exista, monocromática aprobada.
- Tablas con verdes y grises suaves; dorado únicamente en detalles.

### F. PDF cliente

- Logo completo en portada o encabezado.
- Jerarquizar cliente, proyecto, vigencia y total.
- No mostrar costos internos, utilidad, margen ni merma.
- Usar verde, marfil y dorado de forma institucional.
- Mantener un pie de página consistente.

### G. PDF interno

- Mostrar el logo institucional e identificar claramente **USO INTERNO**.
- Presentar costos, utilidad, margen y merma con jerarquía operativa.
- Usar colores funcionales para estados y advertencias.
- No usar dorado como sustituto de alertas o información crítica.

### H. Interfaz del ERP

- Login: logo horizontal o completo.
- Espacios compactos: isotipo.
- Sidebar: no mostrar el descriptor si queda ilegible.
- Header: usar marca completa solo cuando exista espacio suficiente.
- Favicons y PWA: isotipo.
- Navegación y superficies institucionales: verdes bosque.
- Selección y detalles premium: dorado limitado.
- Estados funcionales: éxito verde, advertencia ámbar, error rojo e información azul.
- No reemplazar colores de estado por colores decorativos de marca.
- Mantener contraste, foco visible, texto alternativo y legibilidad.

## 11. Sistema de composición

- Preferir alineación a la izquierda para información y documentos.
- Usar retículas consistentes y columnas que respondan al medio.
- Mantener bordes redondeados coherentes: 6, 10 o 16 px en digital.
- Diseñar tarjetas sobrias, con padding suficiente y jerarquía clara.
- Usar sombras discretas; no competir con el volumen propio del isotipo.
- Limitar texturas a áreas institucionales amplias o fondos controlados.
- Separar branding decorativo de datos, estados y acciones operativas.
- Conservar espacios en blanco y evitar llenar cada área disponible.

## 12. Gobernanza

- La versión vigente es **1.0**.
- Todo cambio futuro debe aumentar la versión del Brand Book.
- Cualquier recurso nuevo debe derivarse de los archivos maestros existentes.
- No sobrescribir recursos principales sin conservar una copia versionada y aprobada.
- Los responsables de diseño y producto deben validar contraste, reproducción y contexto antes de publicar.
- Las excepciones deben documentarse y aprobarse; una limitación técnica no autoriza deformar la marca.

### Próxima evolución

- SVG maestro profesional.
- Versión monocromática aprobada.
- Artes finales para impresión, bordado y rotulación.
- Plantillas oficiales editables.
- Brand Book v1.1 o v2.0 según el alcance del cambio.

Estos elementos están pendientes y no forman parte de la versión 1.0.

## 13. Checklist de aprobación

- [ ] Se utiliza el logo oficial correcto.
- [ ] La versión corresponde al medio y al tamaño disponible.
- [ ] El fondo está permitido.
- [ ] El contraste es suficiente.
- [ ] Se respeta el área de protección.
- [ ] Se cumple el tamaño mínimo.
- [ ] La tipografía es correcta.
- [ ] La paleta es correcta.
- [ ] No existen deformaciones, recortes ni efectos añadidos.
- [ ] Todos los datos son legibles.
- [ ] La exportación tiene resolución adecuada.
- [ ] La aplicación es coherente con el medio.
- [ ] Los estados funcionales conservan su significado.
- [ ] El archivo final fue revisado antes de producción o publicación.

---

Brand Book v1.0 es una especificación documental. La producción de originales vectoriales, monocromáticos o editables requiere una fase posterior y aprobación profesional.
