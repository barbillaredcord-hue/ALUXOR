

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveNumber(value) {
  return Math.max(0, toNumber(value));
}

export function calcularFactorMerma(merma = 0) {
  return 1 + positiveNumber(merma) / 100;
}

export function calcularMerma(areaNecesaria, merma = 0) {
  return positiveNumber(areaNecesaria) * (calcularFactorMerma(merma) - 1);
}

export function calcularAreaConMerma(areaNecesaria, merma = 0) {
  return positiveNumber(areaNecesaria) * calcularFactorMerma(merma);
}

export function calcularDesperdicio(areaComprada, areaUtilizada) {
  return Math.max(0, positiveNumber(areaComprada) - positiveNumber(areaUtilizada));
}

export function calcularPorcentajeDesperdicio(areaComprada, areaUtilizada) {
  const comprada = positiveNumber(areaComprada);
  if (comprada <= 0) return 0;
  return (calcularDesperdicio(comprada, areaUtilizada) / comprada) * 100;
}

export function redondearCompra(unidades) {
  return Math.ceil(positiveNumber(unidades));
}

export function calcularCostoDesperdicio(costoInterno, desperdicio, areaComprada) {
  const comprada = positiveNumber(areaComprada);
  if (comprada <= 0) return 0;
  return (positiveNumber(costoInterno) / comprada) * positiveNumber(desperdicio);
}

export function analizarMerma({
  areaNecesaria = 0,
  areaComprada = 0,
  costoInterno = 0,
} = {}) {
  const desperdicio = calcularDesperdicio(areaComprada, areaNecesaria);
  const porcentaje = calcularPorcentajeDesperdicio(areaComprada, areaNecesaria);
  const costoDesperdicio = calcularCostoDesperdicio(costoInterno, desperdicio, areaComprada);

  return {
    areaNecesaria: positiveNumber(areaNecesaria),
    areaComprada: positiveNumber(areaComprada),
    desperdicio,
    porcentaje,
    costoDesperdicio,
  };
}