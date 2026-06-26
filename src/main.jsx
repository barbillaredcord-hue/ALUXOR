// cSpell:words ALUXOR AnunciaPro anunciapro aluxor Clóset clóset clósets Cotizacion cotizacion Telefono telefono whatsapp promocion jaladera Jaladera jaladeras Jaladeras tornillería Silicón categoria bano economico descripcion triplay Triplay buro buró Buró burós pzas Vidrieria Carpinteria zoclo herrajes melamina merma cotizador metalness
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import {
  Accessibility,
  BadgeDollarSign,
  BarChart3,
  Box,
  Calculator,
  Check,
  ClipboardList,
  Copy,
  DoorOpen,
  Download,
  Eraser,
  FileText,
  Hammer,
  History,
  LayoutDashboard,
  MessageCircle,
  Package,
  RefreshCw,
  Ruler,
  Save,
  Sparkles,
  Store,
  TableProperties,
  Upload,
} from 'lucide-react';
import './styles.css';
import { registerServiceWorker } from './pwa';
import { Pricing } from './lib/br-engine/index.js';

const APP_VERSION = '2026.05.39';
const APP_VERSION_QUERY = '20260539';
const BRAND_NAME = 'ALUXOR/BosqueReal';
const HISTORY_API = '/api/history';

const defaults = {
  giro: 'Carpintería',
  tipoTrabajo: 'Clóset',
  producto: 'Clóset a medida',
  material: 'melamina blanca con cantos reforzados',
  medidas: '2.40 m alto x 1.80 m ancho x 0.60 m fondo',
  acabado: 'moderno, limpio y resistente',
  precioManual: 'Cotización sin compromiso',
  usarCotizacion: true,
  clienteNombre: '',
  clienteTelefono: '',
  ciudad: 'Monterrey',
  whatsapp: '',
  beneficio: 'aprovechar mejor el espacio y mantener todo ordenado',
  incluye: 'diseño, fabricación e instalación',
  entrega: 'Entrega según agenda',
  promocion: '',
  tono: 'profesional',
  objetivo: 'cotizar',
  ancho: 180,
  alto: 240,
  fondo: 60,
  grosorMaterial: 16,
  cantidad: 1,
  measureItems: [
    {
      id: 'med-principal',
      nombre: 'Medida principal',
      ancho: 180,
      alto: 240,
      fondo: 60,
      grosorMaterial: 16,
      cantidad: 1,
      nota: '',
    },
  ],
  materialCotizacion: 'Melamina',
  precioM2: 2800,
  costoMaterialM2: 1700,
  merma: 8,
  margenMaterial: 35,
  herrajes: 'Bisagras, correderas y jaladeras',
  costoHerrajes: 450,
  precioHerrajes: 750,
  manoObra: 1200,
  extras: 0,
  descuento: 0,
  anticipo: 50,
  vigencia: 7,
  condiciones: 'Anticipo para iniciar. Saldo contra entrega o instalación. Precio sujeto a verificación de medidas finales.',
  folioManual: '',
  estadoCotizacion: 'Pendiente',
  formaPago: 'Anticipo y saldo contra entrega',
  notasCliente: '',
  notasInternas: '',
  materialItems: [
    {
      id: 'mat-principal',
      nombre: 'Melamina',
      unidad: 'm²',
      usarArea: true,
      calculo: 'area',
      cantidad: 0,
      grosor: 16,
      costoUnitario: 1700,
      precioUnitario: 2800,
      merma: 8,
      margen: 35,
      nota: 'Material principal',
    },
  ],
  accessoryItems: [
    {
      id: 'acc-principal',
      nombre: 'Bisagras, correderas y jaladeras',
      cantidad: 1,
      costoUnitario: 450,
      precioUnitario: 750,
      nota: 'Herrajes principales',
    },
  ],
  planItems: [
    {
      id: 'pieza-principal',
      nombre: 'Vista principal',
      ancho: 180,
      alto: 240,
      fondo: 60,
      cantidad: 1,
      nota: 'Medida general del proyecto',
    },
  ],
};

const quoteProfiles = {
  Carpintería: {
    title: 'Configuración carpintería',
    description: 'Muebles, clósets, cocinas, burós y escritorios. Lo principal se calcula por m² y el canto por metro lineal.',
    fields: {
      giro: 'Carpintería',
      tipoTrabajo: 'Clóset',
      materialCotizacion: 'Melamina',
      material: 'melamina, MDF, triplay o madera según proyecto',
      margenMaterial: 35,
      merma: 8,
      manoObra: 1200,
      herrajes: 'Bisagras, correderas y jaladeras',
    },
    measureItems: [
      { id: 'med-carp-principal', nombre: 'Frente / módulo', ancho: 180, alto: 240, fondo: 60, grosorMaterial: 16, cantidad: 1, nota: 'Área visible del mueble' },
    ],
    materialItems: [
      { id: 'mat-carp-tablero', nombre: 'Melamina / MDF', unidad: 'm²', usarArea: true, calculo: 'area', cantidad: 0, grosor: 16, costoUnitario: 1700, precioUnitario: 2800, merma: 8, margen: 35, nota: 'Tablero principal por m²' },
      { id: 'mat-carp-canto', nombre: 'Canto PVC', unidad: 'metro lineal', usarArea: true, calculo: 'lineal', cantidad: 0, grosor: 1, costoUnitario: 18, precioUnitario: 35, merma: 5, margen: 35, nota: 'Perímetro de las piezas' },
      { id: 'mat-carp-respaldo', nombre: 'Respaldo / fondo delgado', unidad: 'm²', usarArea: true, calculo: 'area', cantidad: 0, grosor: 3, costoUnitario: 260, precioUnitario: 480, merma: 8, margen: 35, nota: 'Solo si aplica' },
    ],
    accessoryItems: [
      { id: 'acc-carp-bisagras', nombre: 'Bisagras cierre suave', cantidad: 4, costoUnitario: 45, precioUnitario: 85, nota: 'Puertas' },
      { id: 'acc-carp-correderas', nombre: 'Correderas telescópicas', cantidad: 2, costoUnitario: 140, precioUnitario: 240, nota: 'Cajones' },
      { id: 'acc-carp-jaladeras', nombre: 'Jaladeras', cantidad: 4, costoUnitario: 35, precioUnitario: 75, nota: 'Frentes' },
    ],
  },
  Vidriería: {
    title: 'Configuración vidrio y aluminio',
    description: 'Ventanas, canceles, fijos, puertas y barandales. Vidrio por m², perfiles por metro lineal y accesorios por pieza/juego.',
    fields: {
      giro: 'Vidriería',
      tipoTrabajo: 'Cancel',
      materialCotizacion: 'Vidrio templado y aluminio',
      material: 'vidrio templado, aluminio, selladores y accesorios',
      margenMaterial: 32,
      merma: 6,
      manoObra: 900,
      herrajes: 'Carretillas, jaladeras, felpas y tornillería',
    },
    measureItems: [
      { id: 'med-vidrio-principal', nombre: 'Claro principal', ancho: 140, alto: 190, fondo: 0, grosorMaterial: 6, cantidad: 1, nota: 'Medida del vano' },
    ],
    materialItems: [
      { id: 'mat-vidrio-templado', nombre: 'Vidrio templado', unidad: 'm²', usarArea: true, calculo: 'area', cantidad: 0, grosor: 6, costoUnitario: 950, precioUnitario: 1550, merma: 6, margen: 32, nota: 'Vidrio por m²' },
      { id: 'mat-aluminio-perfil', nombre: 'Perfil de aluminio', unidad: 'metro lineal', usarArea: true, calculo: 'lineal', cantidad: 0, grosor: 0, costoUnitario: 85, precioUnitario: 150, merma: 8, margen: 32, nota: 'Marco, riel o guía por perímetro' },
      { id: 'mat-silicon', nombre: 'Silicón / sellador', unidad: 'pieza', usarArea: false, calculo: 'manual', cantidad: 1, grosor: 0, costoUnitario: 95, precioUnitario: 180, merma: 0, margen: 32, nota: 'Consumible' },
    ],
    accessoryItems: [
      { id: 'acc-vidrio-carretillas', nombre: 'Carretillas / rodamientos', cantidad: 2, costoUnitario: 90, precioUnitario: 170, nota: 'Cancel o ventana corrediza' },
      { id: 'acc-vidrio-jaladera', nombre: 'Jaladera', cantidad: 1, costoUnitario: 160, precioUnitario: 300, nota: 'Según modelo' },
      { id: 'acc-vidrio-felpas', nombre: 'Felpas y tornillería', cantidad: 1, costoUnitario: 120, precioUnitario: 220, nota: 'Kit de instalación' },
    ],
  },
};

const catalogDefaults = [
  {
    id: 'pref-ventana-2',
    categoria: 'Vidriería',
    tipoTrabajo: 'Ventana',
    nombre: 'Ventana serie 2',
    materialCotizacion: 'Aluminio y vidrio',
    herrajes: 'Chapa, felpas y tornillería',
    unidad: 'm²',
    costo: 780,
    precio: 1250,
    costoHerrajes: 220,
    precioHerrajes: 380,
    merma: 6,
    manoObra: 750,
    extras: 250,
  },
  {
    id: 'pref-cancel-bano',
    categoria: 'Vidriería',
    tipoTrabajo: 'Cancel',
    nombre: 'Cancel de baño corredizo',
    materialCotizacion: 'Aluminio y vidrio templado',
    herrajes: 'Carretillas, jaladeras y guía',
    unidad: 'm²',
    costo: 950,
    precio: 1550,
    costoHerrajes: 420,
    precioHerrajes: 700,
    merma: 8,
    manoObra: 900,
    extras: 350,
  },
  {
    id: 'carp-melamina',
    categoria: 'Carpintería',
    tipoTrabajo: 'Mueble',
    nombre: 'Melamina instalada',
    materialCotizacion: 'Melamina',
    herrajes: 'Bisagras, correderas y jaladeras',
    unidad: 'm²',
    costo: 1700,
    precio: 2800,
    costoHerrajes: 450,
    precioHerrajes: 750,
    merma: 8,
    manoObra: 1200,
    extras: 0,
  },
];

const ejemplos = [
  {
    name: 'Clóset',
    icon: DoorOpen,
    data: defaults,
  },
  {
    name: 'Cocina',
    icon: Hammer,
    data: {
      ...defaults,
      tipoTrabajo: 'Cocina',
      producto: 'Cocina integral',
      material: 'melamina texturizada con cubierta de granito',
      medidas: 'según proyecto',
      acabado: 'elegante y fácil de limpiar',
      beneficio: 'dar mejor uso al espacio y renovar la imagen de la cocina',
      incluye: 'diseño, fabricación, herrajes e instalación',
      promocion: 'Pregunta por opciones de pago por etapas',
      ancho: 300,
      alto: 90,
      fondo: 60,
      precioM2: 4200,
      materialCotizacion: 'Melamina y cubierta',
      costoMaterialM2: 2600,
      merma: 10,
      margenMaterial: 40,
      herrajes: 'Bisagras cierre suave, jaladeras y correderas',
      costoHerrajes: 1200,
      precioHerrajes: 1900,
      manoObra: 2500,
    },
  },
  {
    name: 'Cancel',
    icon: Store,
    data: {
      ...defaults,
      giro: 'Vidriería',
      tipoTrabajo: 'Cancel',
      producto: 'Cancel de baño corredizo',
      material: 'aluminio natural y vidrio templado de 6 mm',
      medidas: 'a la medida',
      acabado: 'seguro, moderno y fácil de mantener',
      beneficio: 'evitar salpicaduras y mejorar la vista del baño',
      incluye: 'medición, fabricación e instalación',
      entrega: 'Instalación con cita previa',
      ancho: 140,
      alto: 190,
      fondo: 0,
      precioM2: 1250,
      materialCotizacion: 'Aluminio y vidrio templado',
      costoMaterialM2: 780,
      merma: 6,
      margenMaterial: 32,
      herrajes: 'Carretillas, jaladeras y guía',
      costoHerrajes: 420,
      precioHerrajes: 700,
      manoObra: 900,
    },
  },
];

const tonos = {
  profesional: {
    title: 'Profesional',
    opener: 'Trabajo fabricado a medida con excelente presentación y detalles bien cuidados.',
    promise: 'Ideal para clientes que buscan calidad, funcionalidad y una buena terminación.',
    cta: 'Agenda tu cotización y recibe atención personalizada.',
  },
  promocional: {
    title: 'Promocional',
    opener: 'Renueva tu espacio con una opción práctica, durable y con gran vista.',
    promise: 'Una solución pensada para mejorar tu casa o negocio sin complicarte.',
    cta: 'Pregunta hoy y aprovecha disponibilidad para nuevos pedidos.',
  },
  economico: {
    title: 'Accesible',
    opener: 'Tenemos opciones prácticas para mejorar tu espacio sin gastar de más.',
    promise: 'Buscamos una solución útil, presentable y ajustada a tu presupuesto.',
    cta: 'Mándanos tus medidas y te damos una cotización clara.',
  },
  directo: {
    title: 'Directo',
    opener: 'Fabricamos e instalamos según tus medidas y necesidades.',
    promise: 'Te ayudamos a resolver tu proyecto con materiales adecuados y trato claro.',
    cta: 'Mándanos mensaje para revisar tu idea y darte precio.',
  },
};

const objetivos = {
  cotizar: 'Cotiza por WhatsApp',
  vender: 'Disponible para pedido',
  promocionar: 'Promoción por tiempo limitado',
  mostrar: 'Trabajo a medida',
};

const tiposPorGiro = {
  Carpintería: ['Clóset', 'Cocina', 'Mueble', 'Buró', 'Puerta', 'Repisa', 'Escritorio', 'Centro de TV', 'Otro'],
  Vidriería: ['Ventana', 'Cancel', 'Puerta de vidrio', 'Barandal', 'Espejo', 'Mampara', 'Vitrina', 'Cubierta de cristal', 'Otro'],
};

const defaultTypeDetails = [
  { id: 'tipo-ventana-serie-2', giro: 'Vidriería', tipo: 'Ventana serie 2', descripcion: 'Ventana corrediza sencilla con aluminio y vidrio claro.' },
  { id: 'tipo-ventana-serie-3', giro: 'Vidriería', tipo: 'Ventana serie 3', descripcion: 'Ventana de mayor cuerpo para claros más grandes.' },
  { id: 'tipo-cancel-bano', giro: 'Vidriería', tipo: 'Cancel de baño', descripcion: 'Cancel corredizo o abatible con vidrio templado.' },
  { id: 'tipo-cristal-fijo', giro: 'Vidriería', tipo: 'Cristal fijo', descripcion: 'Panel fijo de vidrio para baño, oficina o división.' },
  { id: 'tipo-closet', giro: 'Carpintería', tipo: 'Clóset', descripcion: 'Clóset a medida con repisas, puertas y divisiones.' },
  { id: 'tipo-escritorio', giro: 'Carpintería', tipo: 'Escritorio', descripcion: 'Escritorio con cubierta, patas, cajones o módulo lateral.' },
];

const opcionesMaterial = [
  'Melamina',
  'MDF',
  'Triplay',
  'Madera sólida',
  'Aluminio',
  'Aluminio y vidrio',
  'Vidrio claro',
  'Vidrio templado',
  'Espejo',
  'Cubierta de cristal',
  'Otro',
];

const opcionesHerrajes = [
  'Bisagras, correderas y jaladeras',
  'Bisagras cierre suave',
  'Correderas telescópicas',
  'Jaladeras',
  'Chapa o cerradura',
  'Rieles y guías',
  'Carretillas, jaladeras y guía',
  'Felpas, silicon y tornillería',
  'Kit para cancel',
  'Sin herrajes',
  'Otro',
];

const formasPlano = [
  'Pieza vertical',
  'Cubierta / repisa',
  'Lateral',
  'Puerta',
  'Cajón',
  'Vidrio',
  'Marco / riel',
  'Pata',
  'Otro',
];

const plantillasPlano = [
  { id: 'closet', label: 'Clóset', giro: 'Carpintería', tipoTrabajo: 'Clóset' },
  { id: 'escritorio', label: 'Escritorio', giro: 'Carpintería', tipoTrabajo: 'Escritorio' },
  { id: 'mueble', label: 'Mueble', giro: 'Carpintería', tipoTrabajo: 'Mueble' },
  { id: 'buro', label: 'Buró', giro: 'Carpintería', tipoTrabajo: 'Buró' },
  { id: 'ventana', label: 'Ventana', giro: 'Vidriería', tipoTrabajo: 'Ventana' },
  { id: 'cancel', label: 'Cancel', giro: 'Vidriería', tipoTrabajo: 'Cancel' },
];

