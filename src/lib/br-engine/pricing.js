

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveNumber(value) {
  return Math.max(0, toNumber(value));
}

export function calcularFactorMargen(margen = 0) {
  return 1 + positiveNumber(margen) / 100;
}

export function aplicarMargenSobreCosto(costoInterno, margen = 0) {
  return positiveNumber(costoInterno) * calcularFactorMargen(margen);
}

export function calcularUtilidad(precioCliente, costoInterno) {
  return positiveNumber(precioCliente) - positiveNumber(costoInterno);
}

export function calcularUtilidadSobreCosto(utilidad, costoInterno) {
  const costo = positiveNumber(costoInterno);
  if (costo <= 0) return 0;
  return (toNumber(utilidad) / costo) * 100;
}

export function calcularUtilidadSobreVenta(utilidad, precioCliente) {
  const precio = positiveNumber(precioCliente);
  if (precio <= 0) return 0;
  return (toNumber(utilidad) / precio) * 100;
}

export function calcularPrecioClienteDesdeCosto(costoInterno, margen = 0) {
  const precioCliente = aplicarMargenSobreCosto(costoInterno, margen);
  const utilidad = calcularUtilidad(precioCliente, costoInterno);

  return {
    costoInterno: positiveNumber(costoInterno),
    margen: positiveNumber(margen),
    precioCliente,
    utilidad,
    utilidadSobreCosto: calcularUtilidadSobreCosto(utilidad, costoInterno),
    utilidadSobreVenta: calcularUtilidadSobreVenta(utilidad, precioCliente),
  };
}

export function calcularPrecioManual(precioManual, costoInterno) {
  const precioCliente = positiveNumber(precioManual);
  const utilidad = calcularUtilidad(precioCliente, costoInterno);

  return {
    costoInterno: positiveNumber(costoInterno),
    precioCliente,
    utilidad,
    utilidadSobreCosto: calcularUtilidadSobreCosto(utilidad, costoInterno),
    utilidadSobreVenta: calcularUtilidadSobreVenta(utilidad, precioCliente),
  };
}

export function elegirPrecioCliente({
  costoInterno = 0,
  margen = 0,
  precioManual = 0,
  usarPrecioManual = false,
} = {}) {
  if (usarPrecioManual) {
    return {
      ...calcularPrecioManual(precioManual, costoInterno),
      modo: 'manual',
    };
  }

  return {
    ...calcularPrecioClienteDesdeCosto(costoInterno, margen),
    modo: 'margen',
  };
}

export function calcularAnticipo(totalCliente, porcentajeAnticipo = 0) {
  return positiveNumber(totalCliente) * (positiveNumber(porcentajeAnticipo) / 100);
}

export function calcularSaldo(totalCliente, anticipo) {
  return Math.max(0, positiveNumber(totalCliente) - positiveNumber(anticipo));
}

export function calcularPago({
  totalCliente = 0,
  porcentajeAnticipo = 0,
} = {}) {
  const anticipo = calcularAnticipo(totalCliente, porcentajeAnticipo);
  const saldo = calcularSaldo(totalCliente, anticipo);

  return {
    totalCliente: positiveNumber(totalCliente),
    porcentajeAnticipo: positiveNumber(porcentajeAnticipo),
    anticipo,
    saldo,
  };
}