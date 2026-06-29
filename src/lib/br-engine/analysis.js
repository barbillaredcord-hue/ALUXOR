export function professionalChainInsights(quote, helpers = {}) {
  const { money, decimal, percentValue } = helpers;
  const totalInternal = Math.max(quote.internalTotal, 0);
  const percent = (value) => totalInternal > 0 ? decimal((value / totalInternal) * 100, 0) : '0';
  const materialShare = percent(quote.internalMaterialCost);
  const laborShare = quote.total > 0 ? decimal((quote.manoObra / quote.total) * 100, 0) : '0';
  const hardwareShare = percent(quote.hardwareCost);
  const sheetsWarning = quote.materialRows.find((item) => item.hojasNecesarias > 0 && item.areaHoja > 0 && item.areaConMerma > 0 && item.hojasNecesarias - (item.areaConMerma / item.areaHoja) >= 0.25);
  const highWaste = quote.materialRows.find((item) => percentValue(item.merma) >= 10);

  return [
    quote.wasteCost > 0 ? `✔ El incremento proviene de la merma: ${money(quote.wasteCost)}.` : '✔ No hay merma relevante capturada.',
    `✔ El material representa ${materialShare}% del costo interno.`,
    `✔ Mano de obra representa ${laborShare}% del precio cliente.`,
    `✔ Herrajes representan ${hardwareShare}% del costo interno.`,
    highWaste ? `⚠ La utilidad podría aumentar reduciendo desperdicio en ${highWaste.nombre}.` : null,
    sheetsWarning ? `⚠ Se compran ${sheetsWarning.hojasNecesarias} hojas completas aunque se usan ${decimal(sheetsWarning.areaConMerma / sheetsWarning.areaHoja)} hojas equivalentes.` : null,
  ].filter(Boolean);
}
