

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