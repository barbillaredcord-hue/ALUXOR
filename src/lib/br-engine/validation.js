

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveNumber(value) {
  return Math.max(0, toNumber(value));
}

export function isPositive(value) {
  return positiveNumber(value) > 0;
}

export function hasValidArea({ ancho = 0, alto = 0 } = {}) {
  return isPositive(ancho) && isPositive(alto);
}

export function hasValidLineal({ largo = 0 } = {}) {
  return isPositive(largo);
}

export function hasValidPrice(value) {
  return isPositive(value);
}

export function clampPercent(value, min = 0, max = 500) {
  return Math.min(max, Math.max(min, positiveNumber(value)));
}

export function validateMeasure(item = {}) {
  const warnings = [];

  if (!item.nombre) warnings.push('La medida no tiene nombre.');
  if (!isPositive(item.cantidad || 1)) warnings.push('La cantidad debe ser mayor a 0.');
  if (!hasValidArea(item) && !hasValidLineal(item)) {
    warnings.push('Captura ancho y alto, o un largo válido.');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export function validateMaterial(item = {}) {
  const warnings = [];
  const tipoCompra = item.tipoCompra || item.tipo || 'manual';

  if (!item.nombre) warnings.push('El material no tiene nombre.');
  if (!hasValidPrice(item.precioCompra ?? item.costoUnitario ?? item.precioUnidad)) {
    warnings.push('El material no tiene precio de compra válido.');
  }

  if (tipoCompra === 'hoja' || tipoCompra === 'placa') {
    if (!hasValidArea({ ancho: item.ancho, alto: item.alto })) {
      warnings.push('Captura ancho y alto de la hoja o placa.');
    }
  }

  if (tipoCompra === 'lineal' && !hasValidLineal({ largo: item.largo })) {
    warnings.push('Captura el largo o metro lineal del material.');
  }

  if (positiveNumber(item.merma) > 40) {
    warnings.push('La merma es alta. Revisa si el porcentaje es correcto.');
  }

  if (positiveNumber(item.margen) < 20) {
    warnings.push('El margen es bajo. Puede afectar la utilidad del taller.');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export function validateQuote({
  cliente = {},
  medidas = [],
  materiales = [],
} = {}) {
  const warnings = [];

  if (!cliente.nombre && !cliente.clienteNombre) {
    warnings.push('Falta el nombre del cliente.');
  }

  if (!Array.isArray(medidas) || medidas.length === 0) {
    warnings.push('Agrega al menos una medida.');
  }

  if (!Array.isArray(materiales) || materiales.length === 0) {
    warnings.push('Agrega al menos un material.');
  }

  medidas.forEach((item, index) => {
    const result = validateMeasure(item);
    result.warnings.forEach((warning) => {
      warnings.push(`Medida ${index + 1}: ${warning}`);
    });
  });

  materiales.forEach((item, index) => {
    const result = validateMaterial(item);
    result.warnings.forEach((warning) => {
      warnings.push(`Material ${index + 1}: ${warning}`);
    });
  });

  return {
    valid: warnings.length === 0,
    warnings,
  };
}