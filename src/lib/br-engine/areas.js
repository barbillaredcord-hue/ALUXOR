

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function calcularArea(ancho, alto, cantidad = 1) {
  return toNumber(ancho) * toNumber(alto) * toNumber(cantidad);
}

export function calcularAreaPieza(ancho, alto) {
  return toNumber(ancho) * toNumber(alto);
}

export function calcularAreaTotal(items = []) {
  return items.reduce((total, item) => {
    return total + calcularArea(item.ancho, item.alto, item.cantidad);
  }, 0);
}

export function calcularMetroLineal(largo, cantidad = 1) {
  return toNumber(largo) * toNumber(cantidad);
}

export function calcularMetroLinealTotal(items = []) {
  return items.reduce((total, item) => {
    return total + calcularMetroLineal(item.largo, item.cantidad);
  }, 0);
}

export function calcularPerímetro(ancho, alto, cantidad = 1) {
  return (toNumber(ancho) * 2 + toNumber(alto) * 2) * toNumber(cantidad);
}

export function calcularVolumen(ancho, alto, fondo, cantidad = 1) {
  return (
    toNumber(ancho) *
    toNumber(alto) *
    toNumber(fondo) *
    toNumber(cantidad)
  );
}