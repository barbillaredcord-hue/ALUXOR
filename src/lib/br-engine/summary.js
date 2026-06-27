

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveNumber(value) {
  return Math.max(0, toNumber(value));
}

function sumar(items = [], campo) {
  return items.reduce((total, item) => total + positiveNumber(item?.[campo]), 0);
}

export function calcularResumen({
  materiales = [],
  herrajes = [],
  manoObra = [],
  extras = [],
  anticipo = 0,
} = {}) {
  const costoMateriales = sumar(materiales, 'costoInterno');
  const ventaMateriales = sumar(materiales, 'precioCliente');

  const costoHerrajes = sumar(herrajes, 'costoInterno');
  const ventaHerrajes = sumar(herrajes, 'precioCliente');

  const costoManoObra = sumar(manoObra, 'costoInterno');
  const ventaManoObra = sumar(manoObra, 'precioCliente');

  const costoExtras = sumar(extras, 'costoInterno');
  const ventaExtras = sumar(extras, 'precioCliente');

  const costoInterno =
    costoMateriales +
    costoHerrajes +
    costoManoObra +
    costoExtras;

  const totalCliente =
    ventaMateriales +
    ventaHerrajes +
    ventaManoObra +
    ventaExtras;

  const utilidad = totalCliente - costoInterno;
  const saldo = Math.max(0, totalCliente - positiveNumber(anticipo));

  return {
    costoMateriales,
    costoHerrajes,
    costoManoObra,
    costoExtras,
    ventaMateriales,
    ventaHerrajes,
    ventaManoObra,
    ventaExtras,
    costoInterno,
    totalCliente,
    utilidad,
    anticipo: positiveNumber(anticipo),
    saldo,
  };
}

export function calcularResumenCotizacion({
  materialRows = [],
  accessoryRows = [],
  manoObra = 0,
  extras = 0,
  descuento = 0,
  anticipo = 0,
} = {}) {
  const material = materialRows.reduce((sum, item) => sum + positiveNumber(item.saleTotal), 0);
  const materialBaseCost = materialRows.reduce((sum, item) => sum + positiveNumber(item.baseCost), 0);
  const wasteCost = materialRows.reduce((sum, item) => sum + positiveNumber(item.wasteCost), 0);
  const internalMaterialCost = materialBaseCost + wasteCost;
  const hardwareSale = accessoryRows.reduce((sum, item) => sum + positiveNumber(item.saleTotal), 0);
  const hardwareCost = accessoryRows.reduce((sum, item) => sum + positiveNumber(item.costTotal), 0);
  const subtotal = material + hardwareSale + positiveNumber(manoObra) + positiveNumber(extras);
  const discountAmount = subtotal * (positiveNumber(descuento) / 100);
  const total = subtotal - discountAmount;
  const laborProfit = positiveNumber(manoObra);
  const internalTotal = internalMaterialCost + hardwareCost + positiveNumber(extras);
  const profit = total - internalTotal;
  const profitPercent = total > 0 ? (profit / total) * 100 : 0;
  const deposit = total * (positiveNumber(anticipo) / 100);
  const rest = total - deposit;

  return {
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
    deposit,
    rest,
  };
}

export function crearBreakdown(resumen) {
  return [
    {
      titulo: 'Materiales',
      costo: resumen.costoMateriales,
      venta: resumen.ventaMateriales,
    },
    {
      titulo: 'Herrajes',
      costo: resumen.costoHerrajes,
      venta: resumen.ventaHerrajes,
    },
    {
      titulo: 'Mano de obra',
      costo: resumen.costoManoObra,
      venta: resumen.ventaManoObra,
    },
    {
      titulo: 'Extras',
      costo: resumen.costoExtras,
      venta: resumen.ventaExtras,
    },
  ];
}