function clean(value, fallback = '') {
  return String(value || fallback).trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveNumber(value) {
  return Math.max(0, numberValue(value));
}

function percentValue(value) {
  return Math.min(100, Math.max(0, numberValue(value)));
}

function normalizeMeasureItem(item, index = 0, data = {}) {
  return {
    id: item?.id || `med-${Date.now()}-${index}`,
    nombre: clean(item?.nombre, index === 0 ? 'Medida principal' : `Medida ${index + 1}`),
    ancho: positiveNumber(item?.ancho ?? data.ancho),
    alto: positiveNumber(item?.alto ?? data.alto),
    fondo: positiveNumber(item?.fondo ?? data.fondo),
    grosorMaterial: positiveNumber(item?.grosorMaterial ?? data.grosorMaterial),
    cantidad: Math.max(1, positiveNumber(item?.cantidad ?? data.cantidad) || 1),
    nota: clean(item?.nota),
  };
}

function measurementItemsFromForm(data) {
  const items = Array.isArray(data.measureItems) ? data.measureItems : [];
  const source = items.length ? items : [{
    id: 'med-principal',
    nombre: 'Medida principal',
    ancho: data.ancho,
    alto: data.alto,
    fondo: data.fondo,
    grosorMaterial: data.grosorMaterial,
    cantidad: data.cantidad,
    nota: '',
  }];

  return source
    .map((item, index) => normalizeMeasureItem(item, index, data))
    .filter((item) => item.ancho > 0 || item.alto > 0 || item.cantidad > 0);
}

function measureArea(item) {
  return (positiveNumber(item.ancho) / 100) * (positiveNumber(item.alto) / 100);
}

function measureLinear(item) {
  return ((positiveNumber(item.ancho) + positiveNumber(item.alto)) * 2 / 100) * item.cantidad;
}

function quoteAreaTotal(data) {
  return measurementItemsFromForm(data).reduce((sum, item) => sum + measureArea(item) * item.cantidad, 0);
}

function quoteLinearTotal(data) {
  return measurementItemsFromForm(data).reduce((sum, item) => sum + measureLinear(item), 0);
}

function formatDimensions(data) {
  const rows = measurementItemsFromForm(data);
  const parts = rows.map((item) => [
    item.nombre,
    item.ancho > 0 ? `${item.ancho} cm ancho` : null,
    item.alto > 0 ? `${item.alto} cm alto` : null,
    item.fondo > 0 ? `${item.fondo} cm fondo` : null,
    item.grosorMaterial > 0 ? `${item.grosorMaterial} mm grosor` : null,
    item.cantidad > 1 ? `${item.cantidad} pzas` : null,
  ].filter(Boolean).join(' · '));

  return parts.length ? parts.join(' | ') : 'medidas por confirmar';
}

function uniqueByValue(items) {
  return [...new Set(items.map((item) => clean(item)).filter(Boolean))];
}

function typeOptionsFor(giro, typeDetails = []) {
  return uniqueByValue([
    ...(tiposPorGiro[giro] || tiposPorGiro.Carpintería),
    ...typeDetails.filter((item) => item.giro === giro).map((item) => item.tipo),
  ]);
}

function loadTypeDetails() {
  try {
    const stored = localStorage.getItem('anunciapro.typeDetails');
    const items = stored ? JSON.parse(stored) : defaultTypeDetails;
    return Array.isArray(items) ? items : defaultTypeDetails;
  } catch {
    return defaultTypeDetails;
  }
}

function normalizeMaterialItem(item, index = 0, data = {}) {
  const unidad = clean(item?.unidad, 'm²');
  const fallbackCalculo = item?.usarArea
    ? (unidad === 'metro lineal' ? 'lineal' : 'area')
    : 'manual';
  const calculo = clean(item?.calculo || item?.tipoCompra, fallbackCalculo);
  return {
    id: item?.id || `mat-${Date.now()}-${index}`,
    nombre: clean(item?.nombre, clean(data.materialCotizacion, 'Material')),
    unidad,
    usarArea: Boolean(item?.usarArea),
    calculo,
    categoria: clean(item?.categoria, clean(data.giro, 'Material')),
    tipoCompra: clean(item?.tipoCompra, calculo),
    baseCalculo: clean(item?.baseCalculo, calculo === 'lineal' ? 'lineal' : calculo === 'manual' || calculo === 'pieza' ? 'manual_qty' : 'medidas_area'),
    cantidad: item?.cantidad === '' ? '' : positiveNumber(item?.cantidad),
    ancho: item?.ancho === '' ? '' : positiveNumber(item?.ancho),
    alto: item?.alto === '' ? '' : positiveNumber(item?.alto),
    largo: item?.largo === '' ? '' : positiveNumber(item?.largo),
    grosor: item?.grosor === '' ? '' : positiveNumber(item?.grosor ?? data.grosorMaterial),
    costoUnitario: item?.costoUnitario === '' ? '' : positiveNumber(item?.costoUnitario ?? data.costoMaterialM2),
    precioUnitario: item?.precioUnitario === '' ? '' : positiveNumber(item?.precioUnitario ?? data.precioM2),
    merma: item?.merma === '' ? '' : percentValue(item?.merma ?? data.merma),
    margen: item?.margen === '' ? '' : positiveNumber(item?.margen ?? data.margenMaterial),
    precioManual: Boolean(item?.precioManual),
    nota: clean(item?.nota),
  };
}

function materialItemsFromForm(data, areaTotal = 0) {
  const items = Array.isArray(data.materialItems) ? data.materialItems : [];
  const source = items.length ? items : [{
    id: 'mat-principal',
    nombre: data.materialCotizacion,
    unidad: 'm²',
    usarArea: true,
    calculo: 'area',
    cantidad: areaTotal,
    grosor: data.grosorMaterial,
    costoUnitario: data.costoMaterialM2,
    precioUnitario: data.precioM2,
    merma: data.merma,
    margen: data.margenMaterial,
    nota: 'Material principal',
  }];

  return source
    .map((item, index) => normalizeMaterialItem(item, index, data))
    .filter((item) => item.nombre || numberValue(item.precioUnitario) > 0);
}

function normalizeAccessoryItem(item, index = 0, data = {}) {
  return {
    id: item?.id || `acc-${Date.now()}-${index}`,
    nombre: clean(item?.nombre, clean(data.herrajes, 'Accesorio')),
    tipoCompra: clean(item?.tipoCompra, 'pieza'),
    cantidad: item?.cantidad === '' ? '' : Math.max(1, positiveNumber(item?.cantidad) || 1),
    costoUnitario: item?.costoUnitario === '' ? '' : positiveNumber(item?.costoUnitario ?? data.costoHerrajes),
    precioUnitario: item?.precioUnitario === '' ? '' : positiveNumber(item?.precioUnitario ?? data.precioHerrajes),
    merma: item?.merma === '' ? '' : percentValue(item?.merma ?? 0),
    margen: item?.margen === '' ? '' : positiveNumber(item?.margen ?? data.margenMaterial),
    precioManual: Boolean(item?.precioManual),
    nota: clean(item?.nota),
  };
}

function accessoryItemsFromForm(data) {
  const items = Array.isArray(data.accessoryItems) ? data.accessoryItems : [];
  const source = items.length ? items : [{
    id: 'acc-principal',
    nombre: data.herrajes,
    cantidad: Math.max(1, numberValue(data.cantidad) || 1),
    costoUnitario: data.costoHerrajes,
    precioUnitario: data.precioHerrajes,
    nota: 'Herrajes principales',
  }];

  return source
    .map((item, index) => normalizeAccessoryItem(item, index, data))
    .filter((item) => item.nombre && item.nombre !== 'Sin herrajes');
}

function materialItemQuantity(item, quoteBasis = {}) {
  const baseCalculo = clean(item.baseCalculo, item.usarArea ? 'medidas_area' : 'manual_qty');
  const cantidad = Math.max(1, positiveNumber(item.cantidad) || 1);
  const itemArea = (positiveNumber(item.ancho) / 100) * (positiveNumber(item.alto) / 100) * cantidad;
  const itemLineal = (positiveNumber(item.largo) / 100) * cantidad;
  if (baseCalculo === 'medidas_area') return positiveNumber(quoteBasis.areaTotal);
  if (baseCalculo === 'manual_area') return itemArea;
  if (baseCalculo === 'lineal') return itemLineal > 0 ? itemLineal : positiveNumber(quoteBasis.linearTotal);
  return positiveNumber(item.cantidad);
}

function materialCalcLabel(item) {
  const calculo = clean(item.calculo || item.tipoCompra, item.usarArea ? 'area' : 'manual');
  if (calculo === 'area') return 'm²';
  if (calculo === 'hoja') return 'hoja / placa';
  if (calculo === 'lineal') return 'metro lineal';
  if (calculo === 'pieza') return 'pieza';
  return 'cantidad manual';
}

function priceRule(costoUnitario, merma, margen) {
  const costoBase = positiveNumber(costoUnitario);
  const costoConMerma = costoBase * (1 + percentValue(merma) / 100);
  const precioCliente = costoConMerma * (1 + positiveNumber(margen) / 100);
  return { costoBase, costoConMerma, precioCliente };
}

function normalizePlanItem(item, index = 0) {
  return {
    id: item?.id || `plano-${Date.now()}-${index}`,
    nombre: clean(item?.nombre, `Pieza ${index + 1}`),
    forma: clean(item?.forma, 'Pieza vertical'),
    ancho: numberValue(item?.ancho),
    alto: numberValue(item?.alto),
    fondo: numberValue(item?.fondo),
    cantidad: Math.max(1, numberValue(item?.cantidad) || 1),
    nota: clean(item?.nota),
    posX: item?.posX === '' || item?.posX === undefined || item?.posX === null ? '' : numberValue(item.posX),
    posY: item?.posY === '' || item?.posY === undefined || item?.posY === null ? '' : numberValue(item.posY),
    posZ: item?.posZ === '' || item?.posZ === undefined || item?.posZ === null ? '' : numberValue(item.posZ),
  };
}

function planItemsFromForm(data) {
  const items = Array.isArray(data.planItems) ? data.planItems : [];
  const normalized = items.map(normalizePlanItem).filter((item) => item.ancho > 0 && item.alto > 0);
  if (normalized.length > 0) return normalized;

  return [normalizePlanItem({
    id: 'pieza-principal',
    nombre: data.tipoTrabajo || 'Vista principal',
    forma: 'Pieza vertical',
    ancho: data.ancho,
    alto: data.alto,
    fondo: data.fondo,
    cantidad: data.cantidad,
    nota: 'Medida general del proyecto',
  })];
}

function planPart(id, nombre, forma, ancho, alto, fondo, posX, posY, posZ, nota = '') {
  return {
    id,
    nombre,
    forma,
    ancho: Math.max(1, Math.round(ancho)),
    alto: Math.max(1, Math.round(alto)),
    fondo: Math.max(1, Math.round(fondo)),
    cantidad: 1,
    nota,
    posX: Math.round(posX),
    posY: Math.round(posY),
    posZ: Math.round(posZ),
  };
}

function planTemplateData(templateId, data) {
  const ancho = Math.max(60, numberValue(data.ancho) || 120);
  const alto = Math.max(45, numberValue(data.alto) || 90);
  const fondo = Math.max(8, numberValue(data.fondo) || 45);
  const thick = Math.max(3, Math.round(Math.min(ancho, alto, fondo) * 0.04));
  const halfW = ancho / 2;
  const halfD = fondo / 2;
  const items = [];

  if (templateId === 'escritorio') {
    const topY = alto - thick / 2;
    items.push(
      planPart('desk-top', 'Cubierta', 'Cubierta / repisa', ancho, thick, fondo, 0, topY, 0, 'Mesa superior'),
      planPart('desk-left-leg-front', 'Pata izq. frente', 'Pata', thick * 1.5, alto - thick, thick * 1.5, -halfW + thick, (alto - thick) / 2, -halfD + thick, 'Soporte'),
      planPart('desk-right-leg-front', 'Pata der. frente', 'Pata', thick * 1.5, alto - thick, thick * 1.5, halfW - thick, (alto - thick) / 2, -halfD + thick, 'Soporte'),
      planPart('desk-left-leg-back', 'Pata izq. fondo', 'Pata', thick * 1.5, alto - thick, thick * 1.5, -halfW + thick, (alto - thick) / 2, halfD - thick, 'Soporte'),
      planPart('desk-right-leg-back', 'Pata der. fondo', 'Pata', thick * 1.5, alto - thick, thick * 1.5, halfW - thick, (alto - thick) / 2, halfD - thick, 'Soporte'),
      planPart('desk-modulo', 'Cajonera lateral', 'Cajón', Math.max(30, ancho * 0.28), alto * 0.72, fondo * 0.9, halfW - Math.max(18, ancho * 0.14), alto * 0.36, 0, 'Módulo editable'),
    );
  } else if (templateId === 'mueble') {
    items.push(
      planPart('cab-left', 'Lateral izquierdo', 'Lateral', thick, alto, fondo, -halfW + thick / 2, alto / 2, 0, 'Costado'),
      planPart('cab-right', 'Lateral derecho', 'Lateral', thick, alto, fondo, halfW - thick / 2, alto / 2, 0, 'Costado'),
      planPart('cab-top', 'Tapa superior', 'Cubierta / repisa', ancho, thick, fondo, 0, alto - thick / 2, 0, 'Tapa'),
      planPart('cab-bottom', 'Base', 'Cubierta / repisa', ancho, thick, fondo, 0, thick / 2, 0, 'Base'),
      planPart('cab-shelf', 'Repisa central', 'Cubierta / repisa', ancho - thick * 2, thick, fondo * 0.92, 0, alto * 0.52, 0, 'Repisa'),
      planPart('cab-door-left', 'Puerta izquierda', 'Puerta', ancho / 2 - thick, alto - thick * 2, thick, -ancho / 4, alto / 2, -halfD - thick, 'Frente'),
      planPart('cab-door-right', 'Puerta derecha', 'Puerta', ancho / 2 - thick, alto - thick * 2, thick, ancho / 4, alto / 2, -halfD - thick, 'Frente'),
    );
  } else if (templateId === 'buro') {
    items.push(
      planPart('night-top', 'Cubierta', 'Cubierta / repisa', ancho, thick, fondo, 0, alto - thick / 2, 0, 'Tapa'),
      planPart('night-left', 'Lateral izquierdo', 'Lateral', thick, alto, fondo, -halfW + thick / 2, alto / 2, 0, 'Costado'),
      planPart('night-right', 'Lateral derecho', 'Lateral', thick, alto, fondo, halfW - thick / 2, alto / 2, 0, 'Costado'),
      planPart('night-base', 'Base', 'Cubierta / repisa', ancho, thick, fondo, 0, thick / 2, 0, 'Base'),
      planPart('night-drawer-1', 'Cajón superior', 'Cajón', ancho - thick * 3, alto * 0.22, thick, 0, alto * 0.68, -halfD - thick, 'Frente de cajón'),
      planPart('night-drawer-2', 'Cajón inferior', 'Cajón', ancho - thick * 3, alto * 0.32, thick, 0, alto * 0.34, -halfD - thick, 'Frente de cajón'),
    );
  } else if (templateId === 'ventana') {
    const frame = Math.max(4, thick);
    items.push(
      planPart('win-left', 'Marco izquierdo', 'Marco / riel', frame, alto, frame, -halfW + frame / 2, alto / 2, 0, 'Perfil'),
      planPart('win-right', 'Marco derecho', 'Marco / riel', frame, alto, frame, halfW - frame / 2, alto / 2, 0, 'Perfil'),
      planPart('win-top', 'Marco superior', 'Marco / riel', ancho, frame, frame, 0, alto - frame / 2, 0, 'Perfil'),
      planPart('win-bottom', 'Marco inferior', 'Marco / riel', ancho, frame, frame, 0, frame / 2, 0, 'Perfil'),
      planPart('win-glass-left', 'Vidrio izquierdo', 'Vidrio', ancho / 2 - frame * 1.5, alto - frame * 2, 2, -ancho / 4, alto / 2, 0, 'Hoja de vidrio'),
      planPart('win-glass-right', 'Vidrio derecho', 'Vidrio', ancho / 2 - frame * 1.5, alto - frame * 2, 2, ancho / 4, alto / 2, 2, 'Hoja corrediza'),
    );
  } else if (templateId === 'cancel') {
    const rail = Math.max(4, thick);
    items.push(
      planPart('cancel-top-rail', 'Riel superior', 'Marco / riel', ancho, rail, rail, 0, alto - rail / 2, 0, 'Riel'),
      planPart('cancel-bottom-rail', 'Riel inferior', 'Marco / riel', ancho, rail, rail, 0, rail / 2, 0, 'Riel'),
      planPart('cancel-glass-fixed', 'Cristal fijo', 'Vidrio', ancho / 2, alto - rail * 2, 2, -ancho / 4, alto / 2, 0, 'Fijo'),
      planPart('cancel-glass-door', 'Cristal corredizo', 'Vidrio', ancho / 2, alto - rail * 2, 2, ancho / 4, alto / 2, 6, 'Corredizo'),
      planPart('cancel-handle', 'Jaladera', 'Marco / riel', 3, Math.max(28, alto * 0.18), 4, ancho * 0.18, alto * 0.52, -4, 'Herraje'),
    );
  } else {
    items.push(
      planPart('closet-left', 'Lateral izquierdo', 'Lateral', thick, alto, fondo, -halfW + thick / 2, alto / 2, 0, 'Costado'),
      planPart('closet-right', 'Lateral derecho', 'Lateral', thick, alto, fondo, halfW - thick / 2, alto / 2, 0, 'Costado'),
      planPart('closet-top', 'Tapa superior', 'Cubierta / repisa', ancho, thick, fondo, 0, alto - thick / 2, 0, 'Tapa'),
      planPart('closet-bottom', 'Base', 'Cubierta / repisa', ancho, thick, fondo, 0, thick / 2, 0, 'Base'),
      planPart('closet-divider', 'División central', 'Lateral', thick, alto - thick * 2, fondo, 0, alto / 2, 0, 'División'),
      planPart('closet-shelf-left', 'Repisa izquierda', 'Cubierta / repisa', ancho / 2 - thick, thick, fondo * 0.92, -ancho / 4, alto * 0.62, 0, 'Repisa'),
      planPart('closet-shelf-right', 'Repisa derecha', 'Cubierta / repisa', ancho / 2 - thick, thick, fondo * 0.92, ancho / 4, alto * 0.42, 0, 'Repisa'),
      planPart('closet-door-left', 'Puerta izquierda', 'Puerta', ancho / 2 - thick, alto - thick * 2, thick, -ancho / 4, alto / 2, -halfD - thick, 'Frente'),
      planPart('closet-door-right', 'Puerta derecha', 'Puerta', ancho / 2 - thick, alto - thick * 2, thick, ancho / 4, alto / 2, -halfD - thick, 'Frente'),
    );
  }

  return items.map(normalizePlanItem);
}

function planSvg(data) {
  const items = planItemsFromForm(data);
  const width = 900;
  const height = 520;
  const margin = 70;
  const gap = 18;
  const totalWidth = items.reduce((sum, item) => sum + item.ancho, 0) + gap * Math.max(0, items.length - 1);
  const maxHeight = Math.max(...items.map((item) => item.alto), 1);
  const scale = Math.min((width - margin * 2) / Math.max(totalWidth, 1), (height - margin * 2 - 48) / maxHeight);
  const baseY = height - margin - 52;
  let cursorX = margin;

  const pieces = items.map((item) => {
    const rectWidth = Math.max(42, item.ancho * scale);
    const rectHeight = Math.max(42, item.alto * scale);
    const x = cursorX;
    const y = baseY - rectHeight;
    cursorX += rectWidth + gap;

    return `
      <g>
        <rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" rx="8" fill="#fffdf8" stroke="#33443b" stroke-width="3" />
        <rect x="${x + 10}" y="${y + 10}" width="${Math.max(20, rectWidth - 20)}" height="${Math.max(20, rectHeight - 20)}" rx="5" fill="none" stroke="#bdd8ce" stroke-width="2" />
        <text x="${x + rectWidth / 2}" y="${y + 28}" text-anchor="middle" font-size="15" font-weight="800" fill="#17201b">${escapeHtml(item.nombre)}</text>
        <text x="${x + rectWidth / 2}" y="${y + rectHeight / 2 + 5}" text-anchor="middle" font-size="16" font-weight="900" fill="#22745f">${item.ancho} x ${item.alto} cm</text>
        <text x="${x + rectWidth / 2}" y="${y + rectHeight - 18}" text-anchor="middle" font-size="13" font-weight="700" fill="#526159">Fondo ${item.fondo || 0} cm · Cant. ${item.cantidad}</text>
        <line x1="${x}" y1="${baseY + 14}" x2="${x + rectWidth}" y2="${baseY + 14}" stroke="#22745f" stroke-width="2" />
        <text x="${x + rectWidth / 2}" y="${baseY + 36}" text-anchor="middle" font-size="13" font-weight="800" fill="#173d34">${item.ancho} cm</text>
      </g>
    `;
  }).join('');

  const notes = items
    .filter((item) => item.nota)
    .map((item) => `${escapeHtml(item.nombre)}: ${escapeHtml(item.nota)}`)
    .join(' · ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Plano de cotización">
    <rect width="${width}" height="${height}" fill="#edf5f1" />
    <path d="M0 0H${width}V${height}H0Z" fill="url(#grid)" />
    <defs>
      <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M24 0H0V24" fill="none" stroke="#d8e7df" stroke-width="1" />
      </pattern>
    </defs>
    <text x="${margin}" y="38" font-size="20" font-weight="900" fill="#17201b">${escapeHtml(data.producto || 'Plano del proyecto')}</text>
    <text x="${margin}" y="62" font-size="14" font-weight="700" fill="#526159">${escapeHtml(formatDimensions(data))}</text>
    ${pieces}
    ${notes ? `<text x="${margin}" y="${height - 20}" font-size="13" font-weight="700" fill="#526159">${notes.slice(0, 170)}</text>` : ''}
  </svg>`;
}

function planSvg3d(data) {
  const items = planItemsFromForm(data);
  const width = 900;
  const height = 560;
  const margin = 70;
  const gap = 34;
  const totalWidth = items.reduce((sum, item) => sum + Math.max(item.ancho, 1), 0) + gap * Math.max(0, items.length - 1);
  const maxHeight = Math.max(...items.map((item) => item.alto), 1);
  const maxDepth = Math.max(...items.map((item) => item.fondo || 20), 20);
  const scale = Math.min(
    (width - margin * 2) / Math.max(totalWidth + maxDepth * 0.9, 1),
    (height - margin * 2 - 70) / Math.max(maxHeight + maxDepth * 0.45, 1),
  );
  const baseY = height - margin - 58;
  let cursorX = margin + 16;

  const pieces = items.map((item, index) => {
    const pieceWidth = Math.max(58, item.ancho * scale);
    const pieceHeight = Math.max(58, item.alto * scale);
    const depth = Math.max(18, (item.fondo || 20) * scale * 0.72);
    const depthX = depth * 0.72;
    const depthY = depth * 0.42;
    const x = cursorX;
    const y = baseY - pieceHeight;
    cursorX += pieceWidth + gap;
    const hue = data.giro === 'Vidriería' ? ['#d9f1f4', '#a9dbe0', '#effbfc'] : ['#f4dfbe', '#c99b5f', '#fff3da'];
    const edge = data.giro === 'Vidriería' ? '#2b7580' : '#5f4630';

    return `
      <g>
        <polygon points="${x},${y} ${x + depthX},${y - depthY} ${x + pieceWidth + depthX},${y - depthY} ${x + pieceWidth},${y}" fill="${hue[2]}" stroke="${edge}" stroke-width="2" />
        <polygon points="${x + pieceWidth},${y} ${x + pieceWidth + depthX},${y - depthY} ${x + pieceWidth + depthX},${y + pieceHeight - depthY} ${x + pieceWidth},${y + pieceHeight}" fill="${hue[1]}" stroke="${edge}" stroke-width="2" />
        <rect x="${x}" y="${y}" width="${pieceWidth}" height="${pieceHeight}" rx="8" fill="${hue[0]}" stroke="${edge}" stroke-width="3" />
        <rect x="${x + 12}" y="${y + 12}" width="${Math.max(24, pieceWidth - 24)}" height="${Math.max(24, pieceHeight - 24)}" rx="5" fill="none" stroke="rgba(23,32,27,.25)" stroke-width="2" />
        <line x1="${x}" y1="${y + pieceHeight}" x2="${x + depthX}" y2="${y + pieceHeight - depthY}" stroke="${edge}" stroke-width="2" />
        <line x1="${x + depthX}" y1="${y + pieceHeight - depthY}" x2="${x + pieceWidth + depthX}" y2="${y + pieceHeight - depthY}" stroke="${edge}" stroke-width="2" opacity=".55" />
        <text x="${x + pieceWidth / 2}" y="${y + 30}" text-anchor="middle" font-size="15" font-weight="900" fill="#17201b">${escapeHtml(item.nombre)}</text>
        <text x="${x + pieceWidth / 2}" y="${y + pieceHeight / 2 + 5}" text-anchor="middle" font-size="17" font-weight="950" fill="#173d34">${item.ancho} x ${item.alto}</text>
        <text x="${x + pieceWidth / 2}" y="${y + pieceHeight - 18}" text-anchor="middle" font-size="13" font-weight="800" fill="#526159">Fondo ${item.fondo || 0} cm · Cant. ${item.cantidad}</text>
        <circle cx="${x + 18}" cy="${y + pieceHeight + 25}" r="6" fill="${index % 2 ? '#22745f' : '#e3b64b'}" />
        <text x="${x + 32}" y="${y + pieceHeight + 30}" font-size="12" font-weight="850" fill="#526159">${escapeHtml(item.nota || 'Pieza editable')}</text>
      </g>
    `;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Plano editable en 3D">
    <rect width="${width}" height="${height}" fill="#edf5f1" />
    <path d="M0 0H${width}V${height}H0Z" fill="url(#grid3d)" />
    <defs>
      <pattern id="grid3d" width="28" height="28" patternUnits="userSpaceOnUse">
        <path d="M28 0H0V28" fill="none" stroke="#d8e7df" stroke-width="1" />
      </pattern>
    </defs>
    <text x="${margin}" y="38" font-size="20" font-weight="900" fill="#17201b">${escapeHtml(data.producto || 'Plano 3D del proyecto')}</text>
    <text x="${margin}" y="64" font-size="14" font-weight="800" fill="#526159">${escapeHtml(formatDimensions(data))} · Vista con profundidad</text>
    ${pieces}
  </svg>`;
}

function money(value) {
  const numeric = Number(value) || 0;
  const sign = numeric < 0 ? '-' : '';
  return `${sign}${new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Math.abs(Math.round(numeric)))}`;
}

function decimal(value, digits = 2) {
  return (Number(value) || 0).toFixed(digits);
}

function normalizeHash(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '');
}

function hashtags(data) {
  const base = data.giro === 'Vidriería'
    ? ['#Vidrieria', '#Cristal', '#VidrioTemplado', '#Canceles', '#AluminioYVidrio']
    : ['#Carpinteria', '#MueblesAMedida', '#Carpintero', '#DiseñoDeInteriores', '#Muebles'];
  const city = normalizeHash(data.ciudad);
  const product = normalizeHash(data.producto);
  const type = normalizeHash(data.tipoTrabajo);
  return [...base, city ? `#${city}` : null, type ? `#${type}` : null, product ? `#${product}` : null].filter(Boolean).join(' ');
}

function calculateQuote(data) {
  const measureRows = measurementItemsFromForm(data).map((item) => {
    const area = measureArea(item);
    const areaTotal = area * item.cantidad;
    const linearTotal = measureLinear(item);
    return {
      ...item,
      area,
      areaTotal,
      linearTotal,
    };
  });
  const primaryMeasure = measureRows[0] || normalizeMeasureItem({}, 0, data);
  const ancho = primaryMeasure.ancho;
  const alto = primaryMeasure.alto;
  const fondo = primaryMeasure.fondo;
  const grosorMaterial = primaryMeasure.grosorMaterial;
  const cantidad = measureRows.reduce((sum, item) => sum + item.cantidad, 0) || Math.max(1, positiveNumber(data.cantidad) || 1);
  const merma = percentValue(data.merma);
  const margenMaterial = positiveNumber(data.margenMaterial);
  const manoObra = positiveNumber(data.manoObra);
  const extras = positiveNumber(data.extras);
  const descuento = percentValue(data.descuento);
  const anticipo = percentValue(data.anticipo);
  const area = measureRows.reduce((sum, item) => sum + item.area, 0);
  const areaTotal = measureRows.reduce((sum, item) => sum + item.areaTotal, 0);
  const linearTotal = measureRows.reduce((sum, item) => sum + item.linearTotal, 0);
  const quoteBasis = { areaTotal, linearTotal };

  const materialRows = materialItemsFromForm(data, areaTotal).map((item) => {
    const rowQuantity = materialItemQuantity(item, quoteBasis);
    const itemAreaTotal = (positiveNumber(item.ancho) / 100) * (positiveNumber(item.alto) / 100) * Math.max(1, positiveNumber(item.cantidad) || 1);
    const itemLinearTotal = (positiveNumber(item.largo) / 100) * Math.max(1, positiveNumber(item.cantidad) || 1);
    const rowMerma = percentValue(item.merma);
    const rowMargin = item.margen === '' ? margenMaterial : positiveNumber(item.margen);
    const tipoCompra = clean(item.tipoCompra || item.calculo, 'manual');
    const areaHoja = (positiveNumber(item.ancho) / 100) * (positiveNumber(item.alto) / 100);
    const largoUnidad = positiveNumber(item.largo) / 100;
    const areaNecesaria = ['hoja', 'area'].includes(tipoCompra) ? rowQuantity : 0;
    const largoNecesario = tipoCompra === 'lineal' ? rowQuantity : 0;
    const cantidadNecesaria = ['pieza', 'manual'].includes(tipoCompra) ? Math.max(0, rowQuantity) : 0;
    const factorMerma = 1 + rowMerma / 100;
    const areaConMerma = areaNecesaria * factorMerma;
    const largoConMerma = largoNecesario * factorMerma;
    const cantidadConMerma = cantidadNecesaria * factorMerma;
    const hojasNecesarias = tipoCompra === 'hoja' && areaHoja > 0 ? Math.ceil(areaConMerma / areaHoja) : 0;
    const metrosNecesarios = tipoCompra === 'lineal' ? largoConMerma : 0;
    const piezasNecesarias = ['pieza', 'manual'].includes(tipoCompra) ? Math.ceil(cantidadConMerma) : 0;
    const costoUnitario = positiveNumber(item.costoUnitario);
    const costoMetroCuadrado = tipoCompra === 'hoja' && areaHoja > 0 ? costoUnitario / areaHoja : costoUnitario;
    const costoMetroLineal = tipoCompra === 'lineal' ? costoUnitario : 0;
    let costTotal = rowQuantity * costoUnitario * factorMerma;
    if (tipoCompra === 'hoja') costTotal = hojasNecesarias * costoUnitario;
    if (tipoCompra === 'lineal') costTotal = metrosNecesarios * costoUnitario;
    if (['pieza', 'manual'].includes(tipoCompra)) costTotal = piezasNecesarias * costoUnitario;
    const baseCost = tipoCompra === 'hoja' ? areaNecesaria * costoMetroCuadrado : rowQuantity * costoUnitario;
    const wasteCost = Math.max(0, costTotal - baseCost);
    const suggestedSaleTotal = Pricing.aplicarMargenSobreCosto(costTotal, rowMargin);
    const suggestedUnit = rowQuantity > 0 ? suggestedSaleTotal / rowQuantity : 0;
    const saleTotal = item.precioManual ? rowQuantity * positiveNumber(item.precioUnitario) : suggestedSaleTotal;
    const unitPrice = rowQuantity > 0 ? saleTotal / rowQuantity : 0;
    const marginAmount = Pricing.calcularUtilidad(saleTotal, costTotal);
    const marginPercent = Pricing.calcularUtilidadSobreCosto(marginAmount, costTotal);
    const marginPercentOverSale = Pricing.calcularUtilidadSobreVenta(marginAmount, saleTotal);
    return {
      ...item,
      tipoCompra,
      rowQuantity,
      rowMargin,
      calcLabel: materialCalcLabel(item),
      areaTotal: itemAreaTotal || (['area', 'hoja'].includes(item.calculo) ? rowQuantity : 0),
      largoTotal: itemLinearTotal || (item.calculo === 'lineal' ? rowQuantity : 0),
      areaHoja,
      areaNecesaria,
      areaConMerma,
      hojasNecesarias,
      largoNecesario,
      largoConMerma,
      metrosNecesarios,
      cantidadNecesaria,
      cantidadConMerma,
      piezasNecesarias,
      costoMetroCuadrado,
      costoMetroLineal,
      baseCost,
      wasteCost,
      costTotal,
      costoConMerma: rowQuantity > 0 ? costTotal / rowQuantity : 0,
      precioCliente: unitPrice,
      saleTotal,
      suggestedUnit,
      suggestedSaleTotal,
      marginAmount,
      marginPercent,
      marginPercentOverSale,
      calculationSteps: [
        tipoCompra === 'hoja' ? `Área hoja: ${decimal(areaHoja)} m².` : null,
        tipoCompra === 'hoja' ? `Costo m² real: ${money(costoMetroCuadrado)}.` : null,
        `Base usada: ${decimal(rowQuantity)} ${tipoCompra === 'lineal' ? 'm lineales' : ['hoja', 'area'].includes(tipoCompra) ? 'm²' : 'pza(s)'}.`,
        tipoCompra === 'hoja' ? `Área con merma: ${decimal(areaConMerma)} m².` : null,
        tipoCompra === 'hoja' ? `Hojas completas: ${hojasNecesarias}.` : null,
        tipoCompra === 'lineal' ? `Metro lineal con merma: ${decimal(largoConMerma)} m.` : null,
        ['pieza', 'manual'].includes(tipoCompra) ? `Piezas con merma: ${piezasNecesarias}.` : null,
        `Costo interno real: ${money(costTotal)}.`,
        `Precio cliente: ${money(saleTotal)}.`,
        `Utilidad: ${money(marginAmount)}.`,
      ].filter(Boolean),
    };
  });

  const accessoryRows = accessoryItemsFromForm(data).map((item) => {
    const rowQuantity = Math.max(1, positiveNumber(item.cantidad) || 1);
    const rowMerma = percentValue(item.merma);
    const rowMargin = item.margen === '' ? margenMaterial : positiveNumber(item.margen);
    const unitCost = positiveNumber(item.costoUnitario);
    const baseCost = rowQuantity * unitCost;
    const costTotal = baseCost * (1 + rowMerma / 100);
    const suggestedSaleTotal = Pricing.aplicarMargenSobreCosto(costTotal, rowMargin);
    const suggestedUnit = rowQuantity > 0 ? suggestedSaleTotal / rowQuantity : 0;
    const saleTotal = item.precioManual ? rowQuantity * positiveNumber(item.precioUnitario) : suggestedSaleTotal;
    const unitPrice = rowQuantity > 0 ? saleTotal / rowQuantity : 0;
    const marginAmount = Pricing.calcularUtilidad(saleTotal, costTotal);
    const marginPercent = Pricing.calcularUtilidadSobreCosto(marginAmount, costTotal);
    const marginPercentOverSale = Pricing.calcularUtilidadSobreVenta(marginAmount, saleTotal);
    return {
      ...item,
      rowQuantity,
      tipoCompra: clean(item.tipoCompra, 'pieza'),
      rowMerma,
      rowMargin,
      areaTotal: rowQuantity,
      baseCost,
      wasteCost: costTotal - baseCost,
      costTotal,
      costoConMerma: rowQuantity > 0 ? costTotal / rowQuantity : 0,
      precioCliente: unitPrice,
      saleTotal,
      suggestedUnit,
      suggestedSaleTotal,
      marginAmount,
      marginPercent,
      marginPercentOverSale,
    };
  });

  const material = materialRows.reduce((sum, item) => sum + item.saleTotal, 0);
  const materialBaseCost = materialRows.reduce((sum, item) => sum + item.baseCost, 0);
  const wasteCost = materialRows.reduce((sum, item) => sum + item.wasteCost, 0);
  const internalMaterialCost = materialBaseCost + wasteCost;
  const hardwareSale = accessoryRows.reduce((sum, item) => sum + item.saleTotal, 0);
  const hardwareCost = accessoryRows.reduce((sum, item) => sum + item.costTotal, 0);
  const primaryMaterialCost = materialRows[0]?.costoUnitario ?? numberValue(data.costoMaterialM2);
  const primaryMaterialWaste = materialRows[0]?.merma ?? merma;
  const suggestedMaterialTotal = materialRows.reduce((sum, item) => sum + item.suggestedSaleTotal, 0);
  const suggestedPriceM2 = areaTotal > 0
    ? suggestedMaterialTotal / areaTotal
    : positiveNumber(primaryMaterialCost) * (1 + percentValue(primaryMaterialWaste) / 100) * (1 + margenMaterial / 100);
  const subtotal = material + hardwareSale + manoObra + extras;
  const discountAmount = subtotal * (descuento / 100);
  const total = subtotal - discountAmount;
  const laborProfit = manoObra;
  const internalTotal = internalMaterialCost + hardwareCost + extras;
  const profit = total - internalTotal;
  const profitPercent = total > 0 ? (profit / total) * 100 : 0;
  const deposit = total * (anticipo / 100);
  const rest = total - deposit;
  const breakdown = [
    {
      title: 'Medidas',
      lines: measureRows.map((item) => ({
        label: item.nombre,
        amount: `${decimal(item.areaTotal)} m² / ${decimal(item.linearTotal)} m`,
        detail: `Área: (${item.ancho} cm ÷ 100) x (${item.alto} cm ÷ 100) x ${item.cantidad} = ${decimal(item.areaTotal)} m². Lineal: (${item.ancho} + ${item.alto}) x 2 ÷ 100 x ${item.cantidad} = ${decimal(item.linearTotal)} m.`,
      })),
    },
    {
      title: 'Materiales',
      lines: materialRows.map((item) => ({
        label: item.nombre,
        amount: money(item.saleTotal),
        detail: `${decimal(item.rowQuantity)} ${item.unidad} por ${item.calcLabel}. ${(item.calculationSteps || []).join(' ')}`,
      })),
    },
    {
      title: 'Herrajes y accesorios',
      lines: accessoryRows.map((item) => ({
        label: item.nombre,
        amount: money(item.saleTotal),
        detail: `${decimal(item.rowQuantity, 0)} pieza(s). Costo interno: ${decimal(item.rowQuantity, 0)} x ${money(item.costoUnitario)} = ${money(item.costTotal)}. Precio cliente: ${decimal(item.rowQuantity, 0)} x ${money(item.precioUnitario)} = ${money(item.saleTotal)}.`,
      })),
    },
    {
      title: 'Totales del cliente',
      lines: [
        {
          label: 'Subtotal',
          amount: money(subtotal),
          detail: `Materiales ${money(material)} + herrajes ${money(hardwareSale)} + mano de obra ${money(manoObra)} + extras ${money(extras)} = ${money(subtotal)}.`,
        },
        {
          label: 'Descuento',
          amount: `-${money(discountAmount)}`,
          detail: `${descuento}% de ${money(subtotal)} = ${money(discountAmount)}.`,
        },
        {
          label: 'Total cliente',
          amount: money(total),
          detail: `${money(subtotal)} - ${money(discountAmount)} = ${money(total)}.`,
        },
        {
          label: 'Anticipo y resto',
          amount: `${money(deposit)} / ${money(rest)}`,
          detail: `Anticipo ${anticipo}% de ${money(total)} = ${money(deposit)}. Resto: ${money(total)} - ${money(deposit)} = ${money(rest)}.`,
        },
      ],
    },
    {
      title: 'Ganancia ALUXOR',
      lines: [
        {
          label: 'Costo interno real',
          amount: money(internalTotal),
          detail: `Material base ${money(materialBaseCost)} + merma ${money(wasteCost)} + herrajes ${money(hardwareCost)} + extras ${money(extras)} = ${money(internalTotal)}. La mano de obra no se resta porque ALUXOR instala y queda como ingreso del negocio.`,
        },
        {
          label: 'Mano de obra como ganancia',
          amount: money(laborProfit),
          detail: `Mano de obra cobrada al cliente: ${money(laborProfit)}. Como la instalación la hace el negocio, se suma dentro de la utilidad en vez de tratarse como gasto externo.`,
        },
        {
          label: profit >= 0 ? 'Ganancia estimada' : 'Pérdida estimada',
          amount: money(profit),
          detail: `Total cliente ${money(total)} - costo interno real ${money(internalTotal)} = ${money(profit)}. Margen sobre venta: ${decimal(profitPercent, 1)}%.`,
        },
      ],
    },
  ].map((group) => ({
    ...group,
    lines: group.lines.filter((line) => line.label && line.detail),
  })).filter((group) => group.lines.length > 0);

  return {
    area,
    areaTotal,
    linearTotal,
    measureRows,
    material,
    grosorMaterial,
    materialRows,
    accessoryRows,
    costoMaterialM2: primaryMaterialCost,
    merma,
    margenMaterial,
    materialBaseCost,
    wasteCost,
    internalMaterialCost,
    hardwareSale,
    hardwareCost,
    suggestedPriceM2,
    suggestedMaterialTotal,
    manoObra,
    laborProfit,
    extras,
    descuento,
    discountAmount,
    subtotal,
    internalTotal,
    profit,
    profitPercent,
    breakdown,
    total,
    deposit,
    rest,
    anticipo,
    cantidad,
    fondo,
  };
}

function sentenceJoin(parts) {
  return parts.filter(Boolean).join('\n');
}

function contactLine(whatsapp) {
  return whatsapp ? `WhatsApp: ${whatsapp}` : 'Escríbenos por mensaje directo';
}

function buildContext(data, quote) {
  const tone = tonos[data.tono] || tonos.profesional;
  const price = data.usarCotizacion
    ? `${money(quote.total)} aprox.`
    : clean(data.precioManual, 'Cotización sin compromiso');

  const materialNames = quote.materialRows?.length
    ? quote.materialRows.map((item) => item.nombre).filter(Boolean).join(', ')
    : clean(data.materialCotizacion, 'material principal');
  const accessoryNames = quote.accessoryRows?.length
    ? quote.accessoryRows.map((item) => item.nombre).filter(Boolean).join(', ')
    : clean(data.herrajes, 'herrajes y accesorios');

  return {
    tone,
    tipoTrabajo: clean(data.tipoTrabajo, 'Trabajo a medida'),
    product: clean(data.producto, 'Producto a medida'),
    material: clean(data.material, 'materiales de calidad'),
    materialCotizacion: materialNames,
    herrajes: accessoryNames,
    medidas: clean(data.medidas, formatDimensions(data)),
    acabado: clean(data.acabado, 'acabado profesional'),
    precio: price,
    ciudad: clean(data.ciudad, 'tu ciudad'),
    whatsapp: clean(data.whatsapp),
    beneficio: clean(data.beneficio, 'mejorar tu espacio con una solución funcional'),
    incluye: clean(data.incluye),
    entrega: clean(data.entrega),
    promocion: clean(data.promocion),
    objetivo: objetivos[data.objetivo] || objetivos.cotizar,
    tagLine: hashtags(data),
  };
}

function generateOutputs(data, quote) {
  const c = buildContext(data, quote);
  const promo = c.promocion ? `\nPromoción: ${c.promocion}` : '';
  const includes = c.incluye ? `\nIncluye: ${c.incluye}` : '';
  const delivery = c.entrega ? `\nEntrega: ${c.entrega}` : '';
  const quoteLines = data.usarCotizacion
    ? sentenceJoin([
      `Área aproximada: ${quote.area.toFixed(2)} m²`,
      numberValue(data.fondo) > 0 ? `Fondo: ${numberValue(data.fondo)} cm` : '',
      numberValue(data.grosorMaterial) > 0 ? `Grosor: ${numberValue(data.grosorMaterial)} mm` : '',
      `Materiales: ${money(quote.material)}`,
      quote.hardwareSale ? `Herrajes/accesorios: ${money(quote.hardwareSale)}` : '',
      `Mano de obra/instalación: ${money(quote.manoObra)}`,
      quote.extras ? `Extras: ${money(quote.extras)}` : '',
      quote.discountAmount ? `Descuento: -${money(quote.discountAmount)}` : '',
      `Total aproximado: ${money(quote.total)}`,
      `Anticipo sugerido: ${money(quote.deposit)}`,
      `Resto al entregar: ${money(quote.rest)}`,
    ])
    : '';

  return [
    {
      name: 'Anuncio para redes',
      icon: Sparkles,
      description: 'Para Facebook, Instagram o estado de WhatsApp.',
      text: sentenceJoin([
        `${c.product}`,
        `Tipo: ${c.tipoTrabajo}`,
        '',
        c.tone.opener,
        '',
        `Fabricado en ${c.material}, con acabado ${c.acabado}. Ideal para ${c.beneficio}. ${c.tone.promise}`,
        '',
        `Medidas: ${c.medidas}`,
        `Precio: ${c.precio}`,
        `Ubicación: ${c.ciudad}${includes}${delivery}${promo}`,
        contactLine(c.whatsapp),
        '',
        c.tone.cta,
        '',
        c.tagLine,
      ]),
    },
    {
      name: 'Cotización para cliente',
      icon: Calculator,
      description: 'Mensaje claro con precio, anticipo y resto.',
      text: sentenceJoin([
        `Cotización: ${c.product}`,
        '',
        `Tipo de trabajo: ${c.tipoTrabajo}`,
        `Material: ${c.material}`,
        `Material para cotizar: ${c.materialCotizacion}`,
        c.herrajes !== 'Sin herrajes' ? `Herrajes/accesorios: ${c.herrajes}` : '',
        `Medidas: ${c.medidas}`,
        `Acabado: ${c.acabado}`,
        c.incluye ? `Incluye: ${c.incluye}` : '',
        c.entrega ? `Tiempo/entrega: ${c.entrega}` : '',
        '',
        data.usarCotizacion ? quoteLines : `Precio: ${c.precio}`,
        '',
        'El precio puede ajustarse si cambian medidas, materiales o condiciones de instalación.',
        contactLine(c.whatsapp),
      ]),
    },
    {
      name: 'WhatsApp corto',
      icon: MessageCircle,
      description: 'Para responder rápido a interesados.',
      text: sentenceJoin([
        `Hola, te comparto ${c.product}.`,
        `Tipo: ${c.tipoTrabajo}`,
        `Material: ${c.material}`,
        `Medidas: ${c.medidas}`,
        `Precio: ${c.precio}`,
        data.usarCotizacion ? `Anticipo sugerido: ${money(quote.deposit)}` : '',
        `${c.tone.cta}`,
      ]),
    },
    {
      name: 'Marketplace',
      icon: Store,
      description: 'Formato directo para publicar como venta.',
      text: sentenceJoin([
        `${c.product} - ${c.precio}`,
        '',
        `${c.objetivo}. Tipo de trabajo: ${c.tipoTrabajo}. Fabricado en ${c.material}, con acabado ${c.acabado}.`,
        `Medidas: ${c.medidas}.`,
        `Perfecto para ${c.beneficio}.`,
        c.incluye ? `Incluye: ${c.incluye}.` : '',
        c.promocion ? `Promoción: ${c.promocion}.` : '',
        '',
        `Ubicación: ${c.ciudad}.`,
        c.whatsapp ? `Contacto por WhatsApp: ${c.whatsapp}` : 'Contacto por mensaje.',
      ]),
    },
    {
      name: 'Texto para imagen',
      icon: BadgeDollarSign,
      description: 'Pocas palabras para poner sobre una foto.',
      text: sentenceJoin([
        c.product.toUpperCase(),
        c.tipoTrabajo,
        c.material,
        `Desde ${c.precio}`,
        c.whatsapp ? `Cotiza: ${c.whatsapp}` : c.ciudad,
      ]),
    },
  ];
}

function countScore(data) {
  const fields = ['producto', 'material', 'medidas', 'acabado', 'ciudad', 'beneficio', 'incluye', 'ancho', 'alto', 'fondo', 'precioM2'];
  return fields.reduce((score, field) => score + (clean(data[field]).length > 0 ? 1 : 0), 0);
}

const fieldGuides = {
  clienteNombre: {
    help: 'Qué dato va: nombre del cliente o referencia del proyecto.',
    why: 'Para qué sirve: permite identificar la cotización en historial, PDF y seguimiento.',
    how: 'Cómo llenarlo: escribe nombre completo, negocio o referencia como Casa San Pedro.',
  },
  clienteTelefono: {
    help: 'Qué dato va: teléfono del cliente.',
    why: 'Para qué sirve: facilita seguimiento, envío por WhatsApp y búsqueda en historial.',
    how: 'Cómo llenarlo: agrega 10 dígitos o número con lada.',
  },
  whatsapp: {
    help: 'Qué dato va: WhatsApp de contacto para el anuncio.',
    why: 'Para qué sirve: aparece en textos comerciales y mensajes para cliente.',
    how: 'Cómo llenarlo: usa el número donde quieres recibir mensajes.',
  },
  producto: {
    help: 'Qué dato va: nombre del producto o trabajo.',
    why: 'Para qué sirve: aparece en anuncio, cotización, historial y PDF.',
    how: 'Cómo llenarlo: ejemplo Clóset a medida, Cancel de baño, Cocina integral.',
  },
  tipoTrabajo: {
    help: 'Qué dato va: categoría específica del trabajo.',
    why: 'Para qué sirve: ajusta textos, clasificación y plantillas.',
    how: 'Cómo llenarlo: elige el tipo más cercano al proyecto real.',
  },
  materialCotizacion: {
    help: 'Qué dato va: material principal que se va a cobrar.',
    why: 'Para qué sirve: identifica el material base del cálculo.',
    how: 'Cómo llenarlo: ejemplo Melamina, MDF, Aluminio y vidrio, Vidrio templado.',
  },
  material: {
    help: 'Qué dato va: descripción comercial del material.',
    why: 'Para qué sirve: se usa para explicar al cliente qué recibirá.',
    how: 'Cómo llenarlo: escribe material, color, acabado o especificación importante.',
  },
  medidas: {
    help: 'Qué dato va: resumen de medidas del proyecto.',
    why: 'Para qué sirve: aparece en anuncio, PDF y mensajes.',
    how: 'Cómo llenarlo: se puede generar con ancho, alto, fondo y piezas.',
  },
  ancho: {
    help: 'Qué dato va: ancho en centímetros.',
    why: 'Para qué sirve: calcula área, material, lineales y precio.',
    how: 'Cómo llenarlo: mide de izquierda a derecha el espacio útil.',
  },
  alto: {
    help: 'Qué dato va: alto en centímetros.',
    why: 'Para qué sirve: calcula área, material y proporción del plano.',
    how: 'Cómo llenarlo: mide desde piso/base hasta la altura final.',
  },
  fondo: {
    help: 'Qué dato va: profundidad en centímetros.',
    why: 'Para qué sirve: ayuda a instalación, plano 3D, fabricación y revisión de espacio.',
    how: 'Cómo llenarlo: mide desde frente hacia atrás.',
  },
  grosorMaterial: {
    help: 'Qué dato va: grosor del material en milímetros.',
    why: 'Para qué sirve: ayuda a fabricación, plano y selección de material.',
    how: 'Cómo llenarlo: ejemplo 16 mm para melamina, 6 mm para vidrio.',
  },
  cantidad: {
    help: 'Qué dato va: número de piezas o módulos.',
    why: 'Para qué sirve: multiplica áreas, materiales y cantidades.',
    how: 'Cómo llenarlo: usa 1 si es una sola pieza o módulo principal.',
  },
  precioM2: {
    help: 'Qué dato va: precio de venta por metro cuadrado.',
    why: 'Para qué sirve: determina cuánto se cobra al cliente por material.',
    how: 'Cómo llenarlo: usa precio de venta, no costo interno.',
  },
  costoMaterialM2: {
    help: 'Qué dato va: costo interno por metro cuadrado.',
    why: 'Para qué sirve: calcula utilidad y total interno ALUXOR.',
    how: 'Cómo llenarlo: usa el costo real del proveedor.',
  },
  merma: {
    help: 'Qué dato va: porcentaje extra por desperdicio o cortes.',
    why: 'Para qué sirve: evita perder dinero por sobrantes, cortes o errores normales.',
    how: 'Cómo llenarlo: usa 5 a 10% normalmente; ajusta según complejidad.',
  },
  margenMaterial: {
    help: 'Qué dato va: margen deseado sobre material.',
    why: 'Para qué sirve: ayuda a sugerir precio rentable.',
    how: 'Cómo llenarlo: ejemplo 30 a 40 según tipo de trabajo.',
  },
  herrajes: {
    help: 'Qué dato va: accesorios principales del proyecto.',
    why: 'Para qué sirve: aparece en cotización y análisis de proveedor.',
    how: 'Cómo llenarlo: ejemplo bisagras, correderas, jaladeras, carretillas.',
  },
  costoHerrajes: {
    help: 'Qué dato va: costo interno de herrajes.',
    why: 'Para qué sirve: calcula total interno y utilidad.',
    how: 'Cómo llenarlo: suma lo que realmente cuesta comprarlos.',
  },
  precioHerrajes: {
    help: 'Qué dato va: precio de venta de herrajes al cliente.',
    why: 'Para qué sirve: calcula total cliente.',
    how: 'Cómo llenarlo: incluye margen y manejo.',
  },
  manoObra: {
    help: 'Qué dato va: cobro por fabricación, instalación o servicio.',
    why: 'Para qué sirve: impacta el total cliente y utilidad del negocio.',
    how: 'Cómo llenarlo: incluye tiempo, dificultad, traslado y ajuste.',
  },
  extras: {
    help: 'Qué dato va: cargos adicionales.',
    why: 'Para qué sirve: cubre flete, selladores, tornillería, estacionamiento u otros.',
    how: 'Cómo llenarlo: usa 0 si no aplica.',
  },
  descuento: {
    help: 'Qué dato va: porcentaje de descuento al cliente.',
    why: 'Para qué sirve: reduce el total final.',
    how: 'Cómo llenarlo: usa 0 si no hay descuento.',
  },
  anticipo: {
    help: 'Qué dato va: porcentaje de anticipo.',
    why: 'Para qué sirve: calcula cuánto pedir para iniciar.',
    how: 'Cómo llenarlo: comúnmente 50%.',
  },
  vigencia: {
    help: 'Qué dato va: días que dura válida la cotización.',
    why: 'Para qué sirve: protege contra cambios de precio.',
    how: 'Cómo llenarlo: usa 7, 15 o 30 días.',
  },
  condiciones: {
    help: 'Qué dato va: términos comerciales.',
    why: 'Para qué sirve: aclara anticipo, saldo, instalación y cambios.',
    how: 'Cómo llenarlo: especifica cuándo se paga y qué puede cambiar.',
  },
  folioManual: {
    help: 'Qué dato va: folio personalizado opcional.',
    why: 'Para qué sirve: permite usar un número propio si no quieres folio automático.',
    how: 'Cómo llenarlo: déjalo vacío para generar folio automático.',
  },
  estadoCotizacion: {
    help: 'Qué dato va: etapa actual de la cotización.',
    why: 'Para qué sirve: facilita seguimiento en historial.',
    how: 'Cómo llenarlo: Pendiente, Enviada, Aceptada, En fabricación, Instalación, Terminada o Cancelada.',
  },
  formaPago: {
    help: 'Qué dato va: forma o condiciones de pago.',
    why: 'Para qué sirve: aparece en PDF y evita malentendidos.',
    how: 'Cómo llenarlo: ejemplo 50% anticipo y saldo contra entrega.',
  },
  notasCliente: {
    help: 'Qué dato va: nota visible para el cliente.',
    why: 'Para qué sirve: aparece en PDF cliente.',
    how: 'Cómo llenarlo: agrega aclaraciones comerciales o recomendaciones.',
  },
  notasInternas: {
    help: 'Qué dato va: nota privada para ALUXOR.',
    why: 'Para qué sirve: ayuda al taller, proveedor o instalador.',
    how: 'Cómo llenarlo: no aparece en PDF cliente; solo hoja interna.',
  },
};

function guideFor(field) {
  return fieldGuides[field] || {};
}

function quoteDataHealth(data, quote) {
  const required = [
    { label: 'Cliente', value: data.clienteNombre },
    { label: 'Teléfono', value: data.clienteTelefono || data.whatsapp },
    { label: 'Producto', value: data.producto },
    { label: 'Tipo de trabajo', value: data.tipoTrabajo },
    { label: 'Material', value: data.materialCotizacion || data.material },
    { label: 'Medidas', value: data.medidas },
    { label: 'Ancho', value: data.ancho },
    { label: 'Alto', value: data.alto },
    { label: 'Precio por m²', value: data.precioM2 },
    { label: 'Mano de obra', value: data.manoObra },
  ];

  const present = required.filter((item) => item.value !== '' && item.value !== null && item.value !== undefined && Number(item.value) !== 0);
  const missing = required.filter((item) => !present.includes(item));
  const warnings = [];

  if (quote.total <= 0) warnings.push('El total cliente está en cero.');
  if (quote.profit < 0) warnings.push('La utilidad estimada es negativa.');
  if (!data.clienteNombre) warnings.push('Falta nombre del cliente.');
  if (!data.clienteTelefono && !data.whatsapp) warnings.push('Falta teléfono o WhatsApp.');
  if (quote.areaTotal <= 0) warnings.push('El área total está en cero.');
  if (quote.material <= 0) warnings.push('El material no está generando precio.');
  if (quote.manoObra <= 0) warnings.push('La mano de obra está en cero.');

  return {
    present,
    missing,
    warnings,
    score: Math.round((present.length / required.length) * 100),
  };
}

function generateMaterials(data, quote) {
  const materialRows = (quote.materialRows || []).map((item) => ({
    name: item.nombre,
    detail: `${item.rowQuantity.toFixed(2)} ${item.unidad} · ${item.calcLabel}${item.grosor ? ` · grosor ${item.grosor} mm` : ''}${item.nota ? ` · ${item.nota}` : ''}`,
    cost: item.costTotal,
  }));
  const accessoryRows = (quote.accessoryRows || []).map((item) => ({
    name: item.nombre,
    detail: `${item.rowQuantity} pieza(s)${item.nota ? ` · ${item.nota}` : ''}`,
    cost: item.costTotal,
  }));

  return [
    ...materialRows,
    ...accessoryRows,
    { name: 'Mano de obra / instalación', detail: 'Servicio', cost: quote.manoObra },
    { name: 'Extras', detail: 'Flete, selladores, tornillería u otros', cost: quote.extras },
  ].filter((item) => item.name && item.name !== 'Sin herrajes' && item.cost > 0);
}

function workRoleCards(data, quote) {
  const materialCount = quote.materialRows.length;
  const accessoryCount = quote.accessoryRows.length;
  const installFocus = data.giro === 'Vidriería'
    ? 'Confirmar plomo, nivel, sentido de apertura, sellado y holguras del vidrio.'
    : 'Confirmar muros, escuadras, nivel, anclajes, zoclo y paso libre para instalar.';
  const fabricationFocus = data.giro === 'Vidriería'
    ? `Cortar perfiles según ${quote.linearTotal.toFixed(2)} m lineales y pedir vidrio por ${quote.areaTotal.toFixed(2)} m².`
    : `Preparar tablero por ${quote.areaTotal.toFixed(2)} m², canto por ${quote.linearTotal.toFixed(2)} m lineales y revisar herrajes.`;

  return [
    {
      title: 'Vendedor',
      items: [
        `Total cliente: ${money(quote.total)}`,
        `Anticipo sugerido: ${money(quote.deposit)}`,
        `Resto al entregar: ${money(quote.rest)}`,
        `Vigencia: ${data.vigencia} días`,
      ],
    },
    {
      title: 'Fabricación',
      items: [
        fabricationFocus,
        `${materialCount} material(es) y ${accessoryCount} accesorio(s).`,
        `Costo interno sin mano de obra: ${money(quote.internalTotal)}`,
        `Mano de obra queda como utilidad: ${money(quote.laborProfit)}`,
        `Utilidad conectada: ${money(quote.total)} - ${money(quote.internalTotal)} = ${money(quote.profit)}`,
      ],
    },
    {
      title: 'Instalación',
      items: [
        installFocus,
        `Fondo/profundidad principal: ${quote.fondo} cm`,
        `Grosor principal: ${quote.grosorMaterial} mm`,
        `Condiciones: ${clean(data.condiciones, 'Por confirmar')}`,
      ],
    },
  ];
}

function marginAmountFromSaleAndCost(saleTotal, costTotal) {
  return numberValue(saleTotal) - numberValue(costTotal);
}

function marginPercentFromSaleAndCost(saleTotal, costTotal) {
  const sale = numberValue(saleTotal);
  const cost = numberValue(costTotal);
  if (sale <= 0) return 0;
  return ((sale - cost) / sale) * 100;
}

function operationLine(label, operation, result) {
  return {
    label,
    operation,
    result,
  };
}

function quoteProfessionalAnalysis(data, quote) {
  const installReview = data.giro === 'Vidriería'
    ? 'Revisar plomo, nivel, claros, sellado, sentido de apertura y holguras.'
    : 'Revisar muros, nivel, escuadra, anclajes, zoclo y ajustes.';
  const clientOps = [
    operationLine('Subtotal', `${money(quote.material)} + ${money(quote.hardwareSale)} + ${money(quote.manoObra)} + ${money(quote.extras)}`, money(quote.subtotal)),
    operationLine('Total', `${money(quote.subtotal)} - ${money(quote.discountAmount)}`, money(quote.total)),
    operationLine('Anticipo', `${money(quote.total)} x ${decimal(quote.anticipo, 1)}%`, money(quote.deposit)),
    operationLine('Saldo', `${money(quote.total)} - ${money(quote.deposit)}`, money(quote.rest)),
  ];
  const internalOps = [
    operationLine('Costo material interno', `${money(quote.materialBaseCost)} + ${money(quote.wasteCost)}`, money(quote.internalMaterialCost)),
    operationLine('Total interno', `${money(quote.internalMaterialCost)} + ${money(quote.hardwareCost)} + ${money(quote.extras)}`, money(quote.internalTotal)),
    operationLine('Utilidad', `${money(quote.total)} - ${money(quote.internalTotal)}`, money(quote.profit)),
    operationLine('Utilidad %', `${money(quote.profit)} / ${money(quote.total)} x 100`, `${decimal(quote.profitPercent, 1)}%`),
  ];

  return [
    {
      role: 'Cotizador',
      title: 'Precio para cliente',
      total: money(quote.total),
      why: 'Este total sale de materiales, herrajes, mano de obra, extras y descuento.',
      how: [
        `Materiales al cliente: ${money(quote.material)}`,
        `Herrajes/accesorios al cliente: ${money(quote.hardwareSale)}`,
        `Mano de obra/instalación: ${money(quote.manoObra)}`,
        `Extras: ${money(quote.extras)}`,
        `Subtotal: ${money(quote.subtotal)}`,
        `Descuento: -${money(quote.discountAmount)}`,
        `Total cliente: ${money(quote.total)}`,
        `Anticipo: ${money(quote.deposit)}`,
        `Saldo/resto: ${money(quote.rest)}`,
        ...clientOps.map((item) => `${item.label}: ${item.operation} = ${item.result}`),
        `Vigencia: ${data.vigencia} días`,
        `Condiciones: ${clean(data.condiciones, 'Por confirmar')}`,
      ],
    },
    {
      role: 'Instalador',
      title: 'Trabajo de instalación',
      total: money(quote.manoObra),
      why: 'La instalación cubre preparación, armado, nivelación, ajustes, fijación y entrega del trabajo.',
      how: [
        `Medidas: ${formatDimensions(data)}`,
        `Área total: ${decimal(quote.areaTotal)} m²`,
        `Metro lineal aproximado: ${decimal(quote.linearTotal)} m`,
        `Cantidad de piezas/medidas: ${quote.measureRows.length}`,
        `Fondo principal: ${quote.fondo} cm`,
        `Grosor principal: ${quote.grosorMaterial} mm`,
        installReview,
        `Mano de obra considerada: ${money(quote.manoObra)}`,
        'Operación área: Ancho x Alto x Cantidad = Área por partidas',
        'Operación lineal: Perímetro x Cantidad = Metro lineal aproximado',
      ],
    },
    {
      role: 'Proveedor / Interno',
      title: 'Costo interno estimado',
      total: money(quote.internalTotal),
      why: 'Este monto representa lo que ALUXOR debe considerar para materiales, merma, herrajes y extras antes de utilidad.',
      how: [
        `Costo material base: ${money(quote.materialBaseCost)}`,
        `Merma: ${money(quote.wasteCost)}`,
        `Costo interno material: ${money(quote.internalMaterialCost)}`,
        `Costo de herrajes: ${money(quote.hardwareCost)}`,
        `Extras: ${money(quote.extras)}`,
        `Total interno: ${money(quote.internalTotal)}`,
        `Total cliente: ${money(quote.total)}`,
        `Utilidad estimada: ${money(quote.profit)} (${decimal(quote.profitPercent, 1)}%)`,
        `Margen material: ${decimal(quote.margenMaterial, 1)}%`,
        `Precio sugerido por m²: ${money(quote.suggestedPriceM2)}`,
        `Total margen estimado: ${money(quote.profit)}`,
        ...internalOps.map((item) => `${item.label}: ${item.operation} = ${item.result}`),
      ],
    },
  ];
}

function normalizeCatalogItem(item) {
  return {
    materialCotizacion: 'Material',
    herrajes: 'Sin herrajes',
    costoHerrajes: 0,
    precioHerrajes: 0,
    ...item,
  };
}

function loadCatalog() {
  try {
    const stored = localStorage.getItem('anunciapro.catalog');
    const items = stored ? JSON.parse(stored) : catalogDefaults;
    return items.map(normalizeCatalogItem);
  } catch {
    return catalogDefaults.map(normalizeCatalogItem);
  }
}

function loadHistory() {
  try {
    const stored = localStorage.getItem('anunciapro.history');
    return stored ? normalizeHistory(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

function loadAppLogo() {
  try {
    return localStorage.getItem('anunciapro.logo') || '';
  } catch {
    return '';
  }
}

function normalizeHistory(items) {
  if (!Array.isArray(items)) return [];

  const unique = new Map();

  items.forEach((item) => {
    if (!item?.id) return;

    const createdAt = item.createdAt || Number(String(item.id).replace(/\D/g, '')) || Date.now();

    unique.set(item.id, {
      ...item,
      createdAt,
      updatedAt: item.updatedAt || createdAt,
      status: item.status || 'Pendiente',
    });
  });

  return Array.from(unique.values())
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
    .slice(0, 200);
}

function mergeHistoryItems(...lists) {
  const unique = new Map();

  normalizeHistory(lists.flat()).forEach((item) => {
    const current = unique.get(item.id);
    const currentTime = Number(current?.updatedAt || current?.createdAt || 0);
    const nextTime = Number(item.updatedAt || item.createdAt || 0);

    if (!current || nextTime >= currentTime) {
      unique.set(item.id, item);
    }
  });

  return normalizeHistory(Array.from(unique.values()));
}
function recoverLegacyHistoryFromLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return [];

  const recovered = [];
  const legacyKeyPattern = /aluxor|anunciapro|historial|history|cotizacion|cotizaciones|quote|quotes/i;
  const collectionKeys = ['history', 'historial', 'cotizaciones', 'quotes', 'items', 'data', 'records', 'results'];
  const timestamp = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const toNumber = (...values) => numberValue(firstValue(...values) || 0);
  const normalizeLegacyItem = (item, key, index) => {
    if (!item || typeof item !== 'object') return null;

    const form = item.form && typeof item.form === 'object' ? item.form : item;
    const createdAt = timestamp(firstValue(item.createdAt, item.fecha, item.date, item.created_at)) || Date.now();
    const updatedAt = timestamp(firstValue(item.updatedAt, item.updated_at, item.modificadoEn)) || createdAt;
    const total = toNumber(item.total, item.totalCotizacion, item.precioTotal, item.monto, item.amount, form.total);
    const anticipo = toNumber(item.anticipo, item.deposit, item.abono, form.anticipo);
    const resto = toNumber(item.resto, item.rest, item.saldo, total - anticipo);

    return {
      id: String(firstValue(item.id, item.uuid, item.folio, `legacy-${key}-${createdAt}-${index}`)),
      createdAt,
      updatedAt,
      status: firstValue(item.status, item.estado, 'Pendiente'),
      clienteNombre: clean(firstValue(item.clienteNombre, item.cliente, item.nombreCliente, item.clientName, form.clienteNombre), 'Cliente'),
      clienteTelefono: clean(firstValue(item.clienteTelefono, item.telefono, item.phone, item.whatsapp, form.clienteTelefono)),
      producto: clean(firstValue(item.producto, item.proyecto, item.product, item.title, form.producto), 'Proyecto a medida'),
      tipoTrabajo: clean(firstValue(item.tipoTrabajo, item.tipo, item.workType, form.tipoTrabajo), 'Trabajo'),
      giro: clean(firstValue(item.giro, item.categoria, item.category, form.giro), 'Carpintería'),
      total,
      anticipo,
      resto,
      form: { ...defaults, ...form },
      recoveredFrom: key,
    };
  };

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !legacyKeyPattern.test(key)) continue;

    try {
      const raw = window.localStorage.getItem(key);
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed)
        ? parsed
        : collectionKeys.map((name) => parsed?.[name]).find(Array.isArray) || [];

      if (Array.isArray(items)) {
        recovered.push(...items.map((item, index) => normalizeLegacyItem(item, key, index)).filter(Boolean));
      }
    } catch {
      // Ignorar llaves viejas que no sean JSON.
    }
  }

  return normalizeHistory(recovered);
}
async function requestHistory(options = {}) {
  const response = await fetch(HISTORY_API, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) throw new Error('No se pudo sincronizar el historial');
  const data = await response.json();
  return normalizeHistory(data.history || []);
}

