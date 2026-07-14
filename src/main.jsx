// cSpell:words ALUXOR AnunciaPro anunciapro aluxor Clóset clóset clósets Cotizacion cotizacion Telefono telefono whatsapp promocion jaladera Jaladera jaladeras Jaladeras tornillería Silicón categoria bano economico descripcion triplay Triplay buro buró Buró burós pzas Vidrieria Carpinteria zoclo herrajes melamina merma cotizador metalness
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Accessibility,
  Archive,
  BarChart3,
  Box,
  Calculator,
  ClipboardList,
  DoorOpen,
  Eraser,
  FileText,
  Hammer,
  History,
  LayoutDashboard,
  MessageCircle,
  Package,
  RefreshCw,
  Ruler,
  Scissors,
  Sparkles,
  Store,
  TableProperties,
} from 'lucide-react';
import './styles.css';
import { registerServiceWorker } from './pwa';
import AuthGate from './components/auth/AuthGate.jsx';
import UserSessionCard from './components/auth/UserSessionCard.jsx';
import Field from './components/Field.jsx';
import InspectorPanel from './components/InspectorPanel.jsx';
import PlanCanvas3D from './components/PlanCanvas3D.jsx';
import ProjectFlow from './components/ProjectFlow.jsx';
import SummaryPanel from './components/SummaryPanel.jsx';
import WorkspaceLayout from './layouts/WorkspaceLayout.jsx';
import AnnouncementSection from './sections/AnnouncementSection.jsx';
import CatalogSection from './sections/CatalogSection.jsx';
import CutOptimizerSection from './sections/CutOptimizerSection.jsx';
import QuoteSection from './sections/QuoteSection.jsx';
import DashboardSection from './sections/DashboardSection.jsx';
import FabricationSection from './sections/FabricationSection.jsx';
import HistorySection from './sections/HistorySection.jsx';
import InventorySection from './sections/InventorySection.jsx';
import ProductionSection from './sections/ProductionSection.jsx';
import PurchasesSection from './sections/PurchasesSection.jsx';
import ReceivingSection from './sections/ReceivingSection.jsx';
import SettingsSection from './sections/SettingsSection.jsx';
import TextSection from './sections/TextSection.jsx';
import { AuthService } from './lib/auth/authService.js';
import { WorkspaceService } from './lib/workspace/workspaceService.js';
import { QuoteRepository } from './lib/quotes/quoteRepository.js';
import { QuoteAdapter } from './lib/quotes/quoteAdapter.js';
import { OfflineQueue } from './lib/quotes/offlineQueue.js';
import { ConflictResolver } from './lib/quotes/conflictResolver.js';
import { Areas, Materials, Pricing, Summary, Report, Quote, HistoryEngine, Pdf, StorageEngine, PlanEngine, AnalysisEngine } from './lib/br-engine/index.js';

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

function isRemoteQuoteId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(String(value || ''));
}

function isNetworkError(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;

  const code = String(error?.code || '').toUpperCase();
  const name = String(error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const description = `${message} ${details}`;

  if (
    code === '23505'
    || code === 'QUOTE_VERSION_CONFLICT'
    || code === '42501'
    || description.includes('row-level security')
    || description.includes('permission denied')
  ) {
    return false;
  }

  return name === 'aborterror'
    || name === 'timeouterror'
    || name === 'networkerror'
    || ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'NETWORK_ERROR', 'FETCH_ERROR']
      .includes(code)
    || description.includes('failed to fetch')
    || description.includes('fetch failed')
    || description.includes('network request failed')
    || description.includes('networkerror')
    || description.includes('timeout')
    || description.includes('timed out');
}

function queuedCreateMatchesRow(row, payload) {
  if (!row || !payload || row.folio !== payload.folio) return false;

  try {
    return row.status === payload.status
      && row.client_name === payload.client_name
      && row.client_phone === payload.client_phone
      && row.product_name === payload.product_name
      && Number(row.total) === Number(payload.total)
      && Number(row.deposit) === Number(payload.deposit)
      && Number(row.balance) === Number(payload.balance)
      && JSON.stringify(row.form_data || {}) === JSON.stringify(payload.form_data || {});
  } catch {
    return false;
  }
}

function positiveNumber(value) {
  return Math.max(0, numberValue(value));
}

function percentValue(value) {
  return Math.min(100, Math.max(0, numberValue(value)));
}

const quoteHelpers = {
  clean,
  numberValue,
  positiveNumber,
  percentValue,
  money,
  decimal,
};

const historyHelpers = {
  clean,
  numberValue,
  defaults,
  historyApi: HISTORY_API,
};

