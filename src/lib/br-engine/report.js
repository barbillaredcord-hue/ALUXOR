import { BadgeDollarSign, Calculator, MessageCircle, Sparkles, Store } from 'lucide-react';

function helpersOf(helpers = {}) {
  return helpers;
}

export function buildContext(data, quote, helpers = {}) {
  const { tonos, objetivos, money, clean, formatDimensions, hashtags } = helpersOf(helpers);
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

export function generateOutputs(data, quote, helpers = {}) {
  const { money, numberValue, sentenceJoin, contactLine } = helpersOf(helpers);
  const c = buildContext(data, quote, helpers);
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

export function generateMaterials(data, quote) {
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

export function workRoleCards(data, quote, helpers = {}) {
  const { money, clean } = helpersOf(helpers);
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

export function operationLine(label, operation, result) {
  return {
    label,
    operation,
    result,
  };
}

export function quoteProfessionalAnalysis(data, quote, helpers = {}) {
  const { money, decimal, clean, formatDimensions } = helpersOf(helpers);
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

export function professionalDocFromQuote(data, quote, helpers = {}) {
  const { money, decimal, clean } = helpersOf(helpers);
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