function professionalDocFromQuote(data, quote) {
  return {
    titulo: 'Cotización profesional',
    cliente: clean(data.clienteNombre, 'Cliente'),
    descripcion: `Proyecto: ${clean(data.producto)}. Material: ${clean(data.material)}. Acabado: ${clean(data.acabado)}.`,
    partidas: [
      ...quote.materialRows.map((item) => `${item.nombre}: ${decimal(item.rowQuantity)} ${item.unidad} - ${money(item.saleTotal)}`),
      ...quote.accessoryRows.map((item) => `${item.nombre}: ${decimal(item.rowQuantity, 0)} pza(s) - ${money(item.saleTotal)}`),
      quote.manoObra > 0 ? `Mano de obra / instalación: ${money(quote.manoObra)}` : '',
      quote.extras > 0 ? `Extras: ${money(quote.extras)}` : '',
    ].filter(Boolean).join('\n'),
    condiciones: clean(data.condiciones),
    notas: clean(data.notasCliente || data.notasInternas),
    vigencia: String(data.vigencia ?? ''),
    anticipo: money(quote.deposit),
    saldo: money(quote.rest),
    total: money(quote.total),
  };
}

function quotePrintHtml(data, quote, materials, mode = 'client', doc = null, logo = '') {
  const isBusiness = mode === 'business';
  const today = new Date().toLocaleDateString('es-MX');
  const folio = clean(data.folio || data.folioManual, 'Por asignar');
  const formaPago = clean(data.formaPago, 'Anticipo y saldo contra entrega');
  const notasCliente = clean(data.notasCliente);
  const notasInternas = clean(data.notasInternas);
  const documentData = doc || professionalDocFromQuote(data, quote);
  const internalRows = materials.map((item) => `
    <tr><td>${item.name}</td><td>${item.detail}</td><td>${money(item.cost)}</td></tr>
  `).join('');
  const clientRows = [
    ...quote.materialRows.map((item) => ({
      name: item.nombre,
      detail: `${item.rowQuantity.toFixed(2)} ${item.unidad} · ${item.calcLabel}${item.grosor ? ` · grosor ${item.grosor} mm` : ''}${item.nota ? ` · ${item.nota}` : ''}`,
      total: item.saleTotal,
    })),
    ...quote.accessoryRows.map((item) => ({
      name: item.nombre,
      detail: `${item.rowQuantity} pieza(s)${item.nota ? ` · ${item.nota}` : ''}`,
      total: item.saleTotal,
    })),
    { name: 'Mano de obra / instalación', detail: 'Servicio', total: quote.manoObra },
    { name: 'Extras', detail: 'Flete, selladores, tornillería u otros', total: quote.extras },
  ].filter((item) => item.name && item.total > 0).map((item) => `
    <tr><td>${item.name}</td><td>${item.detail}</td><td>${money(item.total)}</td></tr>
  `).join('');
  const measureRows = (quote.measureRows || []).map((item) => `
    <tr><td>${item.nombre}</td><td>${item.ancho} x ${item.alto} x ${item.fondo} cm · ${item.grosorMaterial} mm</td><td>${item.cantidad}</td><td>${item.areaTotal.toFixed(2)} m²</td><td>${item.linearTotal.toFixed(2)} m</td></tr>
  `).join('');
  const breakdownRows = (quote.breakdown || []).flatMap((group) => (
    group.lines.map((line) => `
      <tr><td>${group.title}</td><td>${line.label}</td><td>${line.detail}</td><td>${line.amount}</td></tr>
    `)
  )).join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
  <title>${isBusiness ? 'Hoja interna' : 'Cotización'} ${data.producto}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#17201b}
    header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #22745f;padding-bottom:18px;margin-bottom:24px}
    .brandline{display:flex;align-items:center;gap:12px}.logo{width:58px;height:58px;object-fit:contain;border-radius:8px}
    h1{margin:0;font-size:30px} h2{margin:24px 0 10px;font-size:18px} p{line-height:1.45}
    .brand{color:#22745f;font-weight:800}.total{font-size:34px;font-weight:900;color:#22745f}
    table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #d8d2c7;padding:10px;text-align:left}th{background:#eef1ed}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.box{border:1px solid #d8d2c7;padding:14px;border-radius:8px}
    .internal{background:#fff7df;border:1px solid #e6c66d;border-radius:8px;padding:12px;margin:18px 0}
    button{margin-top:20px;padding:12px 18px;border:0;border-radius:7px;background:#22745f;color:white;font-weight:800}
    @media print{button{display:none}body{padding:20px}}
  </style></head><body>
    <header><div class="brandline">${logo ? `<img src="${logo}" class="logo" alt="Logo" />` : ''}<div><div class="brand">${BRAND_NAME}</div><h1>${escapeHtml(documentData.titulo || (isBusiness ? 'Hoja interna del negocio' : 'Cotización'))}</h1><p>${today}</p></div></div><div><div>Total</div><div class="total">${escapeHtml(documentData.total || money(quote.total))}</div></div></header>
    ${isBusiness ? '<div class="internal"><strong>Uso interno ALUXOR.</strong> Esta hoja incluye costos, utilidad y datos de operación. No entregar al cliente.</div>' : ''}
    <section class="grid"><div class="box"><strong>Cliente</strong><p>${escapeHtml(documentData.cliente || clean(data.clienteNombre, 'Cliente'))}${data.clienteTelefono ? `<br>${data.clienteTelefono}` : ''}</p></div><div class="box"><strong>Proyecto</strong><p>${data.producto}<br>${data.tipoTrabajo}<br>${data.medidas}</p></div></section>
    <section class="grid"><div class="box"><strong>Folio</strong><p>${folio}</p></div><div class="box"><strong>Forma de pago</strong><p>${formaPago}</p></div></section>
    <h2>Descripción</h2><p>${escapeHtml(documentData.descripcion || `Material: ${data.material}. Acabado: ${data.acabado}. Incluye: ${data.incluye}.`)}</p>
    ${documentData.partidas ? `<h2>Partidas editadas</h2><p>${escapeHtml(documentData.partidas).replace(/\n/g, '<br>')}</p>` : ''}
    <h2>Medidas</h2><table><thead><tr><th>Partida</th><th>Medida</th><th>Cantidad</th><th>Área total</th><th>Metro lineal</th></tr></thead><tbody>${measureRows}</tbody></table>
    <h2>${isBusiness ? 'Lista interna de materiales y costos' : 'Conceptos de la cotización'}</h2><table><thead><tr><th>Concepto</th><th>Detalle</th><th>${isBusiness ? 'Importe interno' : 'Importe'}</th></tr></thead><tbody>${isBusiness ? internalRows : clientRows}</tbody></table>
    <h2>Resumen</h2><table><tbody>
      <tr><td>Material al cliente</td><td>${money(quote.material)}</td></tr>
      <tr><td>Herrajes</td><td>${money(quote.hardwareSale)}</td></tr>
      <tr><td>Mano de obra</td><td>${money(quote.manoObra)}</td></tr>
      <tr><td>Extras</td><td>${money(quote.extras)}</td></tr>
      <tr><td>Descuento</td><td>-${money(quote.discountAmount)}</td></tr>
      <tr><th>Total</th><th>${money(quote.total)}</th></tr>
      <tr><td>Anticipo sugerido</td><td>${escapeHtml(documentData.anticipo || money(quote.deposit))}</td></tr>
      <tr><td>Resto al entregar</td><td>${escapeHtml(documentData.saldo || money(quote.rest))}</td></tr>
      ${isBusiness ? `<tr><td>Margen material usado</td><td>${quote.margenMaterial}%</td></tr>` : ''}
    </tbody></table>
    ${isBusiness ? `<h2>Resumen interno ALUXOR</h2><table><tbody>
      <tr><td>Costo material base</td><td>${money(quote.materialBaseCost)}</td></tr>
      <tr><td>Merma</td><td>${money(quote.wasteCost)}</td></tr>
      <tr><td>Costo herrajes</td><td>${money(quote.hardwareCost)}</td></tr>
      <tr><td>Mano de obra como utilidad</td><td>${money(quote.laborProfit)}</td></tr>
      <tr><td>Costo total interno sin mano de obra</td><td>${money(quote.internalTotal)}</td></tr>
      <tr><td>Utilidad estimada</td><td>${money(quote.profit)} (${quote.profitPercent.toFixed(1)}%)</td></tr>
    </tbody></table><h2>Desglose del cálculo</h2><table><thead><tr><th>Área</th><th>Concepto</th><th>Por qué sale ese resultado</th><th>Resultado</th></tr></thead><tbody>${breakdownRows}</tbody></table>` : ''}
    ${isBusiness ? `<h2>Desglose interno ALUXOR</h2><p>Esta información es interna de ALUXOR y no debe compartirse con el cliente.</p><table><tbody>
      <tr><td>Total cliente</td><td>${money(quote.total)}</td></tr>
      <tr><td>Subtotal cliente</td><td>${money(quote.subtotal)}</td></tr>
      <tr><td>Descuento</td><td>-${money(quote.discountAmount)}</td></tr>
      <tr><td>Anticipo</td><td>${money(quote.deposit)}</td></tr>
      <tr><td>Saldo</td><td>${money(quote.rest)}</td></tr>
      <tr><td>Costo material base</td><td>${money(quote.materialBaseCost)}</td></tr>
      <tr><td>Merma</td><td>${money(quote.wasteCost)}</td></tr>
      <tr><td>Costo material interno</td><td>${money(quote.internalMaterialCost)}</td></tr>
      <tr><td>Costo herrajes</td><td>${money(quote.hardwareCost)}</td></tr>
      <tr><td>Extras</td><td>${money(quote.extras)}</td></tr>
      <tr><td>Total interno</td><td>${money(quote.internalTotal)}</td></tr>
      <tr><td>Mano de obra como ingreso/utilidad</td><td>${money(quote.laborProfit)}</td></tr>
      <tr><td>Utilidad estimada</td><td>${money(quote.profit)} (${quote.profitPercent.toFixed(1)}%)</td></tr>
      <tr><td>Porcentaje utilidad</td><td>${quote.profitPercent.toFixed(1)}%</td></tr>
      <tr><td>Margen material</td><td>${quote.margenMaterial}%</td></tr>
      <tr><td>Precio sugerido por m²</td><td>${money(quote.suggestedPriceM2)}</td></tr>
      <tr><td>Margen materiales</td><td>${money(marginAmountFromSaleAndCost(quote.material, quote.internalMaterialCost))}</td></tr>
      <tr><td>Margen accesorios</td><td>${money(marginAmountFromSaleAndCost(quote.hardwareSale, quote.hardwareCost))}</td></tr>
      <tr><td>Margen total estimado</td><td>${money(quote.profit)}</td></tr>
      ${notasInternas ? `<tr><td>Notas internas</td><td>${notasInternas}</td></tr>` : ''}
      <tr><td>Por qué se cobra así</td><td>Se calcula con materiales, herrajes, mano de obra, extras, descuento, merma y costo interno ya estimado por ALUXOR.</td></tr>
    </tbody></table>` : ''}
    <h2>Condiciones</h2><p>Vigencia: ${escapeHtml(documentData.vigencia || data.vigencia)} días. ${escapeHtml(documentData.condiciones || data.condiciones)}</p>
    ${(documentData.notas || notasCliente) ? `<h2>Notas para cliente</h2><p>${escapeHtml(documentData.notas || notasCliente)}</p>` : ''}
    ${isBusiness && notasInternas ? `<h2>Notas internas</h2><p>${notasInternas}</p>` : ''}
    <button onclick="window.print()">Imprimir o guardar PDF</button>
  </body></html>`;
}

function Field({ id, label, children, help, why, how }) {
  return (
    <label htmlFor={id}>
      {label}
      {children}
      {(help || why || how) && (
        <details className="field-help">
          <summary>Guía de uso</summary>
          {help && <span className="field-help-item"><span className="field-help-title">Qué dato va: </span>{help.replace('Qué dato va: ', '')}</span>}
          {why && <span className="field-help-item"><span className="field-help-title">Para qué sirve: </span>{why.replace('Para qué sirve: ', '')}</span>}
          {how && <span className="field-help-item"><span className="field-help-title">Cómo llenarlo: </span>{how.replace('Cómo llenarlo: ', '')}</span>}
        </details>
      )}
    </label>
  );
}

function CalculationChain({ title, steps, defaultOpen = false }) {
  const toneForStep = (step) => {
    const label = `${step.title} ${step.next || ''}`.toLowerCase();
    if (/medida|área|lineal|cantidad|pieza/.test(label)) return 'measure';
    if (/material|hoja|madera|merma/.test(label)) return 'material';
    if (/precio|utilidad|saldo|anticipo|resultado|documento|cliente/.test(label)) return 'result';
    if (/advert|riesgo|faltante|negativa/.test(label)) return 'warning';
    return 'calc';
  };
  return (
    <details className="calc-chain" open={defaultOpen}>
      <summary><span>Operación</span><strong>{title}</strong></summary>
      <div className="calc-chain-flow">
        {steps.filter(Boolean).map((step, index) => {
          const tone = step.tone || toneForStep(step);
          return (
          <article key={`${step.title}-${index}-${step.result}`} className={`calc-step calc-step-${tone}`}>
            <div className="calc-step-main">
              <div className="calc-step-icon"><Check size={14} /></div>
              <h4>{step.title}</h4>
              <strong className="calc-step-value">{step.result}</strong>
            </div>
            <details className="calc-step-info">
              <summary aria-label={`Ver explicación de ${step.title}`}>?</summary>
              {step.input && <p><strong>Entrada:</strong> {step.input}</p>}
              {step.operation && <p><strong>Operación:</strong> {step.operation}</p>}
              {step.next && <p className="calc-next"><strong>Sigue:</strong> {step.next}</p>}
            </details>
          </article>
        );
        })}
      </div>
    </details>
  );
}

function DashboardSummary({ number, title, description, status = 'Revisar', highlight = false }) {
  return (
    <summary className={highlight ? 'dashboard-summary highlight' : 'dashboard-summary'}>
      <span className="dashboard-number">{number}</span>
      <span className="dashboard-title">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <em>{status}</em>
    </summary>
  );
}

function professionalChainInsights(quote) {
  const totalInternal = Math.max(quote.internalTotal, 0);
  const percent = (value) => totalInternal > 0 ? decimal((value / totalInternal) * 100, 0) : '0';
  const materialShare = percent(quote.internalMaterialCost);
  const laborShare = quote.total > 0 ? decimal((quote.manoObra / quote.total) * 100, 0) : '0';
  const hardwareShare = percent(quote.hardwareCost);
  const sheetsWarning = quote.materialRows.find((item) => item.hojasNecesarias > 0 && item.areaHoja > 0 && item.areaConMerma > 0 && item.hojasNecesarias - (item.areaConMerma / item.areaHoja) >= 0.25);
  const highWaste = quote.materialRows.find((item) => percentValue(item.merma) >= 10);

  return [
    quote.wasteCost > 0 ? `✔ El incremento proviene de la merma: ${money(quote.wasteCost)}.` : '✔ No hay merma relevante capturada.',
    `✔ El material representa ${materialShare}% del costo interno.`,
    `✔ Mano de obra representa ${laborShare}% del precio cliente.`,
    `✔ Herrajes representan ${hardwareShare}% del costo interno.`,
    highWaste ? `⚠ La utilidad podría aumentar reduciendo desperdicio en ${highWaste.nombre}.` : null,
    sheetsWarning ? `⚠ Se compran ${sheetsWarning.hojasNecesarias} hojas completas aunque se usan ${decimal(sheetsWarning.areaConMerma / sheetsWarning.areaHoja)} hojas equivalentes.` : null,
  ].filter(Boolean);
}

function PlanCanvas3D({ data, rotation, zoom }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xedf5f1, 1);
    mount.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
    camera.position.set(4.6, 3.2, 5.2);
    camera.lookAt(0, 0.8, 0);
    camera.zoom = Math.max(0.75, Math.min(1.25, Number(zoom) / 100));
    camera.updateProjectionMatrix();

    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(4, 8, 6);
    scene.add(light);

    const grid = new THREE.GridHelper(9, 18, 0xbdd8ce, 0xd8e7df);
    grid.position.y = -0.02;
    scene.add(grid);

    const group = new THREE.Group();
    group.rotation.x = -0.12;
    group.rotation.y = THREE.MathUtils.degToRad(Number(rotation) || 0);
    scene.add(group);

    const items = planItemsFromForm(data);
    const totalWidth = items.reduce((sum, item) => sum + Math.max(item.ancho, 1) / 100, 0);
    let cursor = -totalWidth / 2;

    items.forEach((item, index) => {
      const width = Math.max(0.12, item.ancho / 100);
      const height = Math.max(0.12, item.alto / 100);
      const depth = Math.max(0.08, (item.fondo || 8) / 100);
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const itemColor = item.forma === 'Vidrio'
        ? 0xc9eef2
        : item.forma === 'Marco / riel'
          ? 0x8fa4a0
          : item.forma === 'Cajón'
            ? 0xd69b63
            : item.forma === 'Puerta'
              ? 0xe9bd80
              : (index % 2 ? 0xf0c98f : 0xf6dfb5);
      const material = new THREE.MeshStandardMaterial({
        color: data.giro === 'Vidriería' ? (item.forma === 'Vidrio' ? 0xc9eef2 : 0xa8bbb7) : itemColor,
        roughness: 0.58,
        metalness: data.giro === 'Vidriería' ? 0.14 : 0.04,
        transparent: item.forma === 'Vidrio',
        opacity: item.forma === 'Vidrio' ? 0.48 : 1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const hasCustomPosition = item.posX !== '' || item.posY !== '' || item.posZ !== '';
      mesh.position.set(
        hasCustomPosition ? numberValue(item.posX) / 100 : cursor + width / 2,
        hasCustomPosition ? Math.max(0.02, numberValue(item.posY) / 100) : height / 2,
        hasCustomPosition ? numberValue(item.posZ) / 100 : 0,
      );
      group.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: data.giro === 'Vidriería' ? 0x2b7580 : 0x5f4630 }),
      );
      edges.position.copy(mesh.position);
      group.add(edges);

      if (!hasCustomPosition) cursor += width + 0.16;
    });

    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    group.position.x -= center.x;

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      const safeWidth = Math.max(320, width);
      const safeHeight = Math.max(280, height);
      renderer.setSize(safeWidth, safeHeight, false);
      const aspect = safeWidth / safeHeight;
      camera.left = -3.8 * aspect;
      camera.right = 3.8 * aspect;
      camera.top = 3;
      camera.bottom = -3;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    let dragging = false;
    let lastX = 0;
    const render = () => renderer.render(scene, camera);
    const onPointerDown = (event) => {
      dragging = true;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!dragging) return;
      group.rotation.y += (event.clientX - lastX) * 0.01;
      lastX = event.clientX;
      render();
    };
    const onPointerUp = () => {
      dragging = false;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerUp);

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    return () => {
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerUp);
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [data, rotation, zoom]);

  return (
    <div className="plan-canvas-3d" ref={mountRef} role="img" aria-label="Modelo 3D editable del plano">
      <span>Cargando vista 3D</span>
    </div>
  );
}

function refreshInstalledApp() {
  const clearCaches = 'caches' in window
    ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    : Promise.resolve();
  const clearWorkers = 'serviceWorker' in navigator
    ? navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    : Promise.resolve();

  Promise.all([clearCaches, clearWorkers]).finally(() => {
    window.location.href = `${window.location.origin}${window.location.pathname}?v=${APP_VERSION_QUERY}`;
  });
}

function App() {
  const [form, setForm] = useState(defaults);
  const [catalog, setCatalog] = useState(loadCatalog);
  const [history, setHistory] = useState(loadHistory);
  const [legacyRecoveredCount, setLegacyRecoveredCount] = useState(0);
  const [copied, setCopied] = useState('');
  const [largeText, setLargeText] = useState(false);
  const [activeSection, setActiveSection] = useState('inicio');
  const [syncStatus, setSyncStatus] = useState('Historial local');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [planView, setPlanView] = useState('3d');
  const [planRotation, setPlanRotation] = useState(0);
  const [planZoom, setPlanZoom] = useState(100);
  const [typeDetails, setTypeDetails] = useState(loadTypeDetails);
  const [appLogo, setAppLogo] = useState(loadAppLogo);
  const [floatingSummary, setFloatingSummary] = useState({ x: 24, y: 120, compact: false, minimized: false });
  const [quickCalc, setQuickCalc] = useState({ materialId: '', nombre: 'Melamina', categoria: 'Madera/Melamina', tipoCompra: 'hoja', baseUso: 'medidas', ancho: 122, alto: 244, largo: 100, cantidad: 1, precioTotal: 1200, areaManual: 0, linealManual: 0, cantidadManual: 1, merma: 8, margen: 35 });
  const [pdfEditor, setPdfEditor] = useState(null);

  const quote = useMemo(() => calculateQuote(form), [form]);
  const dataHealth = useMemo(() => quoteDataHealth(form, quote), [form, quote]);
  const materials = useMemo(() => generateMaterials(form, quote), [form, quote]);
  const outputs = useMemo(() => generateOutputs(form, quote), [form, quote]);
  const roleCards = useMemo(() => workRoleCards(form, quote), [form, quote]);
  const professionalAnalysis = useMemo(() => quoteProfessionalAnalysis(form, quote), [form, quote]);
  const chainInsights = useMemo(() => professionalChainInsights(quote), [quote]);
  const score = countScore(form);
  const mainOutput = outputs[0];
  const quoteOutput = outputs[1];
  const currentTypeOptions = typeOptionsFor(form.giro, typeDetails);
  const quickCantidad = Math.max(1, positiveNumber(quickCalc.cantidad) || 1);
  const quickPrecioUnidadCompra = positiveNumber(quickCalc.precioTotal) / quickCantidad;
  const quickAreaPorPieza = (positiveNumber(quickCalc.ancho) / 100) * (positiveNumber(quickCalc.alto) / 100);
  const quickArea = quickAreaPorPieza * quickCantidad;
  const quickLinear = (positiveNumber(quickCalc.largo) / 100) * quickCantidad;
  const quickCostoM2 = quickArea > 0 ? positiveNumber(quickCalc.precioTotal) / quickArea : 0;
  const quickCostoLineal = quickLinear > 0 ? positiveNumber(quickCalc.precioTotal) / quickLinear : 0;
  const quickCostoUnitario = quickCalc.tipoCompra === 'lineal' ? quickCostoLineal : quickCalc.tipoCompra === 'pieza' || quickCalc.tipoCompra === 'manual' ? quickPrecioUnidadCompra : quickCostoM2;
  const quickPricing = priceRule(quickCostoUnitario, quickCalc.merma, quickCalc.margen);
  const quickAreaNecesaria = quickCalc.baseUso === 'manual' ? positiveNumber(quickCalc.areaManual) : quote.areaTotal;
  const quickLinealNecesario = quickCalc.baseUso === 'manual' ? positiveNumber(quickCalc.linealManual) : quote.linearTotal;
  const quickCantidadNecesaria = quickCalc.baseUso === 'manual' ? Math.max(1, positiveNumber(quickCalc.cantidadManual) || 1) : Math.max(1, quote.cantidad || 1);
  const quickFactorMerma = 1 + percentValue(quickCalc.merma) / 100;
  const quickHojasComprar = quickAreaPorPieza > 0 ? Math.ceil((quickAreaNecesaria * quickFactorMerma) / quickAreaPorPieza) : 0;
  const quickPiezasComprar = Math.ceil(quickCantidadNecesaria * quickFactorMerma);
  const quickCompraSinMerma = quickCalc.tipoCompra === 'lineal' ? quickLinealNecesario * quickCostoLineal : quickCalc.tipoCompra === 'pieza' || quickCalc.tipoCompra === 'manual' ? quickCantidadNecesaria * quickCostoUnitario : quickAreaNecesaria * quickCostoM2;
  const quickCompraConMerma = quickCalc.tipoCompra === 'hoja' ? quickHojasComprar * quickPrecioUnidadCompra : quickCalc.tipoCompra === 'lineal' ? quickLinealNecesario * quickFactorMerma * quickCostoLineal : quickPiezasComprar * quickCostoUnitario;
  const quickTotalClienteSinMargen = quickCompraSinMerma * quickFactorMerma;
  const quickTotalClienteConMargen = quickCalc.tipoCompra === 'lineal' ? quickLinealNecesario * quickPricing.precioCliente : quickCalc.tipoCompra === 'pieza' || quickCalc.tipoCompra === 'manual' ? quickCantidadNecesaria * quickPricing.precioCliente : quickAreaNecesaria * quickPricing.precioCliente;
  const quickProfit = quickTotalClienteConMargen - quickCompraConMerma;
  const quickProfitPercent = quickCompraConMerma > 0 ? (quickProfit / quickCompraConMerma) * 100 : 0;

  const menuItems = [
    { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
    { id: 'anuncio', label: 'Anuncio', icon: Package },
    { id: 'cotizador', label: 'Cotizador', icon: Calculator },
    { id: 'catalogo', label: 'Catálogo', icon: TableProperties },
    { id: 'historial', label: 'Historial', icon: History },
    { id: 'textos', label: 'Textos', icon: Sparkles },
    { id: 'ajustes', label: 'Ajustes', icon: Accessibility },
  ];

  useEffect(() => {
    localStorage.setItem('anunciapro.catalog', JSON.stringify(catalog));
  }, [catalog]);

  useEffect(() => {
    localStorage.setItem('anunciapro.history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('anunciapro.typeDetails', JSON.stringify(typeDetails));
  }, [typeDetails]);

  useEffect(() => {
    try {
      if (appLogo) localStorage.setItem('anunciapro.logo', appLogo);
      else localStorage.removeItem('anunciapro.logo');
    } catch {
      // El logo personalizado es opcional.
    }
  }, [appLogo]);

  async function syncHistory(uploadLocal = false) {
    try {
      if (!navigator.onLine) {
        setSyncStatus('Sin conexión: historial guardado localmente');
        return;
      }

      setSyncStatus('Sincronizando historial...');

      const recoveredLegacyHistory = recoverLegacyHistoryFromLocalStorage();
      if (recoveredLegacyHistory.length > 0) {
        setLegacyRecoveredCount(recoveredLegacyHistory.length);
      }
      const local = loadHistory();
      const remote = await requestHistory();
      const merged = mergeHistoryItems(recoveredLegacyHistory, local, history, remote);

      if (uploadLocal || merged.length !== remote.length) {
        const saved = await requestHistory({
          method: 'PUT',
          body: JSON.stringify({ history: merged }),
        });

        setHistory(saved);
      } else {
        setHistory(merged);
      }

      setLastSyncAt(
        new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );

      setSyncStatus('Historial sincronizado en la nube');
    } catch (error) {
      console.warn('Error de sincronización:', error);
      setSyncStatus('Sin conexión: usando copia local');
    }
  }

  function saveHistoryRemote(nextHistory) {
    if (!navigator.onLine) {
      setSyncStatus('Guardado local; se sincroniza al volver internet');
      return;
    }

    requestHistory({
      method: 'PUT',
      body: JSON.stringify({ history: nextHistory }),
    })
      .then((saved) => {
        setHistory(saved);
        setLastSyncAt(
          new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        setSyncStatus('Historial sincronizado en la nube');
      })
      .catch((error) => {
        console.warn('Guardado local; sincronización pendiente:', error);
        setSyncStatus('Guardado local; se sincroniza al volver internet');
      });
  }

  useEffect(() => {
    syncHistory(true);

    const interval = window.setInterval(() => {
      syncHistory(false);
    }, 15000);

    const onFocus = () => syncHistory(false);
    const onOnline = () => syncHistory(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncHistory(false);
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateMeasure(field, value) {
    setForm((current) => {
      const measureItems = measurementItemsFromForm(current);
      const first = measureItems[0] || normalizeMeasureItem({}, 0, current);
      const nextMeasureItems = [{ ...first, [field]: value }, ...measureItems.slice(1)];
      const next = { ...current, [field]: value, measureItems: nextMeasureItems };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function updateMeasureItem(id, field, value) {
    setForm((current) => {
      const measureItems = measurementItemsFromForm(current).map((item) => (
        item.id === id ? { ...item, [field]: value } : item
      ));
      const first = measureItems[0] || normalizeMeasureItem({}, 0, current);
      const next = {
        ...current,
        measureItems,
        ancho: first.ancho,
        alto: first.alto,
        fondo: first.fondo,
        grosorMaterial: first.grosorMaterial,
        cantidad: first.cantidad,
      };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function addMeasureItem() {
    setForm((current) => {
      const measureItems = [
        ...measurementItemsFromForm(current),
        {
          id: `med-${Date.now()}`,
          nombre: `Medida ${measurementItemsFromForm(current).length + 1}`,
          ancho: current.ancho,
          alto: current.alto,
          fondo: current.fondo,
          grosorMaterial: current.grosorMaterial,
          cantidad: 1,
          nota: '',
        },
      ];
      const next = { ...current, measureItems };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function removeMeasureItem(id) {
    setForm((current) => {
      const measureItems = measurementItemsFromForm(current).filter((item) => item.id !== id);
      const safeItems = measureItems.length ? measureItems : [normalizeMeasureItem({}, 0, current)];
      const first = safeItems[0];
      const next = {
        ...current,
        measureItems: safeItems,
        ancho: first.ancho,
        alto: first.alto,
        fondo: first.fondo,
        grosorMaterial: first.grosorMaterial,
        cantidad: first.cantidad,
      };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function updateMaterialItem(id, field, value) {
    setForm((current) => {
      const areaTotal = quoteAreaTotal(current);
      const materialItems = materialItemsFromForm(current, areaTotal).map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        if (field === 'calculo') {
          next.usarArea = value !== 'manual';
          next.baseCalculo = value === 'area' ? 'medidas_area' : value;
        }
        if (field === 'baseCalculo') {
          next.usarArea = ['medidas_area', 'manual_area', 'lineal'].includes(value);
        }
        if (field === 'tipoCompra') {
          if (value === 'area' || value === 'hoja') next.unidad = 'm²';
          if (value === 'pieza' || value === 'manual') next.unidad = 'pieza';
          if (value === 'lineal') next.unidad = 'metro lineal';
        }
        if (field === 'unidad' && value === 'metro lineal') next.calculo = 'lineal';
        if (field === 'unidad' && value === 'm²') next.calculo = 'area';
        if (field === 'precioUnitario') next.precioManual = true;
        if (['costoUnitario', 'merma', 'margen'].includes(field) && !next.precioManual) {
          next.precioUnitario = Math.round(priceRule(next.costoUnitario, next.merma, next.margen || current.margenMaterial).precioCliente);
        }
        return next;
      });
      return { ...current, materialItems };
    });
  }

  function addMaterialItem() {
    setForm((current) => ({
      ...current,
      materialItems: [
        ...materialItemsFromForm(current, quoteAreaTotal(current)),
        {
          id: `mat-${Date.now()}`,
          nombre: 'Nuevo material',
          unidad: 'pieza',
          usarArea: false,
          calculo: 'manual',
          tipoCompra: 'manual',
          cantidad: 1,
          ancho: 0,
          alto: 0,
          largo: 0,
          grosor: current.grosorMaterial,
          costoUnitario: 0,
          precioUnitario: 0,
          merma: 0,
          margen: current.margenMaterial,
          precioManual: false,
          nota: '',
        },
      ],
    }));
  }

  function removeMaterialItem(id) {
    setForm((current) => {
      const areaTotal = quoteAreaTotal(current);
      const items = materialItemsFromForm(current, areaTotal).filter((item) => item.id !== id);
      return { ...current, materialItems: items.length ? items : [] };
    });
  }

  function applySuggestedPrices() {
    setForm((current) => {
      const areaTotal = quoteAreaTotal(current);
      const currentQuote = calculateQuote(current);
      const materialItems = materialItemsFromForm(current, areaTotal).map((item) => ({
        ...item,
        precioUnitario: Math.round(positiveNumber(item.costoUnitario) * (1 + percentValue(item.merma) / 100) * (1 + positiveNumber(item.margen || current.margenMaterial) / 100)),
      }));
      return {
        ...current,
        precioM2: Math.round(currentQuote.suggestedPriceM2),
        materialItems,
      };
    });
  }

  function applyQuoteProfile(profileKey) {
    const profile = quoteProfiles[profileKey];
    if (!profile) return;
    setForm((current) => {
      const measureItems = profile.measureItems.map((item) => ({ ...item, id: `${item.id}-${Date.now()}` }));
      const materialItems = profile.materialItems.map((item) => ({ ...item, id: `${item.id}-${Date.now()}` }));
      const accessoryItems = profile.accessoryItems.map((item) => ({ ...item, id: `${item.id}-${Date.now()}` }));
      const firstMeasure = measureItems[0];
      const next = {
        ...current,
        ...profile.fields,
        measureItems,
        materialItems,
        accessoryItems,
        ancho: firstMeasure.ancho,
        alto: firstMeasure.alto,
        fondo: firstMeasure.fondo,
        grosorMaterial: firstMeasure.grosorMaterial,
        cantidad: firstMeasure.cantidad,
      };
      return {
        ...next,
        medidas: formatDimensions(next),
      };
    });
  }

  function updateAccessoryItem(id, field, value) {
    setForm((current) => ({
      ...current,
      accessoryItems: accessoryItemsFromForm(current).map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          [field]: value,
          ...(field === 'precioUnitario' ? { precioManual: true } : {}),
        };
        if (['costoUnitario', 'merma', 'margen'].includes(field) && !next.precioManual) {
          next.precioUnitario = Math.round(priceRule(next.costoUnitario, next.merma, next.margen || current.margenMaterial).precioCliente);
        }
        return next;
      }),
    }));
  }

  function addAccessoryItem() {
    setForm((current) => ({
      ...current,
      accessoryItems: [
        ...accessoryItemsFromForm(current),
        {
          id: `acc-${Date.now()}`,
          nombre: 'Nuevo accesorio',
          tipoCompra: 'pieza',
          cantidad: 1,
          costoUnitario: 0,
          precioUnitario: 0,
          merma: 0,
          margen: current.margenMaterial,
          precioManual: false,
          nota: '',
        },
      ],
    }));
  }

  function removeAccessoryItem(id) {
    setForm((current) => {
      const items = accessoryItemsFromForm(current).filter((item) => item.id !== id);
      return { ...current, accessoryItems: items.length ? items : [] };
    });
  }

  function addTypeDetail() {
    setTypeDetails((items) => [
      ...items,
      {
        id: `tipo-${Date.now()}`,
        giro: form.giro,
        tipo: form.giro === 'Vidriería' ? 'Nuevo tipo de vidrio' : 'Nuevo tipo de mueble',
        descripcion: 'Describe cuándo se usa este tipo.',
      },
    ]);
  }

  function updateTypeDetail(id, field, value) {
    setTypeDetails((items) => items.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function removeTypeDetail(id) {
    setTypeDetails((items) => items.filter((item) => item.id !== id));
  }

  function updatePlanItem(id, field, value) {
    setForm((current) => ({
      ...current,
      planItems: planItemsFromForm(current).map((item) => (
        item.id === id ? { ...item, [field]: value } : item
      )),
    }));
  }

  function addPlanItem() {
    setForm((current) => ({
      ...current,
      planItems: [
        ...planItemsFromForm(current),
        {
          id: `plano-${Date.now()}`,
          nombre: 'Nueva pieza',
          forma: 'Pieza vertical',
          ancho: current.ancho,
          alto: current.alto,
          fondo: current.fondo,
          cantidad: 1,
          nota: '',
          posX: '',
          posY: '',
          posZ: '',
        },
      ],
    }));
  }

  function removePlanItem(id) {
    setForm((current) => {
      const items = planItemsFromForm(current).filter((item) => item.id !== id);
      return { ...current, planItems: items.length ? items : [] };
    });
  }

  function syncPlanWithMeasures() {
    setForm((current) => ({
      ...current,
      planItems: [
        {
          id: 'pieza-principal',
          nombre: current.tipoTrabajo || 'Vista principal',
          forma: 'Pieza vertical',
          ancho: numberValue(current.ancho),
          alto: numberValue(current.alto),
          fondo: numberValue(current.fondo),
          cantidad: Math.max(1, numberValue(current.cantidad) || 1),
          nota: 'Medida general del proyecto',
          posX: '',
          posY: '',
          posZ: '',
        },
      ],
    }));
    setActiveSection('plano');
  }

  function applyPlanTemplate(template) {
    setForm((current) => ({
      ...current,
      giro: template.giro,
      tipoTrabajo: template.tipoTrabajo,
      producto: template.tipoTrabajo === 'Cancel'
        ? 'Cancel a medida'
        : template.tipoTrabajo === 'Ventana'
          ? 'Ventana a medida'
          : `${template.label} a medida`,
      planItems: planTemplateData(template.id, current),
    }));
    setPlanView('3d');
    setActiveSection('plano');
  }

  function updateCatalogItem(id, field, value) {
    setCatalog((items) => items.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function addCatalogItem() {
    setCatalog((items) => [
      ...items,
      normalizeCatalogItem({
        id: `cat-${Date.now()}`,
        categoria: form.giro,
        tipoTrabajo: form.tipoTrabajo,
        nombre: form.producto || 'Nuevo producto',
        materialCotizacion: form.materialCotizacion,
        herrajes: form.herrajes,
        unidad: 'm²',
        costo: numberValue(form.costoMaterialM2),
        precio: numberValue(form.precioM2),
        costoHerrajes: numberValue(form.costoHerrajes),
        precioHerrajes: numberValue(form.precioHerrajes),
        merma: numberValue(form.merma),
        manoObra: numberValue(form.manoObra),
        extras: numberValue(form.extras),
      }),
    ]);
  }

  function removeCatalogItem(id) {
    setCatalog((items) => items.filter((item) => item.id !== id));
  }

  function applyCatalogItem(item) {
    const next = {
      ...form,
      giro: item.categoria || form.giro,
      tipoTrabajo: item.tipoTrabajo || form.tipoTrabajo,
      producto: item.nombre || form.producto,
      materialCotizacion: item.materialCotizacion || form.materialCotizacion,
      herrajes: item.herrajes || form.herrajes,
      costoMaterialM2: numberValue(item.costo),
      precioM2: numberValue(item.precio),
      costoHerrajes: numberValue(item.costoHerrajes),
      precioHerrajes: numberValue(item.precioHerrajes),
      merma: numberValue(item.merma),
      manoObra: numberValue(item.manoObra),
      extras: numberValue(item.extras),
    };

    setForm({
      ...next,
      medidas: formatDimensions(next),
    });
    setActiveSection('cotizador');
  }

  function generateQuoteFolio(historyItems = []) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const prefix = `ALX-${y}${m}${d}`;
    const count = normalizeHistory(historyItems).filter((item) => String(item.folio || '').startsWith(prefix)).length + 1;

    return `${prefix}-${String(count).padStart(3, '0')}`;
  }

  function saveToHistory() {
    const now = Date.now();
    const item = {
      id: `hist-${now}`,
      createdAt: now,
      updatedAt: now,
      status: 'Pendiente',
      folio: clean(form.folioManual, generateQuoteFolio(history)),
      estadoCotizacion: clean(form.estadoCotizacion, 'Pendiente'),
      formaPago: clean(form.formaPago, 'Anticipo y saldo contra entrega'),
      notasCliente: clean(form.notasCliente),
      notasInternas: clean(form.notasInternas),
      clienteNombre: clean(form.clienteNombre, 'Cliente'),
      clienteTelefono: clean(form.clienteTelefono),
      producto: clean(form.producto, 'Proyecto a medida'),
      tipoTrabajo: clean(form.tipoTrabajo, 'Trabajo'),
      giro: clean(form.giro, 'Carpintería'),
      total: quote.total,
      anticipo: quote.deposit,
      resto: quote.rest,
      form,
    };

    const nextHistory = mergeHistoryItems([item], history);
    setHistory(nextHistory);
    saveHistoryRemote(nextHistory);
    setSyncStatus('Cotización guardada en historial');
    setActiveSection('historial');
  }

  function loadHistoryItem(item) {
    if (!item?.form) return;
    setForm({ ...defaults, ...item.form });
    setActiveSection('cotizador');
  }

  function removeHistoryItem(id) {
    const nextHistory = normalizeHistory(history.filter((item) => item.id !== id));
    setHistory(nextHistory);
    saveHistoryRemote(nextHistory);
  }

  function exportHistoryBackup() {
    const exportedAt = new Date().toISOString();
    const backup = {
      app: BRAND_NAME,
      type: 'history-backup',
      version: APP_VERSION,
      exportedAt,
      history,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `aluxor-historial-${exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSyncStatus('Respaldo de historial exportado');
  }

  function importHistoryBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const importedHistory = Array.isArray(parsed) ? parsed : parsed?.history;
        if (!Array.isArray(importedHistory)) throw new Error('Formato de respaldo inválido');
        const nextHistory = mergeHistoryItems(importedHistory, history);
        setHistory(nextHistory);
        saveHistoryRemote(nextHistory);
        setSyncStatus('Respaldo de historial importado');
      } catch (error) {
        setSyncStatus(`No se pudo importar respaldo: ${error.message}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      setSyncStatus('No se pudo leer el respaldo');
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  function updateHistoryStatus(id, status) {
    const now = Date.now();
    const nextHistory = normalizeHistory(history.map((item) => (
      item.id === id ? { ...item, status, updatedAt: now } : item
    )));
    setHistory(nextHistory);
    saveHistoryRemote(nextHistory);
  }

  function copyText(text, label = 'Texto') {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(`${label} copiado`);
      window.setTimeout(() => setCopied(''), 1800);
    }).catch(() => {
      setCopied('No se pudo copiar');
      window.setTimeout(() => setCopied(''), 1800);
    });
  }

  function updateQuickCalc(field, value) {
    setQuickCalc((current) => ({ ...current, [field]: ['nombre', 'categoria', 'tipoCompra', 'materialId', 'baseUso'].includes(field) ? value : numberValue(value) }));
  }

  function quickCalcText() {
    return [
      `Material: ${quickCalc.nombre}`,
      `Área total comprada: ${decimal(quickArea)} m²`,
      `Costo real por m²: ${money(quickCostoM2)}`,
      `Costo real por metro lineal: ${money(quickCostoLineal)}`,
      `Costo con merma: ${money(quickPricing.costoConMerma)}`,
      `Precio recomendado: ${money(quickPricing.precioCliente)}`,
    ].join('\n');
  }

  function applyQuickCalcToQuote() {
    setForm((current) => {
      const measureItems = measurementItemsFromForm(current);
      const first = measureItems[0] || normalizeMeasureItem({}, 0, current);
      const nextMeasure = {
        ...first,
        ancho: positiveNumber(quickCalc.ancho),
        alto: positiveNumber(quickCalc.alto),
        cantidad: Math.max(1, positiveNumber(quickCalc.cantidad) || 1),
      };
      const next = {
        ...current,
        ancho: nextMeasure.ancho,
        alto: nextMeasure.alto,
        cantidad: nextMeasure.cantidad,
        measureItems: [nextMeasure, ...measureItems.slice(1)],
      };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function applyQuickCalcToMaterial() {
    setForm((current) => {
      const materialItems = materialItemsFromForm(current, quoteAreaTotal(current));
      const selectedId = quickCalc.materialId;
      const target = materialItems.find((item) => item.id === selectedId);
      const nextItem = {
        ...(target || normalizeMaterialItem({ id: `mat-${Date.now()}`, nombre: quickCalc.nombre }, materialItems.length, current)),
        nombre: clean(quickCalc.nombre, 'Material'),
        categoria: clean(quickCalc.categoria, 'Material'),
        calculo: quickCalc.tipoCompra === 'lineal' ? 'lineal' : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? 'manual' : 'area',
        baseCalculo: quickCalc.baseUso === 'manual'
          ? (quickCalc.tipoCompra === 'lineal' ? 'lineal' : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? 'manual_qty' : 'manual_area')
          : (quickCalc.tipoCompra === 'lineal' ? 'lineal' : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? 'manual_qty' : 'medidas_area'),
        tipoCompra: quickCalc.tipoCompra,
        unidad: quickCalc.tipoCompra === 'lineal' ? 'metro lineal' : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? 'pieza' : 'm²',
        usarArea: ['hoja', 'area', 'lineal'].includes(quickCalc.tipoCompra),
        cantidad: quickCalc.tipoCompra === 'lineal' ? Math.max(1, positiveNumber(quickCalc.largo) || 1) : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? quickCantidadNecesaria : quickCantidad,
        ancho: positiveNumber(quickCalc.ancho),
        alto: positiveNumber(quickCalc.alto),
        largo: positiveNumber(quickCalc.largo),
        costoUnitario: Math.round(quickCalc.tipoCompra === 'hoja' ? quickPrecioUnidadCompra : quickCostoUnitario),
        precioUnitario: Math.round(quickPricing.precioCliente),
        merma: percentValue(quickCalc.merma),
        margen: positiveNumber(quickCalc.margen),
        precioManual: false,
      };
      const nextItems = target
        ? materialItems.map((item) => (item.id === selectedId ? nextItem : item))
        : [nextItem, ...materialItems];
      return {
        ...current,
        costoMaterialM2: Math.round(quickCostoM2 || quickCostoUnitario),
        precioM2: Math.round(quickPricing.precioCliente),
        merma: percentValue(quickCalc.merma),
        margenMaterial: positiveNumber(quickCalc.margen),
        materialItems: nextItems,
      };
    });
  }

  function startSummaryDrag(event) {
    if (event.target.closest('button')) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const start = floatingSummary;
    const onMove = (moveEvent) => {
      setFloatingSummary((current) => ({
        ...current,
        x: Math.max(8, start.x + moveEvent.clientX - startX),
        y: Math.max(8, start.y + moveEvent.clientY - startY),
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function openWhatsApp() {
    const phone = String(form.whatsapp || form.clienteTelefono || '').replace(/\D/g, '');
    const message = encodeURIComponent(`Hola, quiero cotizar ${form.producto || 'un proyecto'} con ALUXOR.`);
    const target = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  function openPrint(mode = 'client') {
    setPdfEditor({ mode, view: mode, doc: professionalDocFromQuote(form, quote) });
  }

  function generateProfessionalPdf(mode = 'client') {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.document.write(quotePrintHtml(form, quote, materials, mode, pdfEditor?.doc, appLogo));
    printWindow.document.close();
    setPdfEditor(null);
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setAppLogo(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  function removeAppLogo() {
    setAppLogo('');
  }

  const input = (field, type = 'text') => (
    <input
      id={field}
      type={type}
      value={form[field] ?? ''}
      onChange={(event) => update(field, type === 'number' ? numberValue(event.target.value) : event.target.value)}
    />
  );

  const textareaInput = (field) => (
    <textarea
      id={field}
      value={form[field] ?? ''}
      onChange={(event) => update(field, event.target.value)}
    />
  );

  return (
    <main className={largeText ? 'app large-text' : 'app'}>
      <aside className="sidebar">
        <div className="brand-card">
          {appLogo ? <img src={appLogo} alt="Logo ALUXOR" className="brand-logo" /> : <div className="brand-mark">A</div>}
          <div>
            <strong>{BRAND_NAME}</strong>
            <span>Cotizador profesional</span>
          </div>
        </div>

        <nav className="menu" aria-label="Secciones principales">
          {menuItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeSection === id ? 'active' : ''}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <button type="button" className={activeSection === 'plano' ? 'active' : ''} onClick={() => setActiveSection('plano')}>
            <Box size={18} />
            Plano 3D
          </button>
        </nav>

        <div className="sidebar-total">
          <span>Total estimado</span>
          <strong>{money(quote.total)}</strong>
          <small>Utilidad: {money(quote.profit)}</small>
        </div>

        <div className="sync-card">
          <RefreshCw size={18} />
          <div>
            <strong>{syncStatus}</strong>
            <span>{lastSyncAt ? `Última sincronización: ${lastSyncAt}` : 'Historial local y nube'}</span>
          </div>
        </div>

        <button type="button" className="access-button" onClick={() => setLargeText((value) => !value)}>
          <Accessibility size={18} />
          Letra grande
        </button>
        <button type="button" className="ghost" onClick={refreshInstalledApp}>
          <RefreshCw size={18} />
          Actualizar app
        </button>
      </aside>

      <section className="content">
        <header className="hero">
          <div>
            <p className="eyebrow">Versión {APP_VERSION}</p>
            <div className="hero-brand-line">
              {appLogo ? <img src={appLogo} alt="Logo ALUXOR/BosqueReal" className="hero-logo" /> : null}
              <h1>ALUXOR/BosqueReal</h1>
            </div>
            <p>Cotizador profesional, anuncios, catálogo, historial sincronizado, planos SVG, vista 3D y PWA móvil.</p>
          </div>
          <div className="hero-actions">
            <button type="button" className="ghost" onClick={refreshInstalledApp}><RefreshCw size={18} /> Actualizar app</button>
            <button type="button" className="ghost" onClick={() => syncHistory(true)}><History size={18} /> Restaurar</button>
            <button type="button" className="ghost" onClick={() => setActiveSection('textos')}><FileText size={18} /> Ver textos</button>
            <button type="button" onClick={openWhatsApp}><MessageCircle size={18} /> WhatsApp</button>
            <button type="button" onClick={() => openPrint('client')}><FileText size={18} /> PDF</button>
          </div>
        </header>

        {activeSection === 'inicio' && (
          <section className="panel-grid">
            {ejemplos.map(({ name, icon: Icon, data }) => (
              <button
                key={name}
                type="button"
                className="feature-card"
                onClick={() => {
                  setForm({ ...defaults, ...data });
                  setActiveSection('cotizador');
                }}
              >
                <Icon size={24} />
                <strong>{name}</strong>
                <span>Cargar ejemplo</span>
              </button>
            ))}

            {roleCards.map((card) => (
              <article key={card.title} className="panel">
                <h3>{card.title}</h3>
                <ul>
                  {card.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            ))}
          </section>
        )}

        {activeSection === 'anuncio' && (
          <section className="panel-grid two-cols">
            <article className="panel">
              <h2>Datos del anuncio</h2>
              <div className="form-grid">
                <Field id="giro" label="Giro">
                  <select id="giro" value={form.giro} onChange={(event) => update('giro', event.target.value)}>
                    <option>Carpintería</option>
                    <option>Vidriería</option>
                  </select>
                </Field>
                <Field id="tipoTrabajo" label="Tipo de trabajo" {...guideFor('tipoTrabajo')}>
                  <select id="tipoTrabajo" value={form.tipoTrabajo} onChange={(event) => update('tipoTrabajo', event.target.value)}>
                    {currentTypeOptions.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field id="producto" label="Producto" {...guideFor('producto')}>{input('producto')}</Field>
                <Field id="material" label="Material" {...guideFor('material')}>{input('material')}</Field>
                <Field id="acabado" label="Acabado">{input('acabado')}</Field>
                <Field id="ciudad" label="Ciudad">{input('ciudad')}</Field>
                <Field id="whatsapp" label="WhatsApp" {...guideFor('whatsapp')}>{input('whatsapp')}</Field>
                <Field id="beneficio" label="Beneficio">{textareaInput('beneficio')}</Field>
                <Field id="incluye" label="Incluye">{textareaInput('incluye')}</Field>
                <Field id="promocion" label="Promoción">{input('promocion')}</Field>
                <Field id="tono" label="Tono">
                  <select id="tono" value={form.tono} onChange={(event) => update('tono', event.target.value)}>
                    {Object.entries(tonos).map(([key, tone]) => <option key={key} value={key}>{tone.title}</option>)}
                  </select>
                </Field>
              </div>
            </article>

            <article className="panel output-card">
              <h2>{mainOutput.name}</h2>
              <p>{mainOutput.description}</p>
              <textarea readOnly value={mainOutput.text} />
              <button type="button" onClick={() => copyText(mainOutput.text, mainOutput.name)}>
                <Copy size={18} /> Copiar anuncio
              </button>
            </article>
          </section>
        )}

        {activeSection === 'cotizador' && (
          <section className="quote-workspace panel-grid two-cols">
            <article className="panel quote-editor">
              <div className="section-head quote-head">
                <div>
                  <h2>Cotizador profesional</h2>
                  <p>Captura por secciones, con medidas y materiales listos para editar.</p>
                </div>
              </div>
              <div className="actions compact">
                {Object.keys(quoteProfiles).map((key) => (
                  <button key={key} type="button" className="ghost" onClick={() => applyQuoteProfile(key)}>
                    {quoteProfiles[key].title}
                  </button>
                ))}
              </div>

              <details className="quote-accordion quick-calculator" open>
                <DashboardSummary number="03" title="Calculadora rápida de material" description="Herramienta de referencia, no suma hasta aplicar." status="Herramienta" highlight />
                <div className="form-grid">
                  <Field id="quickNombre" label="Nombre del material"><input id="quickNombre" value={quickCalc.nombre} onChange={(event) => updateQuickCalc('nombre', event.target.value)} /></Field>
                  <Field id="quickCategoria" label="Categoría">
                    <select id="quickCategoria" value={quickCalc.categoria} onChange={(event) => updateQuickCalc('categoria', event.target.value)}>
                      <option>Vidrio</option>
                      <option>Aluminio</option>
                      <option>Madera/Melamina</option>
                      <option>Herraje</option>
                      <option>Otro</option>
                    </select>
                  </Field>
                  <Field id="quickTipoCompra" label="Tipo de compra">
                    <select id="quickTipoCompra" value={quickCalc.tipoCompra} onChange={(event) => updateQuickCalc('tipoCompra', event.target.value)}>
                      <option value="hoja">Hoja / placa</option>
                      <option value="pieza">Pieza</option>
                      <option value="area">Metro cuadrado</option>
                      <option value="lineal">Metro lineal</option>
                      <option value="manual">Manual</option>
                    </select>
                  </Field>
                  <Field id="quickMaterialId" label="Material destino">
                    <select id="quickMaterialId" value={quickCalc.materialId} onChange={(event) => updateQuickCalc('materialId', event.target.value)}>
                      <option value="">Crear nuevo</option>
                      {materialItemsFromForm(form, quote.areaTotal).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </Field>
                  <Field id="quickBaseUso" label="Usar base">
                    <select id="quickBaseUso" value={quickCalc.baseUso} onChange={(event) => updateQuickCalc('baseUso', event.target.value)}>
                      <option value="medidas">Automático de medidas</option>
                      <option value="manual">Captura manual</option>
                    </select>
                  </Field>
                  <Field id="quickAncho" label="Ancho cm"><input id="quickAncho" type="number" value={quickCalc.ancho} onChange={(event) => updateQuickCalc('ancho', event.target.value)} /></Field>
                  <Field id="quickAlto" label="Alto cm"><input id="quickAlto" type="number" value={quickCalc.alto} onChange={(event) => updateQuickCalc('alto', event.target.value)} /></Field>
                  <Field id="quickLargo" label="Largo cm"><input id="quickLargo" type="number" value={quickCalc.largo} onChange={(event) => updateQuickCalc('largo', event.target.value)} /></Field>
                  <Field id="quickCantidad" label="Cantidad comprada"><input id="quickCantidad" type="number" value={quickCalc.cantidad} onChange={(event) => updateQuickCalc('cantidad', event.target.value)} /></Field>
                  <Field id="quickPrecioTotal" label="Precio total de compra"><input id="quickPrecioTotal" type="number" value={quickCalc.precioTotal} onChange={(event) => updateQuickCalc('precioTotal', event.target.value)} /></Field>
                  <Field id="quickAreaManual" label="Área necesaria manual"><input id="quickAreaManual" type="number" value={quickCalc.areaManual} onChange={(event) => updateQuickCalc('areaManual', event.target.value)} /></Field>
                  <Field id="quickLinealManual" label="ML necesarios manual"><input id="quickLinealManual" type="number" value={quickCalc.linealManual} onChange={(event) => updateQuickCalc('linealManual', event.target.value)} /></Field>
                  <Field id="quickCantidadManual" label="Cantidad necesaria manual"><input id="quickCantidadManual" type="number" value={quickCalc.cantidadManual} onChange={(event) => updateQuickCalc('cantidadManual', event.target.value)} /></Field>
                  <Field id="quickMerma" label="Merma %"><input id="quickMerma" type="number" value={quickCalc.merma} onChange={(event) => updateQuickCalc('merma', event.target.value)} /></Field>
                  <Field id="quickMargen" label="Margen %"><input id="quickMargen" type="number" value={quickCalc.margen} onChange={(event) => updateQuickCalc('margen', event.target.value)} /></Field>
                </div>
                <div className="quick-result-groups">
                  <section>
                    <h3>Costo interno sin venta</h3>
                    <div className="quick-results">
                      <div><span>Área por hoja/pieza</span><strong>{decimal(quickAreaPorPieza)} m²</strong></div>
                      <div><span>Costo real por m²</span><strong>{money(quickCostoM2)}</strong></div>
                      <div><span>Costo real por ML</span><strong>{money(quickCostoLineal)}</strong></div>
                      <div><span>Hojas/piezas a comprar</span><strong>{quickCalc.tipoCompra === 'hoja' ? quickHojasComprar : quickPiezasComprar}</strong></div>
                      <div><span>Total sin merma</span><strong>{money(quickCompraSinMerma)}</strong></div>
                      <div><span>Total con merma</span><strong>{money(quickCompraConMerma)}</strong></div>
                    </div>
                  </section>
                  <section>
                    <h3>Precio sugerido al cliente</h3>
                    <div className="quick-results">
                      <div><span>Precio m² sin margen</span><strong>{money(quickPricing.costoConMerma)}</strong></div>
                      <div><span>Precio m² con margen</span><strong>{money(quickPricing.precioCliente)}</strong></div>
                      <div><span>Precio ML con margen</span><strong>{money(quickCalc.tipoCompra === 'lineal' ? quickPricing.precioCliente : 0)}</strong></div>
                      <div><span>Total sin margen</span><strong>{money(quickTotalClienteSinMargen)}</strong></div>
                      <div><span>Total con margen</span><strong>{money(quickTotalClienteConMargen)}</strong></div>
                      <div><span>Utilidad</span><strong>{money(quickProfit)} ({decimal(quickProfitPercent, 1)}%)</strong></div>
                    </div>
                  </section>
                </div>
                <details className="field-help calc-help">
                  <summary>¿Cómo se calculó?</summary>
                  <span>Se multiplica ancho x alto para obtener m² por hoja.</span>
                  <span>Se multiplica por cantidad comprada.</span>
                  <span>Se divide precio total entre m² totales.</span>
                  <span>Se aplica merma.</span>
                  <span>Se aplica margen para obtener precio al cliente.</span>
                </details>
                <div className="actions compact">
                  <button type="button" className="ghost" onClick={() => copyText(quickCalcText(), 'Calculadora de costo')}><Copy size={18} /> Copiar</button>
                  <button type="button" className="ghost" onClick={applyQuickCalcToMaterial}>Aplicar a material</button>
                </div>
              </details>

              <div className="quote-accordion-list">
                <details className="quote-accordion" open>
                  <DashboardSummary number="01" title="Cliente y proyecto" description="Datos básicos para identificar la cotización." status={form.clienteNombre ? 'Completo' : 'Incompleto'} />
                  <div className="form-grid">
                    <Field id="clienteNombre" label="Cliente" {...guideFor('clienteNombre')}>{input('clienteNombre')}</Field>
                    <Field id="clienteTelefono" label="Teléfono" {...guideFor('clienteTelefono')}>{input('clienteTelefono')}</Field>
                    <Field id="ciudad" label="Ciudad">{input('ciudad')}</Field>
                    <Field id="whatsapp" label="WhatsApp">{input('whatsapp')}</Field>
                  </div>
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="01B" title="Proyecto / diseño" description="Producto, tipo de trabajo y acabado." status={form.producto ? 'Completo' : 'Revisar'} />
                  <div className="form-grid">
                    <Field id="giro" label="Giro">{input('giro')}</Field>
                    <Field id="tipoTrabajo" label="Tipo de trabajo">
                      <select id="tipoTrabajo" value={form.tipoTrabajo} onChange={(event) => update('tipoTrabajo', event.target.value)}>
                        {currentTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </Field>
                    <Field id="producto" label="Producto" {...guideFor('producto')}>{input('producto')}</Field>
                    <Field id="material" label="Diseño / acabado base">{input('material')}</Field>
                    <Field id="acabado" label="Acabado">{input('acabado')}</Field>
                    <Field id="beneficio" label="Beneficio">{textareaInput('beneficio')}</Field>
                  </div>
                </details>

                <details className="quote-accordion" open>
                  <DashboardSummary number="02" title="Medidas del trabajo" description="Área, metro lineal y piezas del proyecto." status={quote.areaTotal > 0 ? 'Completo' : 'Revisar'} highlight />
                  <div className="quick-results measure-totals">
                    <div><span>Área total del proyecto</span><strong>{decimal(quote.areaTotal)} m²</strong></div>
                    <div><span>Metro lineal total</span><strong>{decimal(quote.linearTotal)} m</strong></div>
                    <div><span>Cantidad total de piezas</span><strong>{decimal(quote.cantidad, 0)}</strong></div>
                  </div>
                  <CalculationChain
                    title="Cálculo de medidas"
                    steps={[
                      { title: 'Área por pieza', input: `${quote.measureRows[0]?.ancho || 0} cm x ${quote.measureRows[0]?.alto || 0} cm`, operation: '(ancho / 100) x (alto / 100)', result: `${decimal(quote.measureRows[0]?.area || 0)} m²`, next: 'Área total del proyecto' },
                      { title: 'Área total del proyecto', input: `${quote.measureRows.length} partida(s)`, operation: 'Suma de área por pieza x cantidad.', result: `${decimal(quote.areaTotal)} m²`, next: 'Metro lineal total' },
                      { title: 'Metro lineal total', input: 'Ancho + alto por partida', operation: '((ancho + alto) x 2 / 100) x cantidad.', result: `${decimal(quote.linearTotal)} m`, next: 'Cantidad total' },
                      { title: 'Cantidad total', input: 'Cantidad de cada partida', operation: 'Suma de cantidades capturadas.', result: `${decimal(quote.cantidad, 0)} pieza(s)`, next: 'Materiales' },
                    ]}
                  />
                  <div className="quote-table quote-measures-table">
                    <div className="quote-table-header">Nombre</div>
                    <div className="quote-table-header">Ancho</div>
                    <div className="quote-table-header">Alto</div>
                    <div className="quote-table-header">Fondo</div>
                    <div className="quote-table-header">Cantidad</div>
                    <div className="quote-table-header">Área</div>
                    <div className="quote-table-header">Metro lineal</div>
                    <div className="quote-table-header">Subtotal</div>
                    <div className="quote-table-header">Borrar</div>
                    {quote.measureRows.map((item) => (
                      <div key={item.id} className="quote-table-row quote-measure-row">
                        <input value={item.nombre} onChange={(event) => updateMeasureItem(item.id, 'nombre', event.target.value)} aria-label="Nombre de medida" />
                        <input type="number" value={item.ancho} onChange={(event) => updateMeasureItem(item.id, 'ancho', numberValue(event.target.value))} aria-label="Ancho" />
                        <input type="number" value={item.alto} onChange={(event) => updateMeasureItem(item.id, 'alto', numberValue(event.target.value))} aria-label="Alto" />
                        <input type="number" value={item.fondo} onChange={(event) => updateMeasureItem(item.id, 'fondo', numberValue(event.target.value))} aria-label="Fondo" />
                        <input type="number" value={item.cantidad} onChange={(event) => updateMeasureItem(item.id, 'cantidad', numberValue(event.target.value))} aria-label="Cantidad" />
                        <strong>{decimal(item.areaTotal)} m²</strong>
                        <strong>{decimal(item.linearTotal)} m</strong>
                        <strong>{decimal(item.areaTotal)} m²</strong>
                        <button type="button" className="ghost" onClick={() => removeMeasureItem(item.id)} aria-label="Eliminar medida"><Eraser size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="ghost add-row-button" onClick={addMeasureItem}>Agregar medida</button>
                </details>

                <details className="quote-accordion" open>
                  <DashboardSummary number="04" title="Materiales de cotización" description="Compra, merma, margen y utilidad por material." status={quote.material > 0 ? 'Completo' : 'Revisar'} highlight />
                  <div className="form-grid material-base-grid">
                    <Field id="materialCotizacion" label="Material cotización" {...guideFor('materialCotizacion')}>{input('materialCotizacion')}</Field>
                    <Field id="precioM2" label="Precio m²" {...guideFor('precioM2')}>{input('precioM2', 'number')}</Field>
                    <Field id="costoMaterialM2" label="Costo m²" {...guideFor('costoMaterialM2')}>{input('costoMaterialM2', 'number')}</Field>
                    <Field id="merma" label="Merma %" {...guideFor('merma')}>{input('merma', 'number')}</Field>
                    <Field id="margenMaterial" label="Margen %" {...guideFor('margenMaterial')}>{input('margenMaterial', 'number')}</Field>
                  </div>
                  <div className="quote-table quote-materials-table">
                    <div className="quote-table-header">Material</div>
                    <div className="quote-table-header">Categoría</div>
                    <div className="quote-table-header">Compra</div>
                    <div className="quote-table-header">Base</div>
                    <div className="quote-table-header">Área/ml/cant.</div>
                    <div className="quote-table-header">Medida compra</div>
                    <div className="quote-table-header">Merma %</div>
                    <div className="quote-table-header">Margen %</div>
                    <div className="quote-table-header">Cantidad a comprar</div>
                    <div className="quote-table-header">Costo interno</div>
                    <div className="quote-table-header">Cliente</div>
                    <div className="quote-table-header">Utilidad</div>
                    <div className="quote-table-header">Borrar</div>
                    {quote.materialRows.map((item) => (
                      <div key={item.id} className="quote-table-row quote-material-row">
                        <input value={item.nombre} onChange={(event) => updateMaterialItem(item.id, 'nombre', event.target.value)} aria-label="Material" />
                        <select value={item.categoria} onChange={(event) => updateMaterialItem(item.id, 'categoria', event.target.value)} aria-label="Categoría">
                          <option>Vidrio</option>
                          <option>Aluminio</option>
                          <option>Madera/Melamina</option>
                          <option>Herraje</option>
                          <option>Otro</option>
                        </select>
                        <select value={item.tipoCompra} onChange={(event) => updateMaterialItem(item.id, 'tipoCompra', event.target.value)} aria-label="Tipo de compra">
                          <option value="manual">Manual</option>
                          <option value="pieza">Pieza</option>
                          <option value="area">m²</option>
                          <option value="lineal">Metro lineal</option>
                          <option value="hoja">Hoja / placa</option>
                        </select>
                        <select value={item.baseCalculo} onChange={(event) => updateMaterialItem(item.id, 'baseCalculo', event.target.value)} aria-label="Base de cálculo">
                          <option value="medidas_area">Área total de medidas</option>
                          <option value="manual_area">Área manual</option>
                          <option value="lineal">Metro lineal</option>
                          <option value="manual_qty">Cantidad manual</option>
                        </select>
                        <strong>{decimal(item.rowQuantity)} {item.unidad}</strong>
                        <div className="measure-purchase">
                          <input type="number" value={item.ancho} onChange={(event) => updateMaterialItem(item.id, 'ancho', numberValue(event.target.value))} aria-label="Ancho compra" />
                          <input type="number" value={item.alto} onChange={(event) => updateMaterialItem(item.id, 'alto', numberValue(event.target.value))} aria-label="Alto compra" />
                          <input type="number" value={item.largo} onChange={(event) => updateMaterialItem(item.id, 'largo', numberValue(event.target.value))} aria-label="Largo compra" />
                        </div>
                        <input type="number" value={item.merma} onChange={(event) => updateMaterialItem(item.id, 'merma', numberValue(event.target.value))} aria-label="Merma" />
                        <input type="number" value={item.rowMargin} onChange={(event) => updateMaterialItem(item.id, 'margen', numberValue(event.target.value))} aria-label="Margen" />
                        <strong>{item.tipoCompra === 'hoja' ? `${item.hojasNecesarias} hoja(s)` : item.tipoCompra === 'lineal' ? `${decimal(item.metrosNecesarios)} m` : `${item.piezasNecesarias || decimal(item.rowQuantity, 0)} pza(s)`}</strong>
                        <strong>{money(item.costTotal)}</strong>
                        <strong>{money(item.saleTotal)}</strong>
                        <strong>{money(item.marginAmount)}</strong>
                        <button type="button" className="ghost" onClick={() => removeMaterialItem(item.id)} aria-label="Eliminar material"><Eraser size={16} /></button>
                        <CalculationChain
                          title={`Ver cálculo: ${item.nombre}`}
                          steps={[
                            { title: 'Base usada', input: item.baseCalculo, operation: 'Se toma área, lineal o cantidad según la base.', result: `${decimal(item.rowQuantity)} ${item.unidad}`, next: 'Merma' },
                            { title: 'Merma', input: `${decimal(item.rowQuantity)} con ${decimal(item.merma, 1)}%`, operation: `base x (1 + ${decimal(item.merma, 1)} / 100)`, result: item.tipoCompra === 'hoja' ? `${decimal(item.areaConMerma)} m²` : item.tipoCompra === 'lineal' ? `${decimal(item.largoConMerma)} m` : `${decimal(item.cantidadConMerma)} pza(s)`, next: item.tipoCompra === 'hoja' ? 'Área por hoja' : 'Costo interno' },
                            item.tipoCompra === 'hoja' ? { title: 'Área por hoja', input: `${item.ancho} cm x ${item.alto} cm`, operation: '(ancho / 100) x (alto / 100)', result: `${decimal(item.areaHoja)} m²`, next: 'Hojas necesarias' } : null,
                            item.tipoCompra === 'hoja' ? { title: 'Hojas necesarias', input: `${decimal(item.areaConMerma)} m² / ${decimal(item.areaHoja)} m²`, operation: 'Se redondea hacia arriba.', result: `${item.hojasNecesarias} hoja(s)`, next: 'Costo interno' } : null,
                            { title: 'Costo interno', input: item.tipoCompra === 'hoja' ? `${item.hojasNecesarias} x ${money(item.costoUnitario)}` : `${decimal(item.rowQuantity)} x ${money(item.costoUnitario)} + merma`, operation: 'Cantidad comprada x costo unitario.', result: money(item.costTotal), next: 'Margen' },
                            { title: 'Margen', input: `${decimal(item.rowMargin, 1)}%`, operation: 'Costo interno real x margen = precio cliente', result: `${money(item.precioCliente)} por unidad base`, next: 'Precio cliente' },
                            { title: 'Precio cliente', input: `${decimal(item.rowQuantity)} x ${money(item.precioCliente)}`, operation: 'Base usada x precio unitario cliente.', result: money(item.saleTotal), next: 'Utilidad' },
                            { title: 'Utilidad', input: `${money(item.saleTotal)} - ${money(item.costTotal)}`, operation: 'Precio cliente - costo interno.', result: money(item.marginAmount), next: 'Resumen' },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                  <button type="button" className="ghost add-row-button" onClick={addMaterialItem}>Agregar material</button>
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="05" title="Herrajes y accesorios" description="Accesorios, juegos, piezas y margen." status={quote.hardwareSale > 0 ? 'Completo' : 'Revisar'} />
                  <div className="quote-table quote-accessories-table">
                    <div className="quote-table-header">Accesorio</div>
                    <div className="quote-table-header">Tipo</div>
                    <div className="quote-table-header">Cantidad</div>
                    <div className="quote-table-header">Merma %</div>
                    <div className="quote-table-header">Margen %</div>
                    <div className="quote-table-header">Costo unit.</div>
                    <div className="quote-table-header">Precio unit.</div>
                    <div className="quote-table-header">Total costo</div>
                    <div className="quote-table-header">Total cliente</div>
                    <div className="quote-table-header">Borrar</div>
                    {quote.accessoryRows.map((item) => (
                      <div key={item.id} className="quote-table-row quote-accessory-row">
                        <input value={item.nombre} onChange={(event) => updateAccessoryItem(item.id, 'nombre', event.target.value)} aria-label="Accesorio" />
                        <select value={item.tipoCompra} onChange={(event) => updateAccessoryItem(item.id, 'tipoCompra', event.target.value)} aria-label="Tipo de accesorio">
                          <option value="pieza">Pieza</option>
                          <option value="juego">Juego</option>
                          <option value="manual">Manual</option>
                        </select>
                        <input type="number" value={item.cantidad} onChange={(event) => updateAccessoryItem(item.id, 'cantidad', numberValue(event.target.value))} aria-label="Cantidad" />
                        <input type="number" value={item.merma} onChange={(event) => updateAccessoryItem(item.id, 'merma', numberValue(event.target.value))} aria-label="Merma" />
                        <input type="number" value={item.rowMargin} onChange={(event) => updateAccessoryItem(item.id, 'margen', numberValue(event.target.value))} aria-label="Margen" />
                        <input type="number" value={item.costoUnitario} onChange={(event) => updateAccessoryItem(item.id, 'costoUnitario', numberValue(event.target.value))} aria-label="Costo unitario" />
                        <input type="number" value={item.precioManual ? item.precioUnitario : Math.round(item.precioCliente)} onChange={(event) => updateAccessoryItem(item.id, 'precioUnitario', numberValue(event.target.value))} aria-label="Precio unitario" />
                        <strong>{money(item.costTotal)}</strong>
                        <strong>{money(item.saleTotal)}</strong>
                        <button type="button" className="ghost" onClick={() => removeAccessoryItem(item.id)} aria-label="Eliminar accesorio"><Eraser size={16} /></button>
                        <CalculationChain
                          title={`¿Cómo se calculó ${item.nombre}?`}
                          steps={[
                            { title: 'Cantidad', input: `${decimal(item.rowQuantity, 0)} ${item.tipoCompra}`, operation: 'Cantidad capturada.', result: `${decimal(item.rowQuantity, 0)} pza(s)`, next: 'Costo unitario' },
                            { title: 'Costo unitario', input: money(item.costoUnitario), operation: 'Costo proveedor por unidad.', result: money(item.costoUnitario), next: 'Costo total' },
                            { title: 'Costo total', input: `${decimal(item.rowQuantity, 0)} x ${money(item.costoUnitario)}`, operation: 'Cantidad x costo con merma.', result: money(item.costTotal), next: 'Margen' },
                            { title: 'Margen', input: `${decimal(item.rowMargin, 1)}%`, operation: 'Costo interno real x margen = precio cliente', result: money(item.precioCliente), next: 'Precio cliente' },
                            { title: 'Precio cliente', input: `${decimal(item.rowQuantity, 0)} x ${money(item.precioCliente)}`, operation: 'Cantidad x precio unitario.', result: money(item.saleTotal), next: 'Resumen' },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                  <button type="button" className="ghost add-row-button" onClick={addAccessoryItem}>Agregar accesorio</button>
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="06" title="Mano de obra" description="Servicio de fabricación e instalación." status={quote.manoObra > 0 ? 'Completo' : 'Revisar'} />
                  <div className="form-grid">
                    <Field id="manoObra" label="Mano de obra" {...guideFor('manoObra')}>{input('manoObra', 'number')}</Field>
                    <Field id="incluye" label="Incluye">{textareaInput('incluye')}</Field>
                    <Field id="entrega" label="Entrega">{input('entrega')}</Field>
                  </div>
                  <CalculationChain
                    title="Cadena de mano de obra"
                    steps={[
                      { title: 'Horas', input: 'No se capturan horas separadas.', operation: 'Se usa el monto total de mano de obra.', result: money(quote.manoObra), next: 'Costo hora' },
                      { title: 'Costo hora', input: 'Incluido en mano de obra.', operation: 'Sin desglose de horas para no cambiar lógica.', result: money(quote.manoObra), next: 'Costo interno' },
                      { title: 'Costo interno', input: money(quote.manoObra), operation: 'ALUXOR instala; se trata como ingreso/utilidad operativa.', result: money(quote.laborProfit), next: 'Precio cliente' },
                      { title: 'Precio cliente', input: money(quote.manoObra), operation: 'Se suma al subtotal del cliente.', result: money(quote.manoObra), next: 'Resumen' },
                    ]}
                  />
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="06B" title="Extras y ajustes" description="Extras, descuento, anticipo y folio." status={quote.extras > 0 || quote.descuento > 0 ? 'Revisar' : 'Completo'} />
                  <div className="form-grid">
                    <Field id="extras" label="Extras" {...guideFor('extras')}>{input('extras', 'number')}</Field>
                    <Field id="descuento" label="Descuento %" {...guideFor('descuento')}>{input('descuento', 'number')}</Field>
                    <Field id="anticipo" label="Anticipo %" {...guideFor('anticipo')}>{input('anticipo', 'number')}</Field>
                    <Field id="folioManual" label="Folio manual opcional" {...guideFor('folioManual')}>{input('folioManual')}</Field>
                  </div>
                  <CalculationChain
                    title="Cadena de extras"
                    steps={[
                      { title: 'Cantidad', input: 'Cargo único', operation: 'Se toma el monto capturado en extras.', result: money(quote.extras), next: 'Costo' },
                      { title: 'Costo', input: money(quote.extras), operation: 'Se suma a costo interno y precio cliente.', result: money(quote.extras), next: 'Margen' },
                      { title: 'Margen', input: 'Sin margen separado.', operation: 'No se modifica la lógica actual.', result: money(quote.extras), next: 'Precio cliente' },
                      { title: 'Precio cliente', input: money(quote.extras), operation: 'Se suma al subtotal.', result: money(quote.extras), next: 'Resumen' },
                    ]}
                  />
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="08" title="Documento / PDF" description="Condiciones, vigencia, notas y estado." status={form.condiciones ? 'Completo' : 'Incompleto'} />
                  <div className="form-grid">
                    <Field id="vigencia" label="Vigencia días" {...guideFor('vigencia')}>{input('vigencia', 'number')}</Field>
                    <Field id="formaPago" label="Forma de pago" {...guideFor('formaPago')}>{input('formaPago')}</Field>
                    <Field id="estadoCotizacion" label="Estado de cotización" {...guideFor('estadoCotizacion')}>
                      <select id="estadoCotizacion" value={form.estadoCotizacion} onChange={(event) => update('estadoCotizacion', event.target.value)}>
                        <option>Pendiente</option>
                        <option>Enviada</option>
                        <option>Aceptada</option>
                        <option>En fabricación</option>
                        <option>Instalación</option>
                        <option>Terminada</option>
                        <option>Cancelada</option>
                      </select>
                    </Field>
                    <Field id="condiciones" label="Condiciones" {...guideFor('condiciones')}>{textareaInput('condiciones')}</Field>
                    <Field id="notasCliente" label="Notas para cliente" {...guideFor('notasCliente')}>{textareaInput('notasCliente')}</Field>
                    <Field id="notasInternas" label="Notas internas" {...guideFor('notasInternas')}>{textareaInput('notasInternas')}</Field>
                  </div>
                  <p className="advanced-note">Estos datos no modifican el cálculo de la cotización.</p>
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="07" title="Resumen y análisis" description="Datos faltantes y advertencias de cotización." status={dataHealth.warnings.length ? 'Revisar' : 'Completo'} />
                  <div className="data-health-panel compact-health">
                    <h4>Datos completos</h4>
                    <div className="data-health-list">
                      {dataHealth.present.map((item) => <span key={item.label} className="data-health-ok">{item.label}</span>)}
                    </div>
                    <h4>Datos faltantes</h4>
                    <div className="data-health-list">
                      {dataHealth.missing.map((item) => <span key={item.label} className="data-health-missing">{item.label}</span>)}
                    </div>
                    {dataHealth.warnings.length > 0 && (
                      <>
                        <h4>Advertencias</h4>
                        <div className="data-health-list" role="status" aria-live="polite">
                          {dataHealth.warnings.map((warning) => <span key={warning} className="data-health-warning">{warning}</span>)}
                        </div>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </article>

            <aside
              className={`quote-floating ${floatingSummary.compact ? 'compact' : ''} ${floatingSummary.minimized ? 'minimized' : ''}`}
              style={{ left: floatingSummary.x, top: floatingSummary.y }}
              aria-label="Resumen de cotización"
              aria-live="polite"
            >
              <div className="quote-floating-head" onMouseDown={startSummaryDrag}>
                <strong>Resumen de cotización</strong>
                <div>
                  <button type="button" onClick={() => setFloatingSummary((current) => ({ ...current, compact: !current.compact }))}>Compacta</button>
                  <button type="button" onClick={() => setFloatingSummary((current) => ({ ...current, minimized: !current.minimized }))}>{floatingSummary.minimized ? 'Abrir' : 'Cerrar'}</button>
                  <button type="button" onClick={() => setFloatingSummary({ x: 24, y: 120, compact: false, minimized: false })}>Inicial</button>
                </div>
              </div>
              {!floatingSummary.minimized && (
                <div className="quote-floating-body">
                  <div className="total-number">{money(quote.total)}</div>
                  <div className="live-summary-grid">
                    <div className="live-summary-item"><span>Total cliente</span><strong>{money(quote.total)}</strong></div>
                    <div className="live-summary-item"><span>Anticipo</span><strong>{money(quote.deposit)}</strong></div>
                    <div className="live-summary-item"><span>Saldo</span><strong>{money(quote.rest)}</strong></div>
                    <div className="live-summary-item"><span>Utilidad</span><strong>{money(quote.profit)}</strong></div>
                    <div className="live-summary-item"><span>Estado</span><strong>{form.estadoCotizacion}</strong></div>
                    <div className="live-summary-item"><span>Datos</span><strong>{dataHealth.score}%</strong></div>
                  </div>
                  {dataHealth.warnings.length > 0 && (
                    <p className="live-summary-warning" role="status" aria-live="polite">{dataHealth.warnings[0]}</p>
                  )}
                  <div className="actions compact">
                    <button type="button" onClick={saveToHistory}><Save size={18} /> Guardar</button>
                    <button type="button" className="ghost" onClick={() => openPrint('client')}><FileText size={18} /> Editar PDF</button>
                    <button type="button" className="ghost" onClick={openWhatsApp}><MessageCircle size={18} /> WhatsApp</button>
                  </div>
                  <CalculationChain
                    title="Cadena del resumen"
                    defaultOpen={!floatingSummary.compact}
                    steps={[
                      { title: 'Materiales', input: `${quote.materialRows.length} material(es)`, operation: 'Suma de precios cliente por material.', result: money(quote.material), next: 'Herrajes' },
                      { title: 'Herrajes', input: `${quote.accessoryRows.length} accesorio(s)`, operation: 'Suma de precios cliente por accesorio.', result: money(quote.hardwareSale), next: 'Mano de obra' },
                      { title: 'Mano de obra', input: money(quote.manoObra), operation: 'Se suma al cliente.', result: money(quote.manoObra), next: 'Extras' },
                      { title: 'Extras', input: money(quote.extras), operation: 'Se suma al cliente e interno.', result: money(quote.extras), next: 'Costo interno' },
                      { title: 'Costo interno', input: `${money(quote.internalMaterialCost)} + ${money(quote.hardwareCost)} + ${money(quote.extras)}`, operation: 'Material interno + herrajes + extras.', result: money(quote.internalTotal), next: 'Precio cliente' },
                      { title: 'Precio cliente', input: `${money(quote.subtotal)} - ${money(quote.discountAmount)}`, operation: 'Subtotal menos descuento.', result: money(quote.total), next: 'Anticipo' },
                      { title: 'Anticipo', input: `${decimal(quote.anticipo, 1)}%`, operation: 'Total x anticipo.', result: money(quote.deposit), next: 'Saldo' },
                      { title: 'Saldo', input: `${money(quote.total)} - ${money(quote.deposit)}`, operation: 'Total menos anticipo.', result: money(quote.rest), next: 'Documento' },
                    ]}
                  />
                  <details className="floating-analysis" open={!floatingSummary.compact}>
                    <summary>Análisis profesional</summary>
                    <div className="chain-insights">
                      {chainInsights.map((item) => <span key={item}>{item}</span>)}
                    </div>
                    {professionalAnalysis.map((item) => (
                      <article key={item.role} className="professional-card">
                        <span>{item.role}</span>
                        <h4>{item.title}</h4>
                        <p className="professional-total">{item.total}</p>
                        {!floatingSummary.compact && <p>{item.why}</p>}
                      </article>
                    ))}
                  </details>
                </div>
              )}
            </aside>
          </section>
        )}

        {pdfEditor && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar documento profesional">
            <section className="panel pdf-editor-modal">
              <div className="section-head">
                <div>
                  <h2>Editar documento profesional</h2>
                  <p>Revisa el documento antes de generar PDF cliente o interno.</p>
                </div>
              </div>
              <div className="actions compact">
                <button type="button" className={pdfEditor.view === 'client' ? '' : 'ghost'} onClick={() => setPdfEditor((current) => ({ ...current, view: 'client' }))}>Vista cliente</button>
                <button type="button" className={pdfEditor.view === 'business' ? '' : 'ghost'} onClick={() => setPdfEditor((current) => ({ ...current, view: 'business' }))}>Vista interna</button>
              </div>
              <div className="form-grid">
                {[
                  ['titulo', 'Título'],
                  ['cliente', 'Cliente'],
                  ['vigencia', 'Vigencia'],
                  ['anticipo', 'Anticipo'],
                  ['saldo', 'Saldo'],
                  ['total', 'Total'],
                ].map(([field, label]) => (
                  <Field key={field} id={`pdf-${field}`} label={label}>
                    <input
                      id={`pdf-${field}`}
                      value={pdfEditor.doc[field] || ''}
                      onChange={(event) => setPdfEditor((current) => ({ ...current, doc: { ...current.doc, [field]: event.target.value } }))}
                    />
                  </Field>
                ))}
                {[
                  ['descripcion', 'Descripción'],
                  ['partidas', 'Partidas'],
                  ['condiciones', 'Condiciones'],
                  ['notas', 'Notas'],
                ].map(([field, label]) => (
                  <Field key={field} id={`pdf-${field}`} label={label}>
                    <textarea
                      id={`pdf-${field}`}
                      value={pdfEditor.doc[field] || ''}
                      onChange={(event) => setPdfEditor((current) => ({ ...current, doc: { ...current.doc, [field]: event.target.value } }))}
                    />
                  </Field>
                ))}
              </div>
              <div className="pdf-preview">
                <h3>{pdfEditor.view === 'business' ? 'Vista interna' : 'Vista cliente'}</h3>
                <p><strong>Total:</strong> {pdfEditor.doc.total}</p>
                <p><strong>Anticipo:</strong> {pdfEditor.doc.anticipo} · <strong>Saldo:</strong> {pdfEditor.doc.saldo}</p>
                {pdfEditor.view === 'business' && (
                  <p><strong>Interno:</strong> costo {money(quote.internalTotal)}, utilidad {money(quote.profit)}, margen {decimal(quote.profitPercent, 1)}%.</p>
                )}
              </div>
              <div className="actions">
                <button type="button" onClick={() => generateProfessionalPdf('client')}><FileText size={18} /> Generar PDF cliente</button>
                <button type="button" className="ghost" onClick={() => generateProfessionalPdf('business')}><ClipboardList size={18} /> Generar PDF interno</button>
                <button type="button" className="ghost" onClick={() => setPdfEditor(null)}>Cancelar</button>
              </div>
            </section>
          </div>
        )}

        {activeSection === 'catalogo' && (
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Catálogo</h2>
                <p>Productos rápidos para cargar precios base.</p>
              </div>
              <button type="button" onClick={addCatalogItem}><Package size={18} /> Agregar actual</button>
            </div>
            <div className="table-list">
              {catalog.map((item) => (
                <article key={item.id} className="catalog-row">
                  <input value={item.nombre} onChange={(event) => updateCatalogItem(item.id, 'nombre', event.target.value)} aria-label="Nombre" />
                  <input value={item.categoria} onChange={(event) => updateCatalogItem(item.id, 'categoria', event.target.value)} aria-label="Categoría" />
                  <input value={item.tipoTrabajo} onChange={(event) => updateCatalogItem(item.id, 'tipoTrabajo', event.target.value)} aria-label="Tipo" />
                  <input type="number" value={item.precio} onChange={(event) => updateCatalogItem(item.id, 'precio', numberValue(event.target.value))} aria-label="Precio" />
                  <button type="button" onClick={() => applyCatalogItem(item)}><Check size={16} /> Usar</button>
                  <button type="button" className="ghost" onClick={() => removeCatalogItem(item.id)}><Eraser size={16} /></button>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeSection === 'ajustes' && (
          <section className="panel settings-panel">
            <div className="section-head">
              <div>
                <h2>Ajustes</h2>
                <p>Logo y vista de marca para sidebar, encabezado y PDF.</p>
              </div>
            </div>
            <div className="settings-grid">
              <div className="logo-preview-box">
                {appLogo ? <img src={appLogo} alt="Vista previa del logo" /> : <div className="brand-mark">A</div>}
                <strong>{BRAND_NAME}</strong>
              </div>
              <div className="actions">
                <label htmlFor="settingsLogoUpload" className="upload-logo">
                  Subir logo manualmente
                  <input id="settingsLogoUpload" type="file" accept="image/*" onChange={handleLogoUpload} />
                </label>
                <button type="button" className="ghost" onClick={removeAppLogo}>Quitar logo</button>
              </div>
            </div>
            <p className="advanced-note">El logo se guarda automáticamente en localStorage y se reutiliza al abrir la app.</p>
          </section>
        )}

        {activeSection === 'historial' && (
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Historial de cotizaciones</h2>
                <div className="history-backup-actions">
                  <button type="button" className="ghost" onClick={exportHistoryBackup}><Download size={16} /> Exportar respaldo</button>
                  <label className="ghost file-button">
                    <Upload size={16} /> Importar respaldo
                    <input type="file" accept="application/json" onChange={importHistoryBackup} />
                  </label>
                </div>
                <p>{syncStatus}{lastSyncAt ? ` · ${lastSyncAt}` : ''}{legacyRecoveredCount > 0 ? ` · Recuperadas ${legacyRecoveredCount} cotizaciones antiguas` : ''}</p>
              </div>
              <button type="button" className="ghost" onClick={() => syncHistory(true)}><RefreshCw size={18} /> Sincronizar</button>
            </div>
            <div className="table-list">
              {history.length === 0 && <p>No hay cotizaciones guardadas todavía.</p>}
              {history.map((item) => (
                <article key={item.id} className="history-row">
                  <div>
                    <strong>{item.producto}</strong>
                    {item.folio && <span>Folio: {item.folio}</span>}
                    <span>{item.clienteNombre} · {money(item.total)} · {new Date(item.createdAt).toLocaleDateString('es-MX')}</span>
                  </div>
                  <select value={item.status || 'Pendiente'} onChange={(event) => updateHistoryStatus(item.id, event.target.value)}>
                    <option>Pendiente</option>
                    <option>Aprobada</option>
                    <option>En fabricación</option>
                    <option>Instalada</option>
                    <option>Cancelada</option>
                  </select>
                  <button type="button" onClick={() => loadHistoryItem(item)}>Abrir</button>
                  <button type="button" className="ghost" onClick={() => removeHistoryItem(item.id)}><Eraser size={16} /></button>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeSection === 'textos' && (
          <section className="panel-grid two-cols">
            {outputs.map((output) => (
              <article key={output.name} className="panel output-card">
                <h2>{output.name}</h2>
                <p>{output.description}</p>
                <textarea readOnly value={output.text} />
                <button type="button" onClick={() => copyText(output.text, output.name)}><Copy size={18} /> Copiar</button>
              </article>
            ))}
            <article className="panel output-card">
              <h2>Cotización para cliente</h2>
              <textarea readOnly value={quoteOutput.text} />
              <button type="button" onClick={() => copyText(quoteOutput.text, 'Cotización')}>Copiar cotización</button>
            </article>
          </section>
        )}

        {activeSection === 'plano' && (
          <section className="panel-grid two-cols">
            <article className="panel">
              <div className="section-head">
                <div>
                  <h2>Plano SVG y vista 3D</h2>
                  <p>Arma piezas por medida, usa plantillas o sincroniza con la cotización.</p>
                </div>
                <button type="button" className="ghost" onClick={syncPlanWithMeasures}><Ruler size={18} /> Usar medidas</button>
              </div>
              <div className="actions compact">
                {plantillasPlano.map((template) => (
                  <button key={template.id} type="button" className="ghost" onClick={() => applyPlanTemplate(template)}>{template.label}</button>
                ))}
              </div>
              {planItemsFromForm(form).map((item) => (
                <div key={item.id} className="row-card plan-row">
                  <input value={item.nombre} onChange={(event) => updatePlanItem(item.id, 'nombre', event.target.value)} aria-label="Nombre de pieza" />
                  <select value={item.forma} onChange={(event) => updatePlanItem(item.id, 'forma', event.target.value)} aria-label="Forma">
                    {formasPlano.map((forma) => <option key={forma}>{forma}</option>)}
                  </select>
                  <input type="number" value={item.ancho} onChange={(event) => updatePlanItem(item.id, 'ancho', numberValue(event.target.value))} aria-label="Ancho" />
                  <input type="number" value={item.alto} onChange={(event) => updatePlanItem(item.id, 'alto', numberValue(event.target.value))} aria-label="Alto" />
                  <input type="number" value={item.fondo} onChange={(event) => updatePlanItem(item.id, 'fondo', numberValue(event.target.value))} aria-label="Fondo" />
                  <button type="button" className="ghost" onClick={() => removePlanItem(item.id)}><Eraser size={16} /></button>
                </div>
              ))}
              <button type="button" className="ghost" onClick={addPlanItem}>Agregar pieza</button>
            </article>

            <article className="panel plan-preview">
              <div className="actions compact">
                <button type="button" className={planView === '3d' ? '' : 'ghost'} onClick={() => setPlanView('3d')}>3D real</button>
                <button type="button" className={planView === 'svg3d' ? '' : 'ghost'} onClick={() => setPlanView('svg3d')}>SVG 3D</button>
                <button type="button" className={planView === 'svg' ? '' : 'ghost'} onClick={() => setPlanView('svg')}>Plano 2D</button>
              </div>
              <label htmlFor="planRotation">Rotación</label>
              <input id="planRotation" type="range" min="-180" max="180" value={planRotation} onChange={(event) => setPlanRotation(numberValue(event.target.value))} />
              <label htmlFor="planZoom">Zoom</label>
              <input id="planZoom" type="range" min="75" max="125" value={planZoom} onChange={(event) => setPlanZoom(numberValue(event.target.value))} />
              {planView === '3d' ? (
                <PlanCanvas3D data={form} rotation={planRotation} zoom={planZoom} />
              ) : (
                <div
                  className="svg-preview"
                  dangerouslySetInnerHTML={{ __html: planView === 'svg3d' ? planSvg3d(form) : planSvg(form) }}
                />
              )}
            </article>
          </section>
        )}

        <section className="panel type-admin">
          <div className="section-head">
            <div>
              <h2>Tipos de trabajo</h2>
              <p>Catálogo interno de tipos por giro.</p>
            </div>
            <button type="button" className="ghost" onClick={addTypeDetail}>Agregar tipo</button>
          </div>
          <div className="table-list">
            {typeDetails.map((item) => (
              <article key={item.id} className="catalog-row">
                <select value={item.giro} onChange={(event) => updateTypeDetail(item.id, 'giro', event.target.value)}>
                  <option>Carpintería</option>
                  <option>Vidriería</option>
                </select>
                <input value={item.tipo} onChange={(event) => updateTypeDetail(item.id, 'tipo', event.target.value)} aria-label="Tipo" />
                <input value={item.descripcion} onChange={(event) => updateTypeDetail(item.id, 'descripcion', event.target.value)} aria-label="Descripción" />
                <button type="button" className="ghost" onClick={() => removeTypeDetail(item.id)}><Eraser size={16} /></button>
              </article>
            ))}
          </div>
        </section>

        <footer className="footer-bar">
          <span>Calidad de datos: {score}/12</span>
          {copied && <strong>{copied}</strong>}
        </footer>
      </section>
    </main>
  );
}

registerServiceWorker();
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