function formatDimensions(data) {
  const rows = Quote.measurementItemsFromForm(data, quoteHelpers);
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

const planHelpers = {
  clean,
  numberValue,
  escapeHtml,
  formatDimensions,
};

function uniqueByValue(items) {
  return [...new Set(items.map((item) => clean(item)).filter(Boolean))];
}

function typeOptionsFor(giro, typeDetails = []) {
  return uniqueByValue([
    ...(tiposPorGiro[giro] || tiposPorGiro.Carpintería),
    ...typeDetails.filter((item) => item.giro === giro).map((item) => item.tipo),
  ]);
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

function sentenceJoin(parts) {
  return parts.filter(Boolean).join('\n');
}

function contactLine(whatsapp) {
  return whatsapp ? `WhatsApp: ${whatsapp}` : 'Escríbenos por mensaje directo';
}

const reportHelpers = {
  tonos,
  objetivos,
  money,
  decimal,
  clean,
  numberValue,
  formatDimensions,
  hashtags,
  sentenceJoin,
  contactLine,
};

const pdfHelpers = {
  brandName: BRAND_NAME,
  clean,
  escapeHtml,
  money,
  numberValue,
  professionalDocFromQuote: Report.professionalDocFromQuote,
  professionalDocHelpers: reportHelpers,
};

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

function marginPercentFromSaleAndCost(saleTotal, costTotal) {
  const sale = numberValue(saleTotal);
  const cost = numberValue(costTotal);
  if (sale <= 0) return 0;
  return ((sale - cost) / sale) * 100;
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

const storageHelpers = {
  catalogDefaults,
  defaultTypeDetails,
  normalizeCatalogItem,
  normalizeHistory: HistoryEngine.normalizeHistory,
};

const analysisHelpers = {
  money,
  decimal,
  percentValue,
};

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
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [form, setForm] = useState(defaults);
  const [catalog, setCatalog] = useState(() => StorageEngine.loadCatalog(storageHelpers));
  const [history, setHistory] = useState(() => StorageEngine.loadHistory(storageHelpers));
  const historyRef = useRef(history);
  const remoteQuotesRequestRef = useRef({
    id: 0,
    inFlight: false,
    pending: false,
    pendingPreserveStatus: false,
    preserveCurrentStatus: false,
  });
  const supabaseTransportActiveRef = useRef(false);
  const quoteSaveInFlightRef = useRef(false);
  const offlineQueueProcessingRef = useRef(false);
  const [activeQuoteIdentity, setActiveQuoteIdentity] = useState(null);
  const [selectedHistoryPreview, setSelectedHistoryPreview] = useState(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(
    () => OfflineQueue.getPendingCount()
  );
  const [legacyRecoveredCount, setLegacyRecoveredCount] = useState(0);
  const [copied, setCopied] = useState('');
  const [largeText, setLargeText] = useState(false);
  const [activeSection, setActiveSection] = useState('inicio');
  const [syncStatus, setSyncStatus] = useState('Historial local');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [planView, setPlanView] = useState('3d');
  const [planRotation, setPlanRotation] = useState(0);
  const [planZoom, setPlanZoom] = useState(100);
  const [typeDetails, setTypeDetails] = useState(() => StorageEngine.loadTypeDetails(storageHelpers));
  const [appLogo, setAppLogo] = useState(() => StorageEngine.loadAppLogo());
  const [floatingSummary, setFloatingSummary] = useState({ x: 24, y: 120, compact: false, minimized: false });
  const [quickCalc, setQuickCalc] = useState({ materialId: '', nombre: 'Melamina', categoria: 'Madera/Melamina', tipoCompra: 'hoja', baseUso: 'medidas', ancho: 122, alto: 244, largo: 100, cantidad: 1, precioTotal: 1200, areaManual: 0, linealManual: 0, cantidadManual: 1, merma: 8, margen: 35 });
  const [pdfEditor, setPdfEditor] = useState(null);
  const visibleSyncStatus = pendingOfflineCount > 0
    ? `${syncStatus.includes('Sin conexión') ? 'Sin conexión' : syncStatus} · ${pendingOfflineCount} ${pendingOfflineCount === 1 ? 'operación pendiente' : 'operaciones pendientes'}`
    : syncStatus;

  supabaseTransportActiveRef.current = Boolean(
    authSession?.user?.id && activeWorkspace?.id
  );

  useEffect(() => {
    let isMounted = true;

    AuthService.getSession()
      .then((session) => {
        if (isMounted) setAuthSession(session);
      })
      .catch(() => {
        if (isMounted) setAuthSession(null);
      })
      .finally(() => {
        if (isMounted) setAuthLoading(false);
      });

    const subscription = AuthService.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuthSession(session);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const userId = authSession?.user?.id;

    if (!userId) {
      setActiveWorkspace(null);
      setActiveMembership(null);
      setWorkspaceLoading(false);
      setWorkspaceError('');
      return () => { active = false; };
    }

    setWorkspaceLoading(true);
    setWorkspaceError('');

    async function resolveWorkspace() {
      let result = await WorkspaceService.getCurrentWorkspace(userId);

      if (!result.error && !result.workspace) {
        result = await WorkspaceService.createInitialWorkspace({
          userId,
          name: 'ALUXOR / BosqueReal',
        });
      }

      if (!active) return;

      if (result.error) {
        setActiveWorkspace(null);
        setActiveMembership(null);
        setWorkspaceError('No fue posible resolver tu workspace. Intenta nuevamente.');
        return;
      }

      setActiveWorkspace(result.workspace);
      setActiveMembership(result.membership);
    }

    resolveWorkspace()
      .catch(() => {
        if (active) {
          setActiveWorkspace(null);
          setActiveMembership(null);
          setWorkspaceError('No fue posible resolver tu workspace. Intenta nuevamente.');
        }
      })
      .finally(() => {
        if (active) setWorkspaceLoading(false);
      });

    return () => { active = false; };
  }, [authSession?.user?.id]);

  const quote = useMemo(() => Quote.calculateQuote(form, quoteHelpers), [form]);
  const dataHealth = useMemo(() => quoteDataHealth(form, quote), [form, quote]);
  const selectedHistorySummary = useMemo(() => {
    if (!selectedHistoryPreview) return null;

    const previewForm = { ...(selectedHistoryPreview.form || {}) };
    const calculatedQuote = Quote.calculateQuote(previewForm, quoteHelpers);
    const total = numberValue(selectedHistoryPreview.total);
    const internalTotal = calculatedQuote.internalTotal;
    const previewQuote = {
      ...calculatedQuote,
      total,
      deposit: numberValue(selectedHistoryPreview.anticipo),
      rest: numberValue(selectedHistoryPreview.resto),
      profit: total - internalTotal,
    };
    const health = quoteDataHealth(previewForm, previewQuote);

    return {
      nombre: selectedHistoryPreview.producto || 'Proyecto sin nombre',
      descripcion: selectedHistoryPreview.notasCliente
        || previewForm.notasCliente
        || selectedHistoryPreview.tipoTrabajo
        || 'Sin descripción',
      quote: previewQuote,
      estado: selectedHistoryPreview.estadoCotizacion
        || selectedHistoryPreview.status
        || 'Pendiente',
      riesgos: health.warnings.length
        ? health.warnings.join(' · ')
        : 'Sin riesgos detectados',
      indicadores: `${health.score}% de datos completos`,
      progreso: health.score,
    };
  }, [selectedHistoryPreview]);
  const activeQuoteSummary = {
    nombre: form.producto || 'Proyecto sin nombre',
    descripcion: form.notasCliente || form.tipoTrabajo || 'Sin descripción',
    quote,
    estado: form.estadoCotizacion || 'Pendiente',
    riesgos: dataHealth.warnings.length
      ? dataHealth.warnings.join(' · ')
      : 'Sin riesgos detectados',
    indicadores: `${dataHealth.score}% de datos completos`,
    progreso: dataHealth.score,
  };
  const contextualQuoteSummary = activeSection === 'historial' && selectedHistorySummary
    ? selectedHistorySummary
    : activeQuoteSummary;
  const materials = useMemo(() => Report.generateMaterials(form, quote, reportHelpers), [form, quote]);
  const outputs = useMemo(() => Report.generateOutputs(form, quote, reportHelpers), [form, quote]);
  const roleCards = useMemo(() => Report.workRoleCards(form, quote, reportHelpers), [form, quote]);
  const professionalAnalysis = useMemo(() => Report.quoteProfessionalAnalysis(form, quote, reportHelpers), [form, quote]);
  const chainInsights = useMemo(() => AnalysisEngine.professionalChainInsights(quote, analysisHelpers), [quote]);
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
  const quickAreaNecesaria = quickCalc.baseUso === 'manual' ? positiveNumber(quickCalc.areaManual) : quote.areaTotal;
  const quickLinealNecesario = quickCalc.baseUso === 'manual' ? positiveNumber(quickCalc.linealManual) : quote.linearTotal;
  const quickCantidadNecesaria = quickCalc.baseUso === 'manual' ? Math.max(1, positiveNumber(quickCalc.cantidadManual) || 1) : Math.max(1, quote.cantidad || 1);
  const quickMaterialCalc = Materials.calcularMaterial({
    tipoCompra: quickCalc.tipoCompra,
    areaNecesaria: quickAreaNecesaria,
    linealNecesario: quickLinealNecesario,
    cantidad: quickCantidadNecesaria,
    ancho: positiveNumber(quickCalc.ancho) / 100,
    alto: positiveNumber(quickCalc.alto) / 100,
    precioUnidad: quickPrecioUnidadCompra,
    precioMetroCuadrado: quickCostoM2,
    precioMetroLineal: quickCostoLineal,
    costoInterno: quickCostoUnitario,
    merma: percentValue(quickCalc.merma),
    margen: positiveNumber(quickCalc.margen),
  });
  const quickCostoBase = positiveNumber(quickCostoUnitario);
  const quickCostoConMerma = quickCostoBase * (1 + percentValue(quickCalc.merma) / 100);
  const quickPricing = {
    costoBase: quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.costoInterno : quickCostoBase,
    costoConMerma: quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.costoInterno : quickCostoConMerma,
    precioCliente: quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.precioCliente : Pricing.aplicarMargenSobreCosto(quickCostoConMerma, quickCalc.margen),
  };
  const quickFactorMerma = 1 + percentValue(quickCalc.merma) / 100;
  const quickHojasComprar = quickAreaPorPieza > 0 ? Math.ceil((quickAreaNecesaria * quickFactorMerma) / quickAreaPorPieza) : 0;
  const quickPiezasComprar = Math.ceil(quickCantidadNecesaria * quickFactorMerma);
  const quickCompraSinMerma = quickCalc.tipoCompra === 'lineal' ? quickLinealNecesario * quickCostoLineal : quickCalc.tipoCompra === 'pieza' || quickCalc.tipoCompra === 'manual' ? quickCantidadNecesaria * quickCostoUnitario : quickAreaNecesaria * quickCostoM2;
  const quickCompraConMerma = quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.costoInterno : quickCalc.tipoCompra === 'lineal' ? quickLinealNecesario * quickFactorMerma * quickCostoLineal : quickPiezasComprar * quickCostoUnitario;
  const quickTotalClienteSinMargen = quickCompraSinMerma * quickFactorMerma;
  const quickTotalClienteConMargen = quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.precioCliente : quickCalc.tipoCompra === 'lineal' ? quickLinealNecesario * quickPricing.precioCliente : quickCalc.tipoCompra === 'pieza' || quickCalc.tipoCompra === 'manual' ? quickCantidadNecesaria * quickPricing.precioCliente : quickAreaNecesaria * quickPricing.precioCliente;
  const quickProfit = quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.utilidad : quickTotalClienteConMargen - quickCompraConMerma;
  const quickProfitPercent = quickCompraConMerma > 0 ? (quickProfit / quickCompraConMerma) * 100 : 0;

  const menuItems = [
    { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
    { id: 'anuncio', label: 'Anuncio', icon: Package },
    { id: 'cotizador', label: 'Cotizador', icon: Calculator },
    { id: 'produccion', label: 'Producción', icon: ClipboardList },
    { id: 'compras', label: 'Compras', icon: Store },
    { id: 'recepcion', label: 'Recepción', icon: DoorOpen },
    { id: 'inventario', label: 'Inventario', icon: Archive },
    { id: 'fabricacion', label: 'Fabricación', icon: Hammer },
    { id: 'corte', label: 'Cut Optimizer', icon: Scissors },
    { id: 'catalogo', label: 'Catálogo', icon: TableProperties },
    { id: 'historial', label: 'Historial', icon: History },
    { id: 'textos', label: 'Textos', icon: Sparkles },
    { id: 'ajustes', label: 'Ajustes', icon: Accessibility },
  ];

  useEffect(() => {
    StorageEngine.saveCatalog(catalog);
  }, [catalog]);

  useEffect(() => {
    historyRef.current = history;
    StorageEngine.saveHistory(history);
  }, [history]);

  useEffect(() => {
    StorageEngine.saveTypeDetails(typeDetails);
  }, [typeDetails]);

  useEffect(() => {
    StorageEngine.saveLogo(appLogo);
  }, [appLogo]);

  async function loadRemoteQuotes(options = {}) {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;
    const preserveStatus = Boolean(options?.preserveStatus);

    if (!userId || !workspaceId) return;

    if (remoteQuotesRequestRef.current.inFlight) {
      remoteQuotesRequestRef.current = {
        ...remoteQuotesRequestRef.current,
        pending: true,
        pendingPreserveStatus:
          remoteQuotesRequestRef.current.pendingPreserveStatus || preserveStatus,
        preserveCurrentStatus:
          remoteQuotesRequestRef.current.preserveCurrentStatus || preserveStatus,
      };
      return;
    }

    const requestId = remoteQuotesRequestRef.current.id + 1;
    remoteQuotesRequestRef.current = {
      id: requestId,
      inFlight: true,
      pending: false,
      pendingPreserveStatus: false,
      preserveCurrentStatus: false,
    };

    try {
      const { data, error } = await QuoteRepository.loadQuotes(workspaceId);

      if (requestId !== remoteQuotesRequestRef.current.id) return;

      if (error) {
        if (!preserveStatus && !remoteQuotesRequestRef.current.preserveCurrentStatus) {
          setSyncStatus('Historial local · nube no disponible');
        }
        return;
      }

      const remoteRows = Array.isArray(data) ? data : [];
      const remoteHistory = remoteRows.map(QuoteAdapter.quoteRowToHistoryItem);
      const pendingOperations = OfflineQueue.loadQueue()
        .filter((operation) => operation.workspaceId === workspaceId);
      const pendingCreateOperations = pendingOperations
        .filter((operation) => operation.type === 'create');
      const pendingUpdateIds = new Set(
        pendingOperations
          .filter((operation) => operation.type === 'update')
          .map((operation) => operation.quoteId)
      );
      const pendingDeleteIds = new Set(
        pendingOperations
          .filter((operation) => operation.type === 'soft_delete')
          .map((operation) => operation.quoteId)
      );
      const localIds = new Set(historyRef.current.map((item) => item.id));
      const pendingCreateRemoteIds = new Set(
        remoteRows
          .filter((row) => pendingCreateOperations.some((operation) => (
            localIds.has(operation.quoteId)
            && queuedCreateMatchesRow(row, operation.payload)
          )))
          .map((row) => row.id)
      );
      const safeRemoteHistory = remoteHistory.filter((item) => (
        !pendingDeleteIds.has(item.id)
        && !pendingCreateRemoteIds.has(item.id)
        && !(pendingUpdateIds.has(item.id) && localIds.has(item.id))
      ));
      const protectedLocalHistory = historyRef.current.filter((item) => (
        !isRemoteQuoteId(item.id) || pendingUpdateIds.has(item.id)
      ));
      const merged = HistoryEngine.mergeHistoryItems(
        safeRemoteHistory,
        protectedLocalHistory,
      );

      historyRef.current = merged;
      setHistory(merged);
      StorageEngine.saveHistory(merged);
      setLastSyncAt(
        new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      if (!preserveStatus && !remoteQuotesRequestRef.current.preserveCurrentStatus) {
        setSyncStatus('Historial sincronizado');
      }
      void processOfflineQueue();
    } catch (error) {
      if (requestId !== remoteQuotesRequestRef.current.id) return;
      console.warn('No fue posible cargar cotizaciones remotas:', error);
      if (!preserveStatus && !remoteQuotesRequestRef.current.preserveCurrentStatus) {
        setSyncStatus('Historial local · nube no disponible');
      }
    } finally {
      if (requestId !== remoteQuotesRequestRef.current.id) return;

      const shouldReload = remoteQuotesRequestRef.current.pending;
      const pendingPreserveStatus = remoteQuotesRequestRef.current.pendingPreserveStatus;
      remoteQuotesRequestRef.current = {
        id: requestId,
        inFlight: false,
        pending: false,
        pendingPreserveStatus: false,
        preserveCurrentStatus: false,
      };

      if (shouldReload) {
        void loadRemoteQuotes({ preserveStatus: pendingPreserveStatus });
      }
    }
  }

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    if (!userId || !workspaceId) {
      remoteQuotesRequestRef.current = {
        id: remoteQuotesRequestRef.current.id + 1,
        inFlight: false,
        pending: false,
        pendingPreserveStatus: false,
        preserveCurrentStatus: false,
      };
      return undefined;
    }

    const reloadRemoteQuotes = () => {
      void loadRemoteQuotes();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reloadRemoteQuotes();
      }
    };

    reloadRemoteQuotes();
    window.addEventListener('focus', reloadRemoteQuotes);
    window.addEventListener('online', reloadRemoteQuotes);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      remoteQuotesRequestRef.current = {
        id: remoteQuotesRequestRef.current.id + 1,
        inFlight: false,
        pending: false,
        pendingPreserveStatus: false,
        preserveCurrentStatus: false,
      };
      window.removeEventListener('focus', reloadRemoteQuotes);
      window.removeEventListener('online', reloadRemoteQuotes);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authSession?.user?.id, activeWorkspace?.id]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    if (!userId || !workspaceId) return undefined;

    let debounceId = null;
    const unsubscribe = QuoteRepository.subscribeQuotes(workspaceId, () => {
      if (debounceId !== null) window.clearTimeout(debounceId);

      debounceId = window.setTimeout(() => {
        debounceId = null;
        void loadRemoteQuotes();
      }, 300);
    });

    return () => {
      if (debounceId !== null) window.clearTimeout(debounceId);
      unsubscribe();
    };
  }, [authSession?.user?.id, activeWorkspace?.id]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    if (!userId || !workspaceId) return undefined;

    const processQueue = () => {
      void processOfflineQueue();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') processQueue();
    };

    processQueue();
    window.addEventListener('online', processQueue);
    window.addEventListener('focus', processQueue);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('online', processQueue);
      window.removeEventListener('focus', processQueue);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authSession?.user?.id, activeWorkspace?.id]);

  async function syncHistory(uploadLocal = false) {
    if (supabaseTransportActiveRef.current) return;

    try {
      if (!navigator.onLine) {
        setSyncStatus('Sin conexión: historial guardado localmente');
        return;
      }

      setSyncStatus('Sincronizando historial...');

      const recoveredLegacyHistory = HistoryEngine.recoverLegacyHistoryFromLocalStorage(historyHelpers);
      if (recoveredLegacyHistory.length > 0) {
        setLegacyRecoveredCount(recoveredLegacyHistory.length);
      }
      const local = StorageEngine.loadHistory(storageHelpers);
      const remote = await HistoryEngine.requestHistory({}, historyHelpers);

      if (supabaseTransportActiveRef.current) return;

      const merged = HistoryEngine.mergeHistoryItems(recoveredLegacyHistory, local, history, remote);

      if (uploadLocal || merged.length !== remote.length) {
        const saved = await HistoryEngine.requestHistory({
          method: 'PUT',
          body: JSON.stringify({ history: merged }),
        }, historyHelpers);

        if (supabaseTransportActiveRef.current) return;

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
      if (!supabaseTransportActiveRef.current) {
        console.warn('Error de sincronización:', error);
        setSyncStatus('Sin conexión: usando copia local');
      }
    }
  }

  function saveHistoryRemote(nextHistory) {
    const supabaseActive = supabaseTransportActiveRef.current;

    if (!navigator.onLine) {
      if (!supabaseActive) {
        setSyncStatus('Guardado local; se sincroniza al volver internet');
      }
      return Promise.resolve(nextHistory);
    }

    return HistoryEngine.requestHistory({
      method: 'PUT',
      body: JSON.stringify({ history: nextHistory }),
    }, historyHelpers)
      .then((saved) => {
        if (!supabaseActive && !supabaseTransportActiveRef.current) {
          historyRef.current = saved;
          setHistory(saved);
          setLastSyncAt(
            new Date().toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
          setSyncStatus('Historial sincronizado en la nube');
        }
        return saved;
      })
      .catch((error) => {
        if (!supabaseActive && !supabaseTransportActiveRef.current) {
          console.warn('Guardado local; sincronización pendiente:', error);
          setSyncStatus('Guardado local; se sincroniza al volver internet');
        }
        return nextHistory;
      });
  }

  useEffect(() => {
    if (authSession?.user?.id && activeWorkspace?.id) return undefined;

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
  }, [authSession?.user?.id, activeWorkspace?.id]);
  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateMeasure(field, value) {
    setForm((current) => {
      const measureItems = Quote.measurementItemsFromForm(current, quoteHelpers);
      const first = measureItems[0] || Quote.normalizeMeasureItem({}, 0, current, quoteHelpers);
      const nextMeasureItems = [{ ...first, [field]: value }, ...measureItems.slice(1)];
      const next = { ...current, [field]: value, measureItems: nextMeasureItems };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function updateMeasureItem(id, field, value) {
    setForm((current) => {
      const measureItems = Quote.measurementItemsFromForm(current, quoteHelpers).map((item) => (
        item.id === id ? { ...item, [field]: value } : item
      ));
      const first = measureItems[0] || Quote.normalizeMeasureItem({}, 0, current, quoteHelpers);
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
        ...Quote.measurementItemsFromForm(current, quoteHelpers),
        {
          id: `med-${Date.now()}`,
          nombre: `Medida ${Quote.measurementItemsFromForm(current, quoteHelpers).length + 1}`,
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
      const measureItems = Quote.measurementItemsFromForm(current, quoteHelpers).filter((item) => item.id !== id);
      const safeItems = measureItems.length ? measureItems : [Quote.normalizeMeasureItem({}, 0, current, quoteHelpers)];
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
      const areaTotal = Quote.quoteAreaTotal(current, quoteHelpers);
      const materialItems = Quote.materialItemsFromForm(current, areaTotal, quoteHelpers).map((item) => {
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
          next.precioUnitario = Math.round(Pricing.aplicarMargenSobreCosto(
            positiveNumber(next.costoUnitario) * (1 + percentValue(next.merma) / 100),
            next.margen || current.margenMaterial
          ));
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
        ...Quote.materialItemsFromForm(current, Quote.quoteAreaTotal(current, quoteHelpers), quoteHelpers),
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
      const areaTotal = Quote.quoteAreaTotal(current, quoteHelpers);
      const items = Quote.materialItemsFromForm(current, areaTotal, quoteHelpers).filter((item) => item.id !== id);
      return { ...current, materialItems: items.length ? items : [] };
    });
  }

  function applySuggestedPrices() {
    setForm((current) => {
      const areaTotal = Quote.quoteAreaTotal(current, quoteHelpers);
      const currentQuote = Quote.calculateQuote(current, quoteHelpers);
      const materialItems = Quote.materialItemsFromForm(current, areaTotal, quoteHelpers).map((item) => ({
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
      accessoryItems: Quote.accessoryItemsFromForm(current, quoteHelpers).map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          [field]: value,
          ...(field === 'precioUnitario' ? { precioManual: true } : {}),
        };
        if (['costoUnitario', 'merma', 'margen'].includes(field) && !next.precioManual) {
          next.precioUnitario = Math.round(Pricing.aplicarMargenSobreCosto(
            positiveNumber(next.costoUnitario) * (1 + percentValue(next.merma) / 100),
            next.margen || current.margenMaterial
          ));
        }
        return next;
      }),
    }));
  }

  function addAccessoryItem() {
    setForm((current) => ({
      ...current,
      accessoryItems: [
        ...Quote.accessoryItemsFromForm(current, quoteHelpers),
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
      const items = Quote.accessoryItemsFromForm(current, quoteHelpers).filter((item) => item.id !== id);
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
      planItems: PlanEngine.planItemsFromForm(current, planHelpers).map((item) => (
        item.id === id ? { ...item, [field]: value } : item
      )),
    }));
  }

  function addPlanItem() {
    setForm((current) => ({
      ...current,
      planItems: [
        ...PlanEngine.planItemsFromForm(current, planHelpers),
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
      const items = PlanEngine.planItemsFromForm(current, planHelpers).filter((item) => item.id !== id);
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
      planItems: PlanEngine.planTemplateData(template.id, current, planHelpers),
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
    const folioPattern = new RegExp(`^${prefix}-(\\d+)$`);
    const maxConsecutive = (Array.isArray(historyItems) ? historyItems : [])
      .reduce((maximum, item) => {
        const match = String(item?.folio || '').match(folioPattern);
        if (!match) return maximum;

        const consecutive = Number.parseInt(match[1], 10);
        return Number.isInteger(consecutive)
          ? Math.max(maximum, consecutive)
          : maximum;
      }, 0);

    return `${prefix}-${String(maxConsecutive + 1).padStart(3, '0')}`;
  }

  function isWorkspaceFolioConflict(error) {
    const description = `${error?.message || ''} ${error?.details || ''}`;
    return error?.code === '23505'
      && description.includes('quotes_workspace_folio_active_uidx');
  }

  function warnCreateQuoteError(error) {
    console.warn('createQuote falló:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
  }

  function refreshPendingOfflineCount() {
    const count = OfflineQueue.getPendingCount();
    setPendingOfflineCount(count);
    return count;
  }

  function enqueueOfflineQuoteOperation({
    type,
    workspaceId,
    quoteId,
    expectedVersion = null,
    payload = null,
  }) {
    const operation = OfflineQueue.enqueueOperation({
      type,
      createdAt: Date.now(),
      attempts: 0,
      workspaceId,
      quoteId,
      expectedVersion,
      payload,
    });

    refreshPendingOfflineCount();
    return operation;
  }

  function removeQueuedQuoteOperations(type, workspaceId, quoteId) {
    OfflineQueue.loadQueue()
      .filter((operation) => (
        operation.type === type
        && operation.workspaceId === workspaceId
        && operation.quoteId === quoteId
      ))
      .forEach((operation) => OfflineQueue.removeOperation(operation.id));
    refreshPendingOfflineCount();
  }

  async function resolveQuoteConflict(
    localItem,
    queuedOperation = null,
    { allowPrompt = false } = {},
  ) {
    if (!localItem?.id) return false;

    const isActiveQuote = activeQuoteIdentity?.id === localItem.id;
    if (!allowPrompt || !isActiveQuote) {
      if (queuedOperation?.id) {
        OfflineQueue.updateOperation(queuedOperation.id, { conflict: true });
        refreshPendingOfflineCount();
      }
      setSyncStatus('Conflicto de versión · requiere revisión');
      return false;
    }

    setSyncStatus('La cotización fue modificada desde otro dispositivo.');
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    const keepRemote = window.confirm(
      'La cotización fue modificada desde otro dispositivo.\n\nAceptar: usar versión remota.\nCancelar: conservar la mía.'
    );
    const result = keepRemote
      ? await ConflictResolver.resolveKeepRemote(localItem)
      : await ConflictResolver.resolveKeepLocal(localItem);

    if (result.error || !result.data) {
      if (queuedOperation?.id) {
        OfflineQueue.updateOperation(queuedOperation.id, { conflict: true });
        refreshPendingOfflineCount();
      }
      setSyncStatus(
        result.error?.code === 'QUOTE_REMOTE_DELETED'
          ? 'La cotización fue eliminada en otro dispositivo.'
          : 'No se pudo resolver el conflicto · datos locales conservados'
      );
      return false;
    }

    const resolvedItem = result.data;
    const withoutConflictedItem = historyRef.current.filter((item) => (
      item.id !== localItem.id && item.id !== resolvedItem.id
    ));
    const resolvedHistory = HistoryEngine.mergeHistoryItems(
      [resolvedItem],
      withoutConflictedItem,
    );

    historyRef.current = resolvedHistory;
    setHistory(resolvedHistory);
    StorageEngine.saveHistory(resolvedHistory);
    setForm({ ...defaults, ...resolvedItem.form });
    setSelectedHistoryPreview(null);
    setActiveQuoteIdentity({
      id: resolvedItem.id,
      folio: resolvedItem.folio,
      createdAt: resolvedItem.createdAt,
      version: resolvedItem.version,
      remote: true,
    });

    const workspaceId = queuedOperation?.workspaceId || activeWorkspace?.id;
    if (workspaceId) {
      removeQueuedQuoteOperations('update', workspaceId, localItem.id);
    }

    setSyncStatus(keepRemote ? 'Versión remota aplicada' : 'Cambios locales guardados');
    void saveHistoryRemote(resolvedHistory);
    void loadRemoteQuotes({ preserveStatus: true });
    return true;
  }

  async function processOfflineQueue() {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    if (!navigator.onLine) {
      if (OfflineQueue.getPendingCount() > 0) setSyncStatus('Sin conexión');
      return;
    }

    if (
      offlineQueueProcessingRef.current
      || !userId
      || !workspaceId
    ) {
      return;
    }

    offlineQueueProcessingRef.current = true;
    let syncedCount = 0;
    let shouldReload = false;
    let stoppedByNetwork = false;
    let hasConflict = false;
    let lastSuccessMessage = '';
    let currentOperation = null;

    try {
      const operations = OfflineQueue.loadQueue()
        .filter((operation) => operation.workspaceId === workspaceId)
        .sort((left, right) => left.createdAt - right.createdAt);

      for (const operation of operations) {
        currentOperation = operation;
        if (!navigator.onLine) {
          stoppedByNetwork = true;
          break;
        }

        if (operation.conflict) {
          const localItem = historyRef.current
            .find((item) => item.id === operation.quoteId);
          const resolved = localItem
            ? await resolveQuoteConflict(localItem, operation)
            : false;
          if (!resolved) hasConflict = true;
          if (resolved) {
            syncedCount += 1;
            shouldReload = true;
          }
          continue;
        }

        let result;

        if (operation.type === 'create') {
          result = await QuoteRepository.createQuote(workspaceId, operation.payload);

          if (isWorkspaceFolioConflict(result.error)) {
            const remoteResult = await QuoteRepository.loadQuotes(workspaceId);
            if (remoteResult.error && isNetworkError(remoteResult.error)) {
              result = remoteResult;
            } else {
              const remoteRows = Array.isArray(remoteResult.data) ? remoteResult.data : [];
              const existingRow = remoteRows.find((row) => (
                queuedCreateMatchesRow(row, operation.payload)
              ));

              if (existingRow) {
                result = { data: existingRow, error: null };
              } else {
                const retryFolio = generateQuoteFolio([
                  ...historyRef.current,
                  ...remoteRows,
                ]);
                const retryPayload = { ...operation.payload, folio: retryFolio };
                OfflineQueue.updateOperation(operation.id, { payload: retryPayload });

                const retryHistory = HistoryEngine.normalizeHistory(
                  historyRef.current.map((item) => (
                    item.id === operation.quoteId
                      ? { ...item, folio: retryFolio, updatedAt: Date.now() }
                      : item
                  )),
                );
                historyRef.current = retryHistory;
                setHistory(retryHistory);
                StorageEngine.saveHistory(retryHistory);
                setActiveQuoteIdentity((current) => (
                  current?.id === operation.quoteId
                    ? { ...current, folio: retryFolio, version: null, remote: false }
                    : current
                ));

                result = await QuoteRepository.createQuote(workspaceId, retryPayload);
              }
            }
          }
        } else if (operation.type === 'update') {
          result = await QuoteRepository.updateQuote(
            operation.quoteId,
            operation.payload,
            operation.expectedVersion,
          );
        } else {
          result = await QuoteRepository.softDeleteQuote(operation.quoteId);
        }

        const operationFailed = result?.error || !result?.data;
        if (operationFailed) {
          const error = result?.error || new Error('Supabase no devolvió datos.');
          const attempts = operation.attempts + 1;

          if (operation.type === 'update' && error.code === 'QUOTE_VERSION_CONFLICT') {
            const localItem = historyRef.current
              .find((item) => item.id === operation.quoteId);
            const resolved = localItem
              ? await resolveQuoteConflict(localItem, operation)
              : false;
            if (resolved) {
              syncedCount += 1;
              shouldReload = true;
            } else {
              OfflineQueue.updateOperation(operation.id, {
                attempts,
                conflict: true,
              });
              hasConflict = true;
              refreshPendingOfflineCount();
            }
            continue;
          }

          OfflineQueue.updateOperation(operation.id, { attempts });
          refreshPendingOfflineCount();

          if (isNetworkError(error)) {
            stoppedByNetwork = true;
            break;
          }

          continue;
        }

        OfflineQueue.removeOperation(operation.id);
        refreshPendingOfflineCount();
        syncedCount += 1;
        shouldReload = true;

        if (operation.type === 'soft_delete') {
          const nextHistory = HistoryEngine.normalizeHistory(
            historyRef.current.filter((item) => item.id !== operation.quoteId)
          );
          historyRef.current = nextHistory;
          setHistory(nextHistory);
          StorageEngine.saveHistory(nextHistory);
          setActiveQuoteIdentity((current) => (
            current?.id === operation.quoteId ? null : current
          ));
          lastSuccessMessage = 'Eliminación sincronizada';
          continue;
        }

        const remoteItem = QuoteAdapter.quoteRowToHistoryItem(result.data);
        const withoutLocalItem = historyRef.current.filter((item) => (
          item.id !== operation.quoteId && item.id !== remoteItem.id
        ));
        const nextHistory = HistoryEngine.mergeHistoryItems(
          [remoteItem],
          withoutLocalItem,
        );
        historyRef.current = nextHistory;
        setHistory(nextHistory);
        StorageEngine.saveHistory(nextHistory);
        setActiveQuoteIdentity((current) => (
          current?.id === operation.quoteId || current?.id === remoteItem.id
            ? {
              id: remoteItem.id,
              folio: remoteItem.folio,
              createdAt: remoteItem.createdAt,
              version: remoteItem.version,
              remote: true,
            }
            : current
        ));
        lastSuccessMessage = operation.type === 'create'
          ? 'Cotización sincronizada'
          : 'Cambios sincronizados';
      }
    } catch (error) {
      if (currentOperation) {
        OfflineQueue.updateOperation(currentOperation.id, {
          attempts: currentOperation.attempts + 1,
        });
      }
      stoppedByNetwork = isNetworkError(error);
    } finally {
      offlineQueueProcessingRef.current = false;
      const remainingCount = refreshPendingOfflineCount();

      if (stoppedByNetwork) {
        setSyncStatus('Sin conexión');
      } else if (hasConflict) {
        setSyncStatus('Conflicto de versión · requiere revisión');
      } else if (syncedCount > 1 && remainingCount === 0) {
        setSyncStatus('Cola sincronizada');
      } else if (lastSuccessMessage) {
        setSyncStatus(lastSuccessMessage);
      } else if (remainingCount > 0) {
        setSyncStatus('Sincronización pendiente');
      }

      if (shouldReload && !stoppedByNetwork && navigator.onLine) {
        void loadRemoteQuotes({ preserveStatus: true });
      }
    }
  }

  function saveToHistory() {
    if (quoteSaveInFlightRef.current) return;
    quoteSaveInFlightRef.current = true;

    const now = Date.now();
    const currentIdentity = activeQuoteIdentity;
    const hasRemoteIdentity = Boolean(
      currentIdentity?.remote && isRemoteQuoteId(currentIdentity.id)
    );
    const folio = currentIdentity?.folio
      || clean(form.folioManual, generateQuoteFolio(history));
    const status = QuoteAdapter.normalizeQuoteStatus(form.estadoCotizacion);
    const historyForm = {
      ...form,
      estadoCotizacion: status,
    };
    const item = {
      id: currentIdentity?.id || `hist-${now}`,
      createdAt: currentIdentity?.createdAt || now,
      updatedAt: now,
      status,
      folio,
      estadoCotizacion: status,
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
      form: historyForm,
      ...(currentIdentity?.version ? { version: currentIdentity.version } : {}),
    };

    const nextHistory = HistoryEngine.mergeHistoryItems([item], historyRef.current);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    StorageEngine.saveHistory(nextHistory);
    const legacySave = saveHistoryRemote(nextHistory);
    setSyncStatus('Guardada localmente · pendiente de sincronizar');
    setActiveSection('historial');
    setActiveQuoteIdentity({
      id: item.id,
      folio,
      createdAt: item.createdAt,
      version: currentIdentity?.version || null,
      remote: hasRemoteIdentity,
    });

    const workspaceId = activeWorkspace?.id;
    const userId = authSession?.user?.id;

    if (!workspaceId) {
      quoteSaveInFlightRef.current = false;
      void Promise.resolve(legacySave).finally(() => {
        setSyncStatus('Guardada localmente · esperando conexión al workspace');
      });
      return;
    }

    const {
      payload,
      error: payloadError,
    } = QuoteAdapter.quoteFormToPayload({
      form: historyForm,
      quote,
      workspaceId,
      folio,
    });

    if (payloadError || !payload) {
      quoteSaveInFlightRef.current = false;
      void Promise.resolve(legacySave).finally(() => {
        setSyncStatus('Guardada localmente · pendiente de sincronizar');
      });
      return;
    }

    if (!userId || !navigator.onLine) {
      enqueueOfflineQuoteOperation({
        type: hasRemoteIdentity ? 'update' : 'create',
        workspaceId,
        quoteId: item.id,
        expectedVersion: currentIdentity?.version || null,
        payload,
      });
      quoteSaveInFlightRef.current = false;
      setSyncStatus('Guardada localmente · pendiente de sincronizar');
      return;
    }

    const remoteSave = hasRemoteIdentity
      ? QuoteRepository.updateQuote(
        currentIdentity.id,
        payload,
        currentIdentity.version,
      )
      : (async () => {
        const firstAttempt = await QuoteRepository.createQuote(workspaceId, payload);
        if (!isWorkspaceFolioConflict(firstAttempt.error)) return firstAttempt;

        warnCreateQuoteError(firstAttempt.error);
        setSyncStatus('Folio duplicado · generando nuevo consecutivo');

        const {
          data: remoteQuotes,
          error: remoteQuotesError,
        } = await QuoteRepository.loadQuotes(workspaceId);
        if (remoteQuotesError) return { data: null, error: remoteQuotesError };

        const existingRow = (Array.isArray(remoteQuotes) ? remoteQuotes : [])
          .find((row) => queuedCreateMatchesRow(row, payload));
        if (existingRow) return { data: existingRow, error: null };

        const retryFolio = generateQuoteFolio([
          ...historyRef.current,
          ...(Array.isArray(remoteQuotes) ? remoteQuotes : []),
        ]);
        const retryHistory = HistoryEngine.normalizeHistory(
          historyRef.current.map((historyItem) => (
            historyItem.id === item.id
              ? { ...historyItem, folio: retryFolio, updatedAt: Date.now() }
              : historyItem
          )),
        );

        historyRef.current = retryHistory;
        setHistory(retryHistory);
        StorageEngine.saveHistory(retryHistory);
        setActiveQuoteIdentity({
          id: item.id,
          folio: retryFolio,
          createdAt: item.createdAt,
          version: null,
          remote: false,
        });

        return QuoteRepository.createQuote(workspaceId, {
          ...payload,
          folio: retryFolio,
        });
      })();

    void remoteSave
      .then(async ({ data, error }) => {
        if (error?.code === 'QUOTE_VERSION_CONFLICT') {
          const queuedOperation = enqueueOfflineQuoteOperation({
            type: 'update',
            workspaceId,
            quoteId: item.id,
            expectedVersion: currentIdentity?.version || null,
            payload,
          });
          if (queuedOperation) {
            OfflineQueue.updateOperation(queuedOperation.id, { conflict: true });
            refreshPendingOfflineCount();
          }
          await resolveQuoteConflict(item, queuedOperation, { allowPrompt: true });
          return;
        }

        if (error || !data) {
          if (isNetworkError(error)) {
            if (!hasRemoteIdentity) warnCreateQuoteError(error);
            enqueueOfflineQuoteOperation({
              type: hasRemoteIdentity ? 'update' : 'create',
              workspaceId,
              quoteId: item.id,
              expectedVersion: currentIdentity?.version || null,
              payload,
            });
            setSyncStatus('Guardada localmente · pendiente de sincronizar');
            return;
          }

          if (!hasRemoteIdentity) {
            warnCreateQuoteError(
              error || new Error('Supabase no devolvió la cotización creada.'),
            );
          }
          setSyncStatus(
            hasRemoteIdentity
              ? 'Guardada localmente · pendiente de sincronizar'
              : 'No se pudo crear la cotización en nube'
          );
          return;
        }

        const remoteItem = QuoteAdapter.quoteRowToHistoryItem(data);
        const withoutTemporaryItem = historyRef.current
          .filter((historyItem) => historyItem.id !== item.id);
        const remoteHistory = HistoryEngine.mergeHistoryItems(
          [remoteItem],
          withoutTemporaryItem,
        );

        historyRef.current = remoteHistory;
        setHistory(remoteHistory);
        StorageEngine.saveHistory(remoteHistory);
        setActiveQuoteIdentity({
          id: remoteItem.id,
          folio: remoteItem.folio,
          createdAt: remoteItem.createdAt,
          version: remoteItem.version,
          remote: true,
        });
        removeQueuedQuoteOperations(
          hasRemoteIdentity ? 'update' : 'create',
          workspaceId,
          item.id,
        );
        setLastSyncAt(
          new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        setSyncStatus(
          hasRemoteIdentity
            ? 'Cotización actualizada en nube'
            : 'Cotización guardada en nube'
        );
        void loadRemoteQuotes({ preserveStatus: true });

        void Promise.resolve(legacySave).finally(() => {
          void saveHistoryRemote(remoteHistory);
        });
      })
      .catch((error) => {
        if (isNetworkError(error)) {
          if (!hasRemoteIdentity) warnCreateQuoteError(error);
          enqueueOfflineQuoteOperation({
            type: hasRemoteIdentity ? 'update' : 'create',
            workspaceId,
            quoteId: item.id,
            expectedVersion: currentIdentity?.version || null,
            payload,
          });
          setSyncStatus('Guardada localmente · pendiente de sincronizar');
          return;
        }

        if (!hasRemoteIdentity) {
          warnCreateQuoteError(error);
        }
        setSyncStatus(
          hasRemoteIdentity
            ? 'Guardada localmente · pendiente de sincronizar'
            : 'No se pudo crear la cotización en nube'
        );
      })
      .finally(() => {
        quoteSaveInFlightRef.current = false;
      });
  }

  function loadHistoryItem(item) {
    if (!item?.form) return;
    const version = numberValue(item.version);
    setSelectedHistoryPreview(null);
    setForm({ ...defaults, ...item.form });
    setActiveQuoteIdentity({
      id: item.id,
      folio: item.folio,
      createdAt: item.createdAt,
      version: version || null,
      remote: isRemoteQuoteId(item.id) && version > 0,
    });
    setActiveSection('cotizador');
  }

  function startNewQuote() {
    const confirmed = window.confirm(
      '¿Comenzar una nueva cotización?\n\nSe limpiarán los datos de la cotización actual. Esta acción no elimina historial, catálogo, precios ni configuración.'
    );

    if (!confirmed) return;

    const nextDefaults =
      typeof structuredClone === 'function'
        ? structuredClone(defaults)
        : JSON.parse(JSON.stringify(defaults));

    setForm(nextDefaults);
    setSelectedHistoryPreview(null);
    setActiveQuoteIdentity(null);
    setActiveSection('cotizador');
    setCopied('Nueva cotización lista');
  }

  function removeHistoryItem(id) {
    const workspaceId = activeWorkspace?.id;
    const removedItem = historyRef.current.find((item) => item.id === id);
    const nextHistory = HistoryEngine.normalizeHistory(
      historyRef.current.filter((item) => item.id !== id)
    );

    historyRef.current = nextHistory;
    setHistory(nextHistory);
    StorageEngine.saveHistory(nextHistory);
    setActiveQuoteIdentity((current) => (
      current?.id === id ? null : current
    ));
    void saveHistoryRemote(nextHistory);

    if (isRemoteQuoteId(id)) {
      if (workspaceId && (!authSession?.user?.id || !navigator.onLine)) {
        enqueueOfflineQuoteOperation({
          type: 'soft_delete',
          workspaceId,
          quoteId: id,
        });
        setSyncStatus('Guardada localmente · pendiente de sincronizar');
        return;
      }

      void QuoteRepository.softDeleteQuote(id)
        .then(({ data, error }) => {
          if (error || !data) {
            if (workspaceId && isNetworkError(error)) {
              enqueueOfflineQuoteOperation({
                type: 'soft_delete',
                workspaceId,
                quoteId: id,
              });
              setSyncStatus('Guardada localmente · pendiente de sincronizar');
              return;
            }

            if (removedItem) {
              const restoredHistory = HistoryEngine.mergeHistoryItems(
                [removedItem],
                historyRef.current,
              );
              historyRef.current = restoredHistory;
              setHistory(restoredHistory);
              StorageEngine.saveHistory(restoredHistory);
              void saveHistoryRemote(restoredHistory);
            }
            setSyncStatus('No se pudo eliminar en nube');
            return;
          }

          if (workspaceId) {
            removeQueuedQuoteOperations('soft_delete', workspaceId, id);
          }
          setSyncStatus('Cotización eliminada en nube');
          void loadRemoteQuotes({ preserveStatus: true });
        })
        .catch((error) => {
          if (workspaceId && isNetworkError(error)) {
            enqueueOfflineQuoteOperation({
              type: 'soft_delete',
              workspaceId,
              quoteId: id,
            });
            setSyncStatus('Guardada localmente · pendiente de sincronizar');
            return;
          }

          if (removedItem) {
            const restoredHistory = HistoryEngine.mergeHistoryItems(
              [removedItem],
              historyRef.current,
            );
            historyRef.current = restoredHistory;
            setHistory(restoredHistory);
            StorageEngine.saveHistory(restoredHistory);
            void saveHistoryRemote(restoredHistory);
          }
          setSyncStatus('No se pudo eliminar en nube');
        });
      return;
    }

    if (workspaceId) {
      removeQueuedQuoteOperations('create', workspaceId, id);
    }
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
        const nextHistory = HistoryEngine.mergeHistoryItems(importedHistory, history);
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

  async function updateHistoryStatus(id, nextStatus) {
    const previousItem = historyRef.current.find((item) => item.id === id);
    if (!previousItem) return;

    const now = Date.now();
    const normalizedStatus = QuoteAdapter.normalizeQuoteStatus(nextStatus);
    const updatedItem = {
      ...previousItem,
      status: normalizedStatus,
      estadoCotizacion: normalizedStatus,
      form: {
        ...(previousItem.form || {}),
        estadoCotizacion: normalizedStatus,
      },
      updatedAt: now,
    };
    const nextHistory = HistoryEngine.normalizeHistory(
      historyRef.current.map((item) => (
        item.id === id ? updatedItem : item
      ))
    );

    historyRef.current = nextHistory;
    setHistory(nextHistory);
    StorageEngine.saveHistory(nextHistory);
    setForm((current) => (
      activeQuoteIdentity?.id === id
        ? { ...current, estadoCotizacion: normalizedStatus }
        : current
    ));
    setSelectedHistoryPreview((current) => (
      current?.id === id ? { ...updatedItem } : current
    ));

    const expectedVersion = Number(previousItem.version);
    const workspaceId = activeWorkspace?.id;
    const canUpdateRemote = isRemoteQuoteId(id)
      && Number.isInteger(expectedVersion)
      && expectedVersion > 0
      && authSession?.user?.id
      && workspaceId;

    if (!canUpdateRemote) {
      setSyncStatus('Estado actualizado localmente');
      return;
    }

    const payload = QuoteAdapter.historyItemToQuotePayload(updatedItem);
    const enqueueStatusUpdate = (conflict = false) => {
      const operation = enqueueOfflineQuoteOperation({
        type: 'update',
        workspaceId,
        quoteId: id,
        expectedVersion,
        payload,
      });
      if (conflict && operation?.id) {
        OfflineQueue.updateOperation(operation.id, { conflict: true });
        refreshPendingOfflineCount();
      }
      return operation;
    };

    if (!navigator.onLine) {
      enqueueStatusUpdate();
      setSyncStatus('Estado guardado localmente · pendiente de sincronizar');
      return;
    }

    setSyncStatus('Actualizando estado...');

    try {
      const { data, error } = await QuoteRepository.updateQuote(
        id,
        payload,
        expectedVersion,
      );

      if (error?.code === 'QUOTE_VERSION_CONFLICT') {
        enqueueStatusUpdate(true);
        setSyncStatus('Conflicto de versión · requiere revisión');
        return;
      }

      if (error || !data) {
        if (isNetworkError(error)) {
          enqueueStatusUpdate();
          setSyncStatus('Estado guardado localmente · pendiente de sincronizar');
        } else {
          setSyncStatus('Estado actualizado localmente');
        }
        return;
      }

      const remoteItem = QuoteAdapter.quoteRowToHistoryItem(data);
      const confirmedItem = {
        ...remoteItem,
        id: updatedItem.id,
        folio: updatedItem.folio,
        createdAt: updatedItem.createdAt,
      };
      const confirmedHistory = HistoryEngine.normalizeHistory(
        historyRef.current.map((item) => (
          item.id === id ? confirmedItem : item
        ))
      );

      historyRef.current = confirmedHistory;
      setHistory(confirmedHistory);
      StorageEngine.saveHistory(confirmedHistory);
      setForm((current) => (
        activeQuoteIdentity?.id === id
          ? { ...current, estadoCotizacion: confirmedItem.estadoCotizacion }
          : current
      ));
      setActiveQuoteIdentity((current) => (
        current?.id === id
          ? { ...current, version: confirmedItem.version }
          : current
      ));
      setSelectedHistoryPreview((current) => (
        current?.id === id ? { ...confirmedItem } : current
      ));
      removeQueuedQuoteOperations('update', workspaceId, id);
      setLastSyncAt(
        new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      setSyncStatus('Estado actualizado en nube');
      void loadRemoteQuotes({ preserveStatus: true });
    } catch (error) {
      if (isNetworkError(error)) {
        enqueueStatusUpdate();
        setSyncStatus('Estado guardado localmente · pendiente de sincronizar');
      } else {
        setSyncStatus('Estado actualizado localmente');
      }
    }
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
      const measureItems = Quote.measurementItemsFromForm(current, quoteHelpers);
      const first = measureItems[0] || Quote.normalizeMeasureItem({}, 0, current, quoteHelpers);
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
      const materialItems = Quote.materialItemsFromForm(current, Quote.quoteAreaTotal(current, quoteHelpers), quoteHelpers);
      const selectedId = quickCalc.materialId;
      const target = materialItems.find((item) => item.id === selectedId);
      const nextItem = {
        ...(target || Quote.normalizeMaterialItem({ id: `mat-${Date.now()}`, nombre: quickCalc.nombre }, materialItems.length, current, quoteHelpers)),
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
    setPdfEditor({ mode, view: mode, doc: Report.professionalDocFromQuote(form, quote, reportHelpers) });
  }

  function generateProfessionalPdf(mode = 'client') {
    const html = Pdf.quotePrintHtml(form, quote, materials, mode, pdfEditor?.doc, appLogo, pdfHelpers);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
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

  async function handleSignOut() {
    setSignOutLoading(true);
    setWorkspaceError('');

    const { error } = await AuthService.signOut();

    if (error) {
      setWorkspaceError('No fue posible cerrar la sesión. Intenta nuevamente.');
      setSignOutLoading(false);
      return;
    }

    setAuthSession(null);
    setActiveWorkspace(null);
    setActiveMembership(null);
    setWorkspaceLoading(false);
    setWorkspaceError('');
    setSignOutLoading(false);
  }

  return (
    <AuthGate session={authSession} loading={authLoading}>
      <main className={largeText ? 'workspace-shell large-text' : 'workspace-shell'}>
      <WorkspaceLayout
        sidebar={(
          <div className="workspace-sidebar-stack">
        <div className="brand-card">
          {appLogo ? <img src={appLogo} alt="Logo ALUXOR" className="brand-logo" /> : <div className="brand-mark">A</div>}
          <div>
            <strong>{BRAND_NAME}</strong>
            <span>Cotizador profesional</span>
          </div>
        </div>

        <UserSessionCard
          user={authSession?.user}
          workspace={activeWorkspace}
          membership={activeMembership}
          onSignOut={handleSignOut}
          loading={workspaceLoading || signOutLoading}
        />

        {workspaceError && (
          <p className="workspace-session-error" role="alert">{workspaceError}</p>
        )}

        <SummaryPanel
          proyecto={contextualQuoteSummary.nombre}
          descripcion={contextualQuoteSummary.descripcion}
          totalCliente={money(contextualQuoteSummary.quote.total)}
          costoInterno={money(contextualQuoteSummary.quote.internalTotal)}
          utilidad={money(contextualQuoteSummary.quote.profit)}
          anticipo={money(contextualQuoteSummary.quote.deposit)}
          saldo={money(contextualQuoteSummary.quote.rest)}
          estadoProyecto={contextualQuoteSummary.estado}
          riesgos={contextualQuoteSummary.riesgos}
          indicadores={contextualQuoteSummary.indicadores}
          progreso={contextualQuoteSummary.progreso}
          onWhatsApp={openWhatsApp}
          onPdf={() => openPrint('client')}
          onGuardar={saveToHistory}
          onHistorial={() => setActiveSection('historial')}
        />

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

        <div className="sync-card">
          <RefreshCw size={18} />
          <div>
            <strong>{visibleSyncStatus}</strong>
            <span>{lastSyncAt ? `Última sincronización: ${lastSyncAt}` : visibleSyncStatus.includes('Sin conexión') ? 'Usando copia local' : 'Local + nube'}</span>
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
          </div>
        )}

        content={(
      <section className="content">
        <div className="project-context-layer">
        <header className="hero hero-compact">
          <div className="hero-main">
            <div className="hero-status-row">
              <p className="eyebrow">Proyecto activo · Versión {APP_VERSION}</p>
              <span>{form.estadoCotizacion || 'Pendiente'}</span>
            </div>

            <div className="hero-brand-line hero-title-row">
              {appLogo ? <img src={appLogo} alt="Logo ALUXOR/BosqueReal" className="hero-logo" /> : null}
              <div>
                <h1>{form.producto || 'Proyecto sin nombre'}</h1>
                <p>{form.clienteNombre || 'Cliente pendiente'} · Responsable: Taller ALUXOR</p>
              </div>
            </div>

            <div className="hero-project-meta compact-meta">
              <span>Avance <strong>{decimal(dataHealth.score, 0)}%</strong></span>
              <span>Entrega <strong>{form.entrega || 'Por definir'}</strong></span>
              <span>Próxima acción <strong>{quote.materialRows?.[0]?.nombre ? `Comprar ${quote.materialRows[0].nombre}` : 'Revisar datos'}</strong></span>
            </div>
          </div>

          <div className="hero-actions hero-actions-compact">
            <button type="button" className="ghost" onClick={refreshInstalledApp}><RefreshCw size={16} /> Actualizar</button>
            <button type="button" className="ghost" onClick={startNewQuote}><History size={16} /> Nueva cotización</button>
            <button type="button" className="ghost" onClick={() => setActiveSection('textos')}><FileText size={16} /> Textos</button>
            <button type="button" onClick={openWhatsApp}><MessageCircle size={16} /> WhatsApp</button>
            <button type="button" onClick={() => openPrint('client')}><FileText size={16} /> PDF</button>
          </div>
        </header>
        </div>

        <div className="workflow-layer">
          <ProjectFlow
            activeSection={activeSection}
            projectName={form.producto || 'Proyecto sin nombre'}
            projectStatus={form.estadoCotizacion || 'Pendiente'}
            customer={form.clienteNombre || 'Cliente pendiente'}
            progress={dataHealth.score}
            total={quote.total}
            nextAction={quote.materialRows?.[0]?.nombre ? `Comprar ${quote.materialRows[0].nombre}` : 'Revisar datos'}
          />
        </div>
        <section className="work-layer">

        {activeSection === 'inicio' && (
          <DashboardSection
            form={form}
            quote={quote}
            dataHealth={dataHealth}
            money={money}
            decimal={decimal}
          />
        )}

        {activeSection === 'anuncio' && (
          <AnnouncementSection
            form={form}
            update={update}
            guideFor={guideFor}
            input={input}
            textareaInput={textareaInput}
            currentTypeOptions={currentTypeOptions}
            tonos={tonos}
            mainOutput={mainOutput}
            copyText={copyText}
          />
        )}

        {activeSection === 'cotizador' && (
          <QuoteSection
            quoteProfiles={quoteProfiles}
            applyQuoteProfile={applyQuoteProfile}
            quickCalc={quickCalc}
            updateQuickCalc={updateQuickCalc}
            form={form}
            quote={quote}
            quoteHelpers={quoteHelpers}
            quickAreaPorPieza={quickAreaPorPieza}
            quickCostoM2={quickCostoM2}
            quickCostoLineal={quickCostoLineal}
            quickHojasComprar={quickHojasComprar}
            quickPiezasComprar={quickPiezasComprar}
            quickCompraSinMerma={quickCompraSinMerma}
            quickCompraConMerma={quickCompraConMerma}
            quickPricing={quickPricing}
            quickTotalClienteSinMargen={quickTotalClienteSinMargen}
            quickTotalClienteConMargen={quickTotalClienteConMargen}
            quickProfit={quickProfit}
            quickProfitPercent={quickProfitPercent}
            decimal={decimal}
            money={money}
            copyText={copyText}
            quickCalcText={quickCalcText}
            applyQuickCalcToMaterial={applyQuickCalcToMaterial}
            guideFor={guideFor}
            input={input}
            textareaInput={textareaInput}
            currentTypeOptions={currentTypeOptions}
            update={update}
            updateMeasureItem={updateMeasureItem}
            numberValue={numberValue}
            removeMeasureItem={removeMeasureItem}
            addMeasureItem={addMeasureItem}
            updateMaterialItem={updateMaterialItem}
            removeMaterialItem={removeMaterialItem}
            addMaterialItem={addMaterialItem}
            updateAccessoryItem={updateAccessoryItem}
            removeAccessoryItem={removeAccessoryItem}
            addAccessoryItem={addAccessoryItem}
            dataHealth={dataHealth}
            floatingSummary={floatingSummary}
            startSummaryDrag={startSummaryDrag}
            setFloatingSummary={setFloatingSummary}
            saveToHistory={saveToHistory}
            openPrint={openPrint}
            openWhatsApp={openWhatsApp}
            chainInsights={chainInsights}
            professionalAnalysis={professionalAnalysis}
          />
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
          <CatalogSection
            catalog={catalog}
            addCatalogItem={addCatalogItem}
            updateCatalogItem={updateCatalogItem}
            numberValue={numberValue}
            applyCatalogItem={applyCatalogItem}
            removeCatalogItem={removeCatalogItem}
          />
        )}

        {activeSection === 'produccion' && (
          <ProductionSection
            form={form}
            quote={quote}
            money={money}
            decimal={decimal}
            openPrint={openPrint}
          />
        )}

        {activeSection === 'compras' && (
          <PurchasesSection
            form={form}
            quote={quote}
            money={money}
            decimal={decimal}
          />
        )}

        {activeSection === 'recepcion' && (
          <ReceivingSection
            form={form}
            quote={quote}
            decimal={decimal}
          />
        )}

        {activeSection === 'inventario' && (
          <InventorySection
            form={form}
            quote={quote}
            money={money}
            decimal={decimal}
          />
        )}

        {activeSection === 'fabricacion' && (
          <FabricationSection
            form={form}
            quote={quote}
            decimal={decimal}
          />
        )}

        {activeSection === 'corte' && (
          <CutOptimizerSection
            quote={quote}
            decimal={decimal}
          />
        )}

        {activeSection === 'ajustes' && (
          <SettingsSection
            appLogo={appLogo}
            brandName={BRAND_NAME}
            handleLogoUpload={handleLogoUpload}
            removeAppLogo={removeAppLogo}
          />
        )}

        {activeSection === 'historial' && (
          <HistorySection
            syncStatus={visibleSyncStatus}
            lastSyncAt={lastSyncAt}
            legacyRecoveredCount={legacyRecoveredCount}
            exportHistoryBackup={exportHistoryBackup}
            importHistoryBackup={importHistoryBackup}
            syncHistory={syncHistory}
            history={history}
            money={money}
            updateHistoryStatus={updateHistoryStatus}
            loadHistoryItem={loadHistoryItem}
            removeHistoryItem={removeHistoryItem}
            selectedHistoryPreview={selectedHistoryPreview}
            selectHistoryPreview={setSelectedHistoryPreview}
          />
        )}

        {activeSection === 'textos' && (
          <TextSection
            outputs={outputs}
            quoteOutput={quoteOutput}
            copyText={copyText}
          />
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
              {PlanEngine.planItemsFromForm(form, planHelpers).map((item) => (
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
                <PlanCanvas3D
                  data={form}
                  rotation={planRotation}
                  zoom={planZoom}
                  planHelpers={planHelpers}
                  numberValue={numberValue}
                />
              ) : (
                <div
                  className="svg-preview"
                  dangerouslySetInnerHTML={{ __html: planView === 'svg3d' ? PlanEngine.planSvg3d(form, planHelpers) : PlanEngine.planSvg(form, planHelpers) }}
                />
              )}
            </article>
          </section>
        )}

        {false && (
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
        )}

        </section>
        <footer className="footer-bar">
          <span>Calidad de datos: {score}/12</span>
          {copied && <strong>{copied}</strong>}
        </footer>
      </section>
        )}
        inspector={(
          <InspectorPanel
            form={form}
            quote={quote}
            dataHealth={dataHealth}
            materials={materials}
            money={money}
            decimal={decimal}
            openPrint={openPrint}
            openWhatsApp={openWhatsApp}
            setActiveSection={setActiveSection}
          />
        )}
      />
      </main>
    </AuthGate>
  );
}

registerServiceWorker();
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
