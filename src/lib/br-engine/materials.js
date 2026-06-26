

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveNumber(value) {
  return Math.max(0, toNumber(value));
}

export function calcularAreaUnidad(ancho, alto) {
  return positiveNumber(ancho) * positiveNumber(alto);
}

export function calcularCostoMetroCuadrado(precioUnidad, ancho, alto) {
  const areaUnidad = calcularAreaUnidad(ancho, alto);
  if (areaUnidad <= 0) return 0;
  return positiveNumber(precioUnidad) / areaUnidad;
}

export function calcularCostoMetroLineal(precioUnidad, largo) {
  const largoUnidad = positiveNumber(largo);
  if (largoUnidad <= 0) return 0;
  return positiveNumber(precioUnidad) / largoUnidad;
}

export function calcularAreaConMerma(areaNecesaria, merma = 0) {
  return positiveNumber(areaNecesaria) * (1 + positiveNumber(merma) / 100);
}

export function calcularLinealConMerma(linealNecesario, merma = 0) {
  return positiveNumber(linealNecesario) * (1 + positiveNumber(merma) / 100);
}

export function calcularCantidadConMerma(cantidad, merma = 0) {
  return positiveNumber(cantidad) * (1 + positiveNumber(merma) / 100);
}

export function calcularHojasNecesarias(areaNecesaria, areaUnidad, merma = 0) {
  const areaCompra = calcularAreaConMerma(areaNecesaria, merma);
  const areaPorUnidad = positiveNumber(areaUnidad);
  if (areaPorUnidad <= 0) return 0;
  return Math.ceil(areaCompra / areaPorUnidad);
}

export function calcularPiezasNecesarias(cantidad, merma = 0) {
  return Math.ceil(calcularCantidadConMerma(cantidad, merma));
}

export function calcularMaterialPorHoja({
  areaNecesaria = 0,
  ancho = 0,
  alto = 0,
  precioUnidad = 0,
  merma = 0,
  margen = 0,
} = {}) {
  const areaUnidad = calcularAreaUnidad(ancho, alto);
  const areaConMerma = calcularAreaConMerma(areaNecesaria, merma);
  const unidadesNecesarias = calcularHojasNecesarias(areaNecesaria, areaUnidad, merma);
  const costoMetroCuadrado = calcularCostoMetroCuadrado(precioUnidad, ancho, alto);
  const costoInterno = unidadesNecesarias * positiveNumber(precioUnidad);
  const precioCliente = costoInterno * (1 + positiveNumber(margen) / 100);
  const utilidad = precioCliente - costoInterno;

  return {
    tipo: 'hoja',
    areaUnidad,
    areaNecesaria: positiveNumber(areaNecesaria),
    areaConMerma,
    unidadesNecesarias,
    costoMetroCuadrado,
    costoInterno,
    precioCliente,
    utilidad,
  };
}

export function calcularMaterialLineal({
  linealNecesario = 0,
  precioMetroLineal = 0,
  merma = 0,
  margen = 0,
} = {}) {
  const linealConMerma = calcularLinealConMerma(linealNecesario, merma);
  const costoInterno = linealConMerma * positiveNumber(precioMetroLineal);
  const precioCliente = costoInterno * (1 + positiveNumber(margen) / 100);
  const utilidad = precioCliente - costoInterno;

  return {
    tipo: 'lineal',
    linealNecesario: positiveNumber(linealNecesario),
    linealConMerma,
    costoMetroLineal: positiveNumber(precioMetroLineal),
    costoInterno,
    precioCliente,
    utilidad,
  };
}

export function calcularMaterialPorPieza({
  cantidad = 0,
  precioUnidad = 0,
  merma = 0,
  margen = 0,
} = {}) {
  const unidadesNecesarias = calcularPiezasNecesarias(cantidad, merma);
  const costoInterno = unidadesNecesarias * positiveNumber(precioUnidad);
  const precioCliente = costoInterno * (1 + positiveNumber(margen) / 100);
  const utilidad = precioCliente - costoInterno;

  return {
    tipo: 'pieza',
    cantidad: positiveNumber(cantidad),
    unidadesNecesarias,
    costoUnidad: positiveNumber(precioUnidad),
    costoInterno,
    precioCliente,
    utilidad,
  };
}