function marginAmountFromSaleAndCost(saleTotal, costTotal, helpers = {}) {
  const { numberValue } = helpers;
  return numberValue(saleTotal) - numberValue(costTotal);
}

export function quotePrintHtml(data, quote, materials, mode = 'client', doc = null, logo = '', helpers = {}) {
  const {
    brandName,
    clean,
    escapeHtml,
    money,
    professionalDocFromQuote,
    professionalDocHelpers,
    numberValue,
  } = helpers;
  const isBusiness = mode === 'business';
  const today = new Date().toLocaleDateString('es-MX');
  const folio = clean(data.folio || data.folioManual, 'Por asignar');
  const formaPago = clean(data.formaPago, 'Anticipo y saldo contra entrega');
  const notasCliente = clean(data.notasCliente);
  const notasInternas = clean(data.notasInternas);
  const documentData = doc || professionalDocFromQuote(data, quote, professionalDocHelpers);
  const internalRows = materials.map((item) => `
    <tr><td>${item.name}</td><td>${item.detail}</td><td>${money(item.cost)}</td></tr>
  `).join('');
  const clientRows = [
    ...quote.materialRows.map((item) => ({
      name: item.nombre,
      detail: `${item.rowQuantity.toFixed(2)} ${item.unidad} · ${item.calcLabel}${item.grosor ? ` · grosor ${item.grosor} mm` : ''}${item.nota ? ` · ${item.nota}` : ''}`,
      total: item.saleTotal,
    })),
    ...quote.accessoryRows.map((item) => ({
      name: item.nombre,
      detail: `${item.rowQuantity} pieza(s)${item.nota ? ` · ${item.nota}` : ''}`,
      total: item.saleTotal,
    })),
    { name: 'Mano de obra / instalación', detail: 'Servicio', total: quote.manoObra },
    { name: 'Extras', detail: 'Flete, selladores, tornillería u otros', total: quote.extras },
  ].filter((item) => item.name && item.total > 0).map((item) => `
    <tr><td>${item.name}</td><td>${item.detail}</td><td>${money(item.total)}</td></tr>
  `).join('');
  const measureRows = (quote.measureRows || []).map((item) => `
    <tr><td>${item.nombre}</td><td>${item.ancho} x ${item.alto} x ${item.fondo} cm · ${item.grosorMaterial} mm</td><td>${item.cantidad}</td><td>${item.areaTotal.toFixed(2)} m²</td><td>${item.linearTotal.toFixed(2)} m</td></tr>
  `).join('');
  const breakdownRows = (quote.breakdown || []).flatMap((group) => (
    group.lines.map((line) => `
      <tr><td>${group.title}</td><td>${line.label}</td><td>${line.detail}</td><td>${line.amount}</td></tr>
    `)
  )).join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
  <title>${isBusiness ? 'Hoja interna' : 'Cotización'} ${data.producto}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#17201b}
    header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #22745f;padding-bottom:18px;margin-bottom:24px}
    .brandline{display:flex;align-items:center;gap:12px}.logo{width:150px;height:84px;object-fit:contain;border-radius:8px}
    h1{margin:0;font-size:30px} h2{margin:24px 0 10px;font-size:18px} p{line-height:1.45}
    .brand{color:#22745f;font-weight:800}.total{font-size:34px;font-weight:900;color:#22745f}
    table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #d8d2c7;padding:10px;text-align:left}th{background:#eef1ed}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.box{border:1px solid #d8d2c7;padding:14px;border-radius:8px}
    .internal{background:#fff7df;border:1px solid #e6c66d;border-radius:8px;padding:12px;margin:18px 0}
    button{margin-top:20px;padding:12px 18px;border:0;border-radius:7px;background:#22745f;color:white;font-weight:800}
    @media print{button{display:none}body{padding:20px}}
  </style></head><body>
    <header><div class="brandline"><img src="${logo || '/branding/br-logo-horizontal.png'}" class="logo" alt="ALUXOR / BosqueReal" /><div><div class="brand">${brandName}</div><h1>${escapeHtml(documentData.titulo || (isBusiness ? 'Hoja interna del negocio' : 'Cotización'))}</h1><p>${today}</p></div></div><div><div>Total</div><div class="total">${escapeHtml(documentData.total || money(quote.total))}</div></div></header>
    ${isBusiness ? '<div class="internal"><strong>Uso interno ALUXOR.</strong> Esta hoja incluye costos, utilidad y datos de operación. No entregar al cliente.</div>' : ''}
    <section class="grid"><div class="box"><strong>Cliente</strong><p>${escapeHtml(documentData.cliente || clean(data.clienteNombre, 'Cliente'))}${data.clienteTelefono ? `<br>${data.clienteTelefono}` : ''}</p></div><div class="box"><strong>Proyecto</strong><p>${data.producto}<br>${data.tipoTrabajo}<br>${data.medidas}</p></div></section>
    <section class="grid"><div class="box"><strong>Folio</strong><p>${folio}</p></div><div class="box"><strong>Forma de pago</strong><p>${formaPago}</p></div></section>
    <h2>Descripción</h2><p>${escapeHtml(documentData.descripcion || `Material: ${data.material}. Acabado: ${data.acabado}. Incluye: ${data.incluye}.`)}</p>
    ${documentData.partidas ? `<h2>Partidas editadas</h2><p>${escapeHtml(documentData.partidas).replace(/\n/g, '<br>')}</p>` : ''}
    <h2>Medidas</h2><table><thead><tr><th>Partida</th><th>Medida</th><th>Cantidad</th><th>Área total</th><th>Metro lineal</th></tr></thead><tbody>${measureRows}</tbody></table>
    <h2>${isBusiness ? 'Lista interna de materiales y costos' : 'Conceptos de la cotización'}</h2><table><thead><tr><th>Concepto</th><th>Detalle</th><th>${isBusiness ? 'Importe interno' : 'Importe'}</th></tr></thead><tbody>${isBusiness ? internalRows : clientRows}</tbody></table>
    <h2>Resumen</h2><table><tbody>
      <tr><td>Material al cliente</td><td>${money(quote.material)}</td></tr>
      <tr><td>Herrajes</td><td>${money(quote.hardwareSale)}</td></tr>
      <tr><td>Mano de obra</td><td>${money(quote.manoObra)}</td></tr>
      <tr><td>Extras</td><td>${money(quote.extras)}</td></tr>
      <tr><td>Descuento</td><td>-${money(quote.discountAmount)}</td></tr>
      <tr><th>Total</th><th>${money(quote.total)}</th></tr>
      <tr><td>Anticipo sugerido</td><td>${escapeHtml(documentData.anticipo || money(quote.deposit))}</td></tr>
      <tr><td>Resto al entregar</td><td>${escapeHtml(documentData.saldo || money(quote.rest))}</td></tr>
      ${isBusiness ? `<tr><td>Margen material usado</td><td>${quote.margenMaterial}%</td></tr>` : ''}
    </tbody></table>
    ${isBusiness ? `<h2>Resumen interno ALUXOR</h2><table><tbody>
      <tr><td>Costo material base</td><td>${money(quote.materialBaseCost)}</td></tr>
      <tr><td>Merma</td><td>${money(quote.wasteCost)}</td></tr>
      <tr><td>Costo herrajes</td><td>${money(quote.hardwareCost)}</td></tr>
      <tr><td>Mano de obra como utilidad</td><td>${money(quote.laborProfit)}</td></tr>
      <tr><td>Costo total interno sin mano de obra</td><td>${money(quote.internalTotal)}</td></tr>
      <tr><td>Utilidad estimada</td><td>${money(quote.profit)} (${quote.profitPercent.toFixed(1)}%)</td></tr>
    </tbody></table><h2>Desglose del cálculo</h2><table><thead><tr><th>Área</th><th>Concepto</th><th>Por qué sale ese resultado</th><th>Resultado</th></tr></thead><tbody>${breakdownRows}</tbody></table>` : ''}
    ${isBusiness ? `<h2>Desglose interno ALUXOR</h2><p>Esta información es interna de ALUXOR y no debe compartirse con el cliente.</p><table><tbody>
      <tr><td>Total cliente</td><td>${money(quote.total)}</td></tr>
      <tr><td>Subtotal cliente</td><td>${money(quote.subtotal)}</td></tr>
      <tr><td>Descuento</td><td>-${money(quote.discountAmount)}</td></tr>
      <tr><td>Anticipo</td><td>${money(quote.deposit)}</td></tr>
      <tr><td>Saldo</td><td>${money(quote.rest)}</td></tr>
      <tr><td>Costo material base</td><td>${money(quote.materialBaseCost)}</td></tr>
      <tr><td>Merma</td><td>${money(quote.wasteCost)}</td></tr>
      <tr><td>Costo material interno</td><td>${money(quote.internalMaterialCost)}</td></tr>
      <tr><td>Costo herrajes</td><td>${money(quote.hardwareCost)}</td></tr>
      <tr><td>Extras</td><td>${money(quote.extras)}</td></tr>
      <tr><td>Total interno</td><td>${money(quote.internalTotal)}</td></tr>
      <tr><td>Mano de obra como ingreso/utilidad</td><td>${money(quote.laborProfit)}</td></tr>
      <tr><td>Utilidad estimada</td><td>${money(quote.profit)} (${quote.profitPercent.toFixed(1)}%)</td></tr>
      <tr><td>Porcentaje utilidad</td><td>${quote.profitPercent.toFixed(1)}%</td></tr>
      <tr><td>Margen material</td><td>${quote.margenMaterial}%</td></tr>
      <tr><td>Precio sugerido por m²</td><td>${money(quote.suggestedPriceM2)}</td></tr>
      <tr><td>Margen materiales</td><td>${money(marginAmountFromSaleAndCost(quote.material, quote.internalMaterialCost, { numberValue }))}</td></tr>
      <tr><td>Margen accesorios</td><td>${money(marginAmountFromSaleAndCost(quote.hardwareSale, quote.hardwareCost, { numberValue }))}</td></tr>
      <tr><td>Margen total estimado</td><td>${money(quote.profit)}</td></tr>
      ${notasInternas ? `<tr><td>Notas internas</td><td>${notasInternas}</td></tr>` : ''}
      <tr><td>Por qué se cobra así</td><td>Se calcula con materiales, herrajes, mano de obra, extras, descuento, merma y costo interno ya estimado por ALUXOR.</td></tr>
    </tbody></table>` : ''}
    <h2>Condiciones</h2><p>Vigencia: ${escapeHtml(documentData.vigencia || data.vigencia)} días. ${escapeHtml(documentData.condiciones || data.condiciones)}</p>
    ${(documentData.notas || notasCliente) ? `<h2>Notas para cliente</h2><p>${escapeHtml(documentData.notas || notasCliente)}</p>` : ''}
    ${isBusiness && notasInternas ? `<h2>Notas internas</h2><p>${notasInternas}</p>` : ''}
    <button onclick="window.print()">Imprimir o guardar PDF</button>
  </body></html>`;
}
