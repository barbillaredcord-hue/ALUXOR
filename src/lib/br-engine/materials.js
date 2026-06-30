function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveNumber(value) {
  return Math.max(0, toNumber(value));
}

function percentFactor(value) {
  return 1 + positiveNumber(value) / 100;
}

function normalizarTipoCompra(tipoCompra = 'manual') {
  const tipo = String(tipoCompra || 'manual').toLowerCase();

  if (['hoja', 'placa', 'sheet', 'panel'].includes(tipo)) return 'hoja';
  if (['lineal', 'metro-lineal', 'ml', 'linear'].includes(tipo)) return 'lineal';
  if (['pieza', 'pza', 'unidad', 'juego'].includes(tipo)) return 'pieza';
  if (['m2', 'area', 'metro-cuadrado', 'metro cuadrado'].includes(tipo)) return 'm2';

  return 'manual';
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
  return positiveNumber(areaNecesaria) * percentFactor(merma);
}

export function calcularLinealConMerma(linealNecesario, merma = 0) {
  return positiveNumber(linealNecesario) * percentFactor(merma);
}

export function calcularCantidadConMerma(cantidad, merma = 0) {
  return positiveNumber(cantidad) * percentFactor(merma);
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

export function calcularDesperdicio(areaComprada, areaUtilizada) {
  return Math.max(0, positiveNumber(areaComprada) - positiveNumber(areaUtilizada));
}

export function calcularMaterialPorHoja({
  areaNecesaria = 0,
  ancho = 0,
  alto = 0,
  precioUnidad = 0,
  merma = 0,
  margen = 0,
  precioManual = 0,
  usarPrecioManual = false,
  optimization = null,
} = {}) {
  const areaUnidad = calcularAreaUnidad(ancho, alto);
  const areaConMerma = calcularAreaConMerma(areaNecesaria, merma);
  const unidadesNecesarias = optimization?.summary?.requiredSheets ?? calcularHojasNecesarias(areaNecesaria, areaUnidad, merma);
  const areaComprada = unidadesNecesarias * areaUnidad;
  const desperdicio = optimization?.summary?.wasteArea !== undefined
    ? positiveNumber(optimization.summary.wasteArea) / 10000
    : calcularDesperdicio(areaComprada, areaNecesaria);
  const costoMetroCuadrado = calcularCostoMetroCuadrado(precioUnidad, ancho, alto);
  const costoInterno = unidadesNecesarias * positiveNumber(precioUnidad);
  const precioSugerido = costoInterno * percentFactor(margen);
  const precioCliente = usarPrecioManual ? positiveNumber(precioManual) : precioSugerido;
  const utilidad = precioCliente - costoInterno;
  const precioClienteMetroCuadrado = positiveNumber(areaNecesaria) > 0
    ? precioCliente / positiveNumber(areaNecesaria)
    : 0;

  return {
    tipo: 'hoja',
    areaUnidad,
    areaNecesaria: positiveNumber(areaNecesaria),
    areaConMerma,
    areaComprada,
    desperdicio,
    unidadesNecesarias,
    costoMetroCuadrado,
    costoInterno,
    precioSugerido,
    precioCliente,
    precioClienteMetroCuadrado,
    utilidad,
    optimization,
    margen: positiveNumber(margen),
    merma: positiveNumber(merma),
  };
}

export function calcularMaterialMetroCuadrado({
  areaNecesaria = 0,
  precioMetroCuadrado = 0,
  merma = 0,
  margen = 0,
  precioManual = 0,
  usarPrecioManual = false,
  optimization = null,
} = {}) {
  const areaConMerma = calcularAreaConMerma(areaNecesaria, merma);
  const costoInterno = areaConMerma * positiveNumber(precioMetroCuadrado);
  const precioSugerido = costoInterno * percentFactor(margen);
  const precioCliente = usarPrecioManual ? positiveNumber(precioManual) : precioSugerido;
  const utilidad = precioCliente - costoInterno;
  const precioClienteMetroCuadrado = positiveNumber(areaNecesaria) > 0
    ? precioCliente / positiveNumber(areaNecesaria)
    : 0;

  return {
    tipo: 'm2',
    areaNecesaria: positiveNumber(areaNecesaria),
    areaConMerma,
    costoMetroCuadrado: positiveNumber(precioMetroCuadrado),
    costoInterno,
    precioSugerido,
    precioCliente,
    precioClienteMetroCuadrado,
    utilidad,
    margen: positiveNumber(margen),
    merma: positiveNumber(merma),
  };
}

export function calcularMaterialLineal({
  linealNecesario = 0,
  precioMetroLineal = 0,
  merma = 0,
  margen = 0,
  precioManual = 0,
  usarPrecioManual = false,
  optimization = null,
} = {}) {
  const linealConMerma = calcularLinealConMerma(linealNecesario, merma);
  const costoInterno = linealConMerma * positiveNumber(precioMetroLineal);
  const precioSugerido = costoInterno * percentFactor(margen);
  const precioCliente = usarPrecioManual ? positiveNumber(precioManual) : precioSugerido;
  const utilidad = precioCliente - costoInterno;
  const precioClienteMetroLineal = positiveNumber(linealNecesario) > 0
    ? precioCliente / positiveNumber(linealNecesario)
    : 0;

  return {
    tipo: 'lineal',
    linealNecesario: positiveNumber(linealNecesario),
    linealConMerma,
    costoMetroLineal: positiveNumber(precioMetroLineal),
    costoInterno,
    precioSugerido,
    precioCliente,
    precioClienteMetroLineal,
    utilidad,
    margen: positiveNumber(margen),
    merma: positiveNumber(merma),
  };
}

export function calcularMaterialPorPieza({
  cantidad = 0,
  precioUnidad = 0,
  merma = 0,
  margen = 0,
  precioManual = 0,
  usarPrecioManual = false,
  optimization = null,
} = {}) {
  const cantidadConMerma = calcularCantidadConMerma(cantidad, merma);
  const unidadesNecesarias = Math.ceil(cantidadConMerma);
  const costoInterno = unidadesNecesarias * positiveNumber(precioUnidad);
  const precioSugerido = costoInterno * percentFactor(margen);
  const precioCliente = usarPrecioManual ? positiveNumber(precioManual) : precioSugerido;
  const utilidad = precioCliente - costoInterno;
  const precioClienteUnidad = positiveNumber(cantidad) > 0
    ? precioCliente / positiveNumber(cantidad)
    : 0;

  return {
    tipo: 'pieza',
    cantidad: positiveNumber(cantidad),
    cantidadConMerma,
    unidadesNecesarias,
    costoUnidad: positiveNumber(precioUnidad),
    costoInterno,
    precioSugerido,
    precioCliente,
    precioClienteUnidad,
    utilidad,
    margen: positiveNumber(margen),
    merma: positiveNumber(merma),
  };
}

export function calcularMaterialManual({
  cantidad = 1,
  costoInterno = 0,
  merma = 0,
  margen = 0,
  precioManual = 0,
  usarPrecioManual = false,
} = {}) {
  const cantidadReal = positiveNumber(cantidad) || 1;
  const cantidadConMerma = calcularCantidadConMerma(cantidadReal, merma);
  const unidadesNecesarias = Math.ceil(cantidadConMerma);
  const costoTotal = positiveNumber(costoInterno) * unidadesNecesarias;
  const precioSugerido = costoTotal * percentFactor(margen);
  const precioCliente = usarPrecioManual ? positiveNumber(precioManual) : precioSugerido;
  const utilidad = precioCliente - costoTotal;

  return {
    tipo: 'manual',
    cantidad: cantidadReal,
    cantidadConMerma,
    unidadesNecesarias,
    costoInterno: costoTotal,
    precioSugerido,
    precioCliente,
    utilidad,
    margen: positiveNumber(margen),
    merma: positiveNumber(merma),
  };
}

export function calcularMaterial({
  tipoCompra = 'manual',
  areaNecesaria = 0,
  linealNecesario = 0,
  cantidad = 0,
  ancho = 0,
  alto = 0,
  precioUnidad = 0,
  precioMetroCuadrado = 0,
  precioMetroLineal = 0,
  costoInterno = 0,
  merma = 0,
  margen = 0,
  precioManual = 0,
  usarPrecioManual = false,
  optimization = null,
} = {}) {
  const tipo = normalizarTipoCompra(tipoCompra);

  if (tipo === 'hoja') {
    return calcularMaterialPorHoja({
      areaNecesaria,
      ancho,
      alto,
      precioUnidad,
      merma,
      margen,
      precioManual,
      usarPrecioManual,
      optimization,
    });
  }

  if (tipo === 'm2') {
    return calcularMaterialMetroCuadrado({
      areaNecesaria,
      precioMetroCuadrado: precioMetroCuadrado || precioUnidad,
      merma,
      margen,
      precioManual,
      usarPrecioManual,
    });
  }

  if (tipo === 'lineal') {
    return calcularMaterialLineal({
      linealNecesario,
      precioMetroLineal: precioMetroLineal || precioUnidad,
      merma,
      margen,
      precioManual,
      usarPrecioManual,
    });
  }

  if (tipo === 'pieza') {
    return calcularMaterialPorPieza({
      cantidad,
      precioUnidad,
      merma,
      margen,
      precioManual,
      usarPrecioManual,
    });
  }

  return calcularMaterialManual({
    cantidad: cantidad || 1,
    costoInterno: costoInterno || precioUnidad,
    merma,
    margen,
    precioManual,
    usarPrecioManual,
  });
}
