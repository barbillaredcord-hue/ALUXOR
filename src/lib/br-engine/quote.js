import { Areas, Materials, Pricing, Summary } from './index.js';
import { optimizeCuts } from '../cut-optimizer/optimizer.js';

function withHelpers(helpers = {}) {
  return helpers;
}

function normalizeTipoCompraQuote(tipoCompra) {
  const value = String(tipoCompra ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/m²/g, 'm2')
    .replace(/[_/]+/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ');

  if (['hoja', 'placa', 'sheet', 'panel'].includes(value)) return 'hoja';
  if (['area', 'm2', 'metro cuadrado'].includes(value)) return 'area';
  if (['lineal', 'metro lineal', 'ml', 'linear'].includes(value)) return 'lineal';
  if (['pieza', 'pza', 'unidad', 'juego'].includes(value)) return 'pieza';
  return 'manual';
}

export function normalizeMeasureItem(item, index = 0, data = {}, helpers = {}) {
  const { clean, positiveNumber } = withHelpers(helpers);
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

export function measurementItemsFromForm(data, helpers = {}) {
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
    .map((item, index) => normalizeMeasureItem(item, index, data, helpers))
    .filter((item) => item.ancho > 0 || item.alto > 0 || item.cantidad > 0);
}

export function measureArea(item, helpers = {}) {
  const { positiveNumber } = withHelpers(helpers);
  return Areas.calcularArea(positiveNumber(item.ancho) / 100, positiveNumber(item.alto) / 100);
}

export function measureLinear(item, helpers = {}) {
  const { positiveNumber } = withHelpers(helpers);
  const perimetroMetros = ((positiveNumber(item.ancho) + positiveNumber(item.alto)) * 2) / 100;
  return Areas.calcularMetroLineal(perimetroMetros, item.cantidad);
}

export function quoteAreaTotal(data, helpers = {}) {
  const { positiveNumber } = withHelpers(helpers);
  return Areas.calcularAreaTotal(measurementItemsFromForm(data, helpers).map((item) => ({
    ancho: positiveNumber(item.ancho) / 100,
    alto: positiveNumber(item.alto) / 100,
    cantidad: item.cantidad,
  })));
}

export function quoteLinearTotal(data, helpers = {}) {
  const { positiveNumber } = withHelpers(helpers);
  return Areas.calcularMetroLinealTotal(measurementItemsFromForm(data, helpers).map((item) => ({
    largo: ((positiveNumber(item.ancho) + positiveNumber(item.alto)) * 2) / 100,
    cantidad: item.cantidad,
  })));
}

export function normalizeMaterialItem(item, index = 0, data = {}, helpers = {}) {
  const { clean, positiveNumber, percentValue } = withHelpers(helpers);
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

export function materialItemsFromForm(data, areaTotal = 0, helpers = {}) {
  const { numberValue } = withHelpers(helpers);
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
    .map((item, index) => normalizeMaterialItem(item, index, data, helpers))
    .filter((item) => item.nombre || numberValue(item.precioUnitario) > 0);
}

export function normalizeAccessoryItem(item, index = 0, data = {}, helpers = {}) {
  const { clean, numberValue, positiveNumber, percentValue } = withHelpers(helpers);
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

export function accessoryItemsFromForm(data, helpers = {}) {
  const { numberValue } = withHelpers(helpers);
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
    .map((item, index) => normalizeAccessoryItem(item, index, data, helpers))
    .filter((item) => item.nombre && item.nombre !== 'Sin herrajes');
}

export function materialItemQuantity(item, quoteBasis = {}, helpers = {}) {
  const { clean, positiveNumber } = withHelpers(helpers);
  const baseCalculo = clean(item.baseCalculo, item.usarArea ? 'medidas_area' : 'manual_qty');
  const cantidad = Math.max(1, positiveNumber(item.cantidad) || 1);
  const itemArea = (positiveNumber(item.ancho) / 100) * (positiveNumber(item.alto) / 100) * cantidad;
  const itemLineal = (positiveNumber(item.largo) / 100) * cantidad;
  if (baseCalculo === 'medidas_area') return positiveNumber(quoteBasis.areaTotal);
  if (baseCalculo === 'manual_area') return itemArea;
  if (baseCalculo === 'lineal') return itemLineal > 0 ? itemLineal : positiveNumber(quoteBasis.linearTotal);
  return positiveNumber(item.cantidad);
}

export function materialCalcLabel(item, helpers = {}) {
  const { clean } = withHelpers(helpers);
  const calculo = clean(item.calculo || item.tipoCompra, item.usarArea ? 'area' : 'manual');
  if (calculo === 'area') return 'm²';
  if (calculo === 'hoja') return 'hoja / placa';
  if (calculo === 'lineal') return 'metro lineal';
  if (calculo === 'pieza') return 'pieza';
  return 'cantidad manual';
}

function cutOptimizationForMaterial(tipoCompra, item, measureRows, helpers = {}) {
  if (tipoCompra !== 'hoja') return null;
  const { positiveNumber } = withHelpers(helpers);
  const sheetWidth = positiveNumber(item.ancho);
  const sheetHeight = positiveNumber(item.alto);
  if (sheetWidth <= 0 || sheetHeight <= 0) return null;
  const pieces = measureRows
    .map((measure) => ({
      name: measure.nombre,
      width: positiveNumber(measure.ancho),
      height: positiveNumber(measure.alto),
      quantity: measure.cantidad,
    }))
    .filter((piece) => piece.width > 0 && piece.height > 0 && piece.quantity > 0);
  if (!pieces.length) return null;
  return optimizeCuts({
    sheetWidth,
    sheetHeight,
    allowRotation: true,
    kerf: 0.3,
    strategy: 'largest-first',
    pieces,
  });
}

export function calculateQuote(data, helpers = {}) {
  const { clean, numberValue, positiveNumber, percentValue, money, decimal } = withHelpers(helpers);
  const measureRows = measurementItemsFromForm(data, helpers).map((item) => {
    const area = measureArea(item, helpers);
    const areaTotal = area * item.cantidad;
    const linearTotal = measureLinear(item, helpers);
    return {
      ...item,
      area,
      areaTotal,
      linearTotal,
    };
  });
  const primaryMeasure = measureRows[0] || normalizeMeasureItem({}, 0, data, helpers);
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

  const materialRows = materialItemsFromForm(data, areaTotal, helpers).map((item) => {
    const rowQuantity = materialItemQuantity(item, quoteBasis, helpers);
    const itemAreaTotal = (positiveNumber(item.ancho) / 100) * (positiveNumber(item.alto) / 100) * Math.max(1, positiveNumber(item.cantidad) || 1);
    const itemLinearTotal = (positiveNumber(item.largo) / 100) * Math.max(1, positiveNumber(item.cantidad) || 1);
    const rowMerma = percentValue(item.merma);
    const rowMargin = item.margen === '' ? margenMaterial : positiveNumber(item.margen);
    const tipoCompra = normalizeTipoCompraQuote(item.tipoCompra || item.calculo);
    const largoUnidad = positiveNumber(item.largo) / 100;
    const areaNecesaria = ['hoja', 'area'].includes(tipoCompra) ? rowQuantity : 0;
    const largoNecesario = tipoCompra === 'lineal' ? rowQuantity : 0;
    const cantidadNecesaria = ['pieza', 'manual'].includes(tipoCompra) ? Math.max(0, rowQuantity) : 0;
    const costoUnitario = positiveNumber(item.costoUnitario);
    const cutOptimization = cutOptimizationForMaterial(tipoCompra, item, measureRows, helpers);
    const materialCalc = Materials.calcularMaterial({
      tipoCompra,
      areaNecesaria,
      linealNecesario: largoNecesario,
      cantidad: cantidadNecesaria,
      ancho: positiveNumber(item.ancho) / 100,
      alto: positiveNumber(item.alto) / 100,
      precioUnidad: costoUnitario,
      precioMetroCuadrado: costoUnitario,
      precioMetroLineal: costoUnitario,
      costoInterno: costoUnitario,
      merma: rowMerma,
      margen: rowMargin,
      precioManual: rowQuantity * positiveNumber(item.precioUnitario),
      usarPrecioManual: Boolean(item.precioManual),
      optimization: cutOptimization,
    });
    const areaHoja = materialCalc.areaUnidad || 0;
    const areaConMerma = materialCalc.areaConMerma || 0;
    const largoConMerma = materialCalc.linealConMerma || 0;
    const cantidadConMerma = materialCalc.cantidadConMerma || 0;
    const hojasNecesarias = materialCalc.unidadesNecesarias || 0;
    const metrosNecesarios = materialCalc.linealConMerma || 0;
    const piezasNecesarias = materialCalc.unidadesNecesarias || 0;
    const costoMetroCuadrado = materialCalc.costoMetroCuadrado || costoUnitario;
    const costoMetroLineal = materialCalc.costoMetroLineal || 0;
    const costTotal = materialCalc.costoInterno || 0;
    const saleTotal = materialCalc.precioCliente || 0;
    const suggestedSaleTotal = materialCalc.precioSugerido || saleTotal;
    const unitPrice = rowQuantity > 0 ? saleTotal / rowQuantity : 0;
    const suggestedUnit = rowQuantity > 0 ? suggestedSaleTotal / rowQuantity : 0;
    const marginAmount = materialCalc.utilidad || 0;
    const marginPercent = Pricing.calcularUtilidadSobreCosto(marginAmount, costTotal);
    const marginPercentOverSale = Pricing.calcularUtilidadSobreVenta(marginAmount, saleTotal);
    const baseCost = tipoCompra === 'hoja' ? areaNecesaria * costoMetroCuadrado : rowQuantity * costoUnitario;
    const wasteCost = Math.max(0, costTotal - baseCost);
    const optimizationSummary = cutOptimization?.summary || null;
    const optimizationStatus = tipoCompra === 'hoja'
      ? (optimizationSummary ? 'optimized' : 'pending')
      : 'not-applicable';
    const optimizationLabel = optimizationSummary
      ? `Costo basado en ${optimizationSummary.requiredSheets} hoja(s) optimizadas. Aprovechamiento: ${decimal(optimizationSummary.utilization, 0)}%. Merma estimada: ${decimal(optimizationSummary.wasteArea / 10000)} m².`
      : (tipoCompra === 'hoja' ? 'Pendiente de optimizar.' : '');
    return {
      ...item,
      tipoCompra,
      rowQuantity,
      rowMargin,
      calcLabel: materialCalcLabel(item, helpers),
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
      cutOptimization,
      optimizationSummary,
      optimizationStatus,
      optimizationLabel,
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
        optimizationLabel || null,
        tipoCompra === 'lineal' ? `Metro lineal con merma: ${decimal(largoConMerma)} m.` : null,
        ['pieza', 'manual'].includes(tipoCompra) ? `Piezas con merma: ${piezasNecesarias}.` : null,
        `Costo interno real: ${money(costTotal)}.`,
        `Precio cliente: ${money(saleTotal)}.`,
        `Utilidad: ${money(marginAmount)}.`,
      ].filter(Boolean),
    };
  });

  const accessoryRows = accessoryItemsFromForm(data, helpers).map((item) => {
    const rowQuantity = Math.max(1, positiveNumber(item.cantidad) || 1);
    const rowMerma = percentValue(item.merma);
    const rowMargin = item.margen === '' ? margenMaterial : positiveNumber(item.margen);
    const accessoryCalc = Materials.calcularMaterial({
      tipoCompra: normalizeTipoCompraQuote(item.tipoCompra || item.tipo || 'pieza'),
      cantidad: rowQuantity,
      precioUnidad: positiveNumber(item.costoUnitario),
      costoInterno: positiveNumber(item.costoUnitario),
      merma: rowMerma,
      margen: rowMargin,
      precioManual: rowQuantity * positiveNumber(item.precioUnitario),
      usarPrecioManual: Boolean(item.precioManual),
    });
    const baseCost = rowQuantity * positiveNumber(item.costoUnitario);
    const costTotal = accessoryCalc.costoInterno || 0;
    const suggestedSaleTotal = accessoryCalc.precioSugerido || accessoryCalc.precioCliente || 0;
    const suggestedUnit = rowQuantity > 0 ? suggestedSaleTotal / rowQuantity : 0;
    const saleTotal = accessoryCalc.precioCliente || 0;
    const unitPrice = rowQuantity > 0 ? saleTotal / rowQuantity : 0;
    const marginAmount = accessoryCalc.utilidad || 0;
    const marginPercent = Pricing.calcularUtilidadSobreCosto(marginAmount, costTotal);
    const marginPercentOverSale = Pricing.calcularUtilidadSobreVenta(marginAmount, saleTotal);
    return {
      ...item,
      rowQuantity,
      tipoCompra: normalizeTipoCompraQuote(item.tipoCompra || item.tipo || 'pieza'),
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

  const summary = Summary.calcularResumenCotizacion({
    materialRows,
    accessoryRows,
    manoObra,
    extras,
    descuento,
    anticipo,
  });
  const {
    material,
    materialBaseCost,
    wasteCost,
    internalMaterialCost,
    hardwareSale,
    hardwareCost,
    subtotal,
    discountAmount,
    total,
    laborProfit,
    internalTotal,
    profit,
    profitPercent,
    profitPercentCost,
    deposit,
    rest,
  } = summary;
  const primaryMaterialCost = materialRows[0]?.costoUnitario ?? numberValue(data.costoMaterialM2);
  const primaryMaterialWaste = materialRows[0]?.merma ?? merma;
  const suggestedMaterialTotal = materialRows.reduce((sum, item) => sum + item.suggestedSaleTotal, 0);
  const suggestedPriceM2 = areaTotal > 0
    ? suggestedMaterialTotal / areaTotal
    : positiveNumber(primaryMaterialCost) * (1 + percentValue(primaryMaterialWaste) / 100) * (1 + margenMaterial / 100);
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
          detail: `Total cliente ${money(total)} - costo interno real ${money(internalTotal)} = ${money(profit)}. Utilidad sobre costo: ${decimal(profitPercentCost, 1)}%. Utilidad sobre venta: ${decimal(profitPercent, 1)}%.`,
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
    profitPercentCost,
    breakdown,
    total,
    deposit,
    rest,
    anticipo,
    cantidad,
    fondo,
  };
}
