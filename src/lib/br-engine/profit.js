

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveNumber(value) {
  return Math.max(0, toNumber(value));
}

export function calcularUtilidad(precioCliente, costoInterno) {
  return positiveNumber(precioCliente) - positiveNumber(costoInterno);
}

export function calcularRentabilidadSobreCosto(utilidad, costoInterno) {
  const costo = positiveNumber(costoInterno);
  if (costo <= 0) return 0;
  return (toNumber(utilidad) / costo) * 100;
}

export function calcularRentabilidadSobreVenta(utilidad, precioCliente) {
  const venta = positiveNumber(precioCliente);
  if (venta <= 0) return 0;
  return (toNumber(utilidad) / venta) * 100;
}

export function analizarRentabilidad({
  costoInterno = 0,
  precioCliente = 0,
  margenMinimo = 25,
  margenSaludable = 40,
} = {}) {
  const costo = positiveNumber(costoInterno);
  const precio = positiveNumber(precioCliente);
  const utilidad = calcularUtilidad(precio, costo);
  const sobreCosto = calcularRentabilidadSobreCosto(utilidad, costo);
  const sobreVenta = calcularRentabilidadSobreVenta(utilidad, precio);

  let estado = 'sin-datos';
  let mensaje = 'Faltan datos para analizar la rentabilidad.';

  if (precio <= 0 || costo <= 0) {
    estado = 'sin-datos';
  } else if (utilidad < 0) {
    estado = 'perdida';
    mensaje = 'La cotización está por debajo del costo interno.';
  } else if (sobreCosto < positiveNumber(margenMinimo)) {
    estado = 'bajo';
    mensaje = 'La utilidad es baja. Conviene revisar precio, merma o materiales.';
  } else if (sobreCosto >= positiveNumber(margenSaludable)) {
    estado = 'saludable';
    mensaje = 'La cotización tiene una utilidad saludable.';
  } else {
    estado = 'aceptable';
    mensaje = 'La cotización es aceptable, pero puede optimizarse.';
  }

  return {
    costoInterno: costo,
    precioCliente: precio,
    utilidad,
    rentabilidadSobreCosto: sobreCosto,
    rentabilidadSobreVenta: sobreVenta,
    estado,
    mensaje,
  };
}