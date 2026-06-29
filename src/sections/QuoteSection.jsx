import { Copy, Eraser, FileText, MessageCircle, Save } from 'lucide-react';
import CalculationChain from '../components/CalculationChain.jsx';
import DashboardSummary from '../components/DashboardSummary.jsx';
import Field from '../components/Field.jsx';
import { Quote } from '../lib/br-engine/index.js';

export default function QuoteSection({
  quoteProfiles,
  applyQuoteProfile,
  quickCalc,
  updateQuickCalc,
  form,
  quote,
  quoteHelpers,
  quickAreaPorPieza,
  quickCostoM2,
  quickCostoLineal,
  quickHojasComprar,
  quickPiezasComprar,
  quickCompraSinMerma,
  quickCompraConMerma,
  quickPricing,
  quickTotalClienteSinMargen,
  quickTotalClienteConMargen,
  quickProfit,
  quickProfitPercent,
  decimal,
  money,
  copyText,
  quickCalcText,
  applyQuickCalcToMaterial,
  guideFor,
  input,
  textareaInput,
  currentTypeOptions,
  update,
  updateMeasureItem,
  numberValue,
  removeMeasureItem,
  addMeasureItem,
  updateMaterialItem,
  removeMaterialItem,
  addMaterialItem,
  updateAccessoryItem,
  removeAccessoryItem,
  addAccessoryItem,
  dataHealth,
  floatingSummary,
  startSummaryDrag,
  setFloatingSummary,
  saveToHistory,
  openPrint,
  openWhatsApp,
  chainInsights,
  professionalAnalysis,
}) {
  return (
          <section className="quote-workspace panel-grid two-cols">
            <article className="panel quote-editor">
              <div className="section-head quote-head">
                <div>
                  <h2>Cotizador profesional</h2>
                  <p>Captura por secciones, con medidas y materiales listos para editar.</p>
                </div>
              </div>
              <div className="actions compact">
                {Object.keys(quoteProfiles).map((key) => (
                  <button key={key} type="button" className="ghost" onClick={() => applyQuoteProfile(key)}>
                    {quoteProfiles[key].title}
                  </button>
                ))}
              </div>

              <details className="quote-accordion quick-calculator" open>
                <DashboardSummary number="03" title="Calculadora rápida de material" description="Herramienta de referencia, no suma hasta aplicar." status="Herramienta" highlight />
                <div className="form-grid">
                  <Field id="quickNombre" label="Nombre del material"><input id="quickNombre" value={quickCalc.nombre} onChange={(event) => updateQuickCalc('nombre', event.target.value)} /></Field>
                  <Field id="quickCategoria" label="Categoría">
                    <select id="quickCategoria" value={quickCalc.categoria} onChange={(event) => updateQuickCalc('categoria', event.target.value)}>
                      <option>Vidrio</option>
                      <option>Aluminio</option>
                      <option>Madera/Melamina</option>
                      <option>Herraje</option>
                      <option>Otro</option>
                    </select>
                  </Field>
                  <Field id="quickTipoCompra" label="Tipo de compra">
                    <select id="quickTipoCompra" value={quickCalc.tipoCompra} onChange={(event) => updateQuickCalc('tipoCompra', event.target.value)}>
                      <option value="hoja">Hoja / placa</option>
                      <option value="pieza">Pieza</option>
                      <option value="area">Metro cuadrado</option>
                      <option value="lineal">Metro lineal</option>
                      <option value="manual">Manual</option>
                    </select>
                  </Field>
                  <Field id="quickMaterialId" label="Material destino">
                    <select id="quickMaterialId" value={quickCalc.materialId} onChange={(event) => updateQuickCalc('materialId', event.target.value)}>
                      <option value="">Crear nuevo</option>
                      {Quote.materialItemsFromForm(form, quote.areaTotal, quoteHelpers).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </Field>
                  <Field id="quickBaseUso" label="Usar base">
                    <select id="quickBaseUso" value={quickCalc.baseUso} onChange={(event) => updateQuickCalc('baseUso', event.target.value)}>
                      <option value="medidas">Automático de medidas</option>
                      <option value="manual">Captura manual</option>
                    </select>
                  </Field>
                  <Field id="quickAncho" label="Ancho cm"><input id="quickAncho" type="number" value={quickCalc.ancho} onChange={(event) => updateQuickCalc('ancho', event.target.value)} /></Field>
                  <Field id="quickAlto" label="Alto cm"><input id="quickAlto" type="number" value={quickCalc.alto} onChange={(event) => updateQuickCalc('alto', event.target.value)} /></Field>
                  <Field id="quickLargo" label="Largo cm"><input id="quickLargo" type="number" value={quickCalc.largo} onChange={(event) => updateQuickCalc('largo', event.target.value)} /></Field>
                  <Field id="quickCantidad" label="Cantidad comprada"><input id="quickCantidad" type="number" value={quickCalc.cantidad} onChange={(event) => updateQuickCalc('cantidad', event.target.value)} /></Field>
                  <Field id="quickPrecioTotal" label="Precio total de compra"><input id="quickPrecioTotal" type="number" value={quickCalc.precioTotal} onChange={(event) => updateQuickCalc('precioTotal', event.target.value)} /></Field>
                  <Field id="quickAreaManual" label="Área necesaria manual"><input id="quickAreaManual" type="number" value={quickCalc.areaManual} onChange={(event) => updateQuickCalc('areaManual', event.target.value)} /></Field>
                  <Field id="quickLinealManual" label="ML necesarios manual"><input id="quickLinealManual" type="number" value={quickCalc.linealManual} onChange={(event) => updateQuickCalc('linealManual', event.target.value)} /></Field>
                  <Field id="quickCantidadManual" label="Cantidad necesaria manual"><input id="quickCantidadManual" type="number" value={quickCalc.cantidadManual} onChange={(event) => updateQuickCalc('cantidadManual', event.target.value)} /></Field>
                  <Field id="quickMerma" label="Merma %"><input id="quickMerma" type="number" value={quickCalc.merma} onChange={(event) => updateQuickCalc('merma', event.target.value)} /></Field>
                  <Field id="quickMargen" label="Margen %"><input id="quickMargen" type="number" value={quickCalc.margen} onChange={(event) => updateQuickCalc('margen', event.target.value)} /></Field>
                </div>
                <div className="quick-result-groups">
                  <section>
                    <h3>Costo interno sin venta</h3>
                    <div className="quick-results">
                      <div><span>Área por hoja/pieza</span><strong>{decimal(quickAreaPorPieza)} m²</strong></div>
                      <div><span>Costo real por m²</span><strong>{money(quickCostoM2)}</strong></div>
                      <div><span>Costo real por ML</span><strong>{money(quickCostoLineal)}</strong></div>
                      <div><span>Hojas/piezas a comprar</span><strong>{quickCalc.tipoCompra === 'hoja' ? quickHojasComprar : quickPiezasComprar}</strong></div>
                      <div><span>Total sin merma</span><strong>{money(quickCompraSinMerma)}</strong></div>
                      <div><span>Total con merma</span><strong>{money(quickCompraConMerma)}</strong></div>
                    </div>
                  </section>
                  <section>
                    <h3>Precio sugerido al cliente</h3>
                    <div className="quick-results">
                      <div><span>Precio m² sin margen</span><strong>{money(quickPricing.costoConMerma)}</strong></div>
                      <div><span>Precio m² con margen</span><strong>{money(quickPricing.precioCliente)}</strong></div>
                      <div><span>Precio ML con margen</span><strong>{money(quickCalc.tipoCompra === 'lineal' ? quickPricing.precioCliente : 0)}</strong></div>
                      <div><span>Total sin margen</span><strong>{money(quickTotalClienteSinMargen)}</strong></div>
                      <div><span>Total con margen</span><strong>{money(quickTotalClienteConMargen)}</strong></div>
                      <div><span>Utilidad</span><strong>{money(quickProfit)} ({decimal(quickProfitPercent, 1)}%)</strong></div>
                    </div>
                  </section>
                </div>
                <details className="field-help calc-help">
                  <summary>¿Cómo se calculó?</summary>
                  <span>Se multiplica ancho x alto para obtener m² por hoja.</span>
                  <span>Se multiplica por cantidad comprada.</span>
                  <span>Se divide precio total entre m² totales.</span>
                  <span>Se aplica merma.</span>
                  <span>Se aplica margen para obtener precio al cliente.</span>
                </details>
                <div className="actions compact">
                  <button type="button" className="ghost" onClick={() => copyText(quickCalcText(), 'Calculadora de costo')}><Copy size={18} /> Copiar</button>
                  <button type="button" className="ghost" onClick={applyQuickCalcToMaterial}>Aplicar a material</button>
                </div>
              </details>

              <div className="quote-accordion-list">
                <details className="quote-accordion" open>
                  <DashboardSummary number="01" title="Cliente y proyecto" description="Datos básicos para identificar la cotización." status={form.clienteNombre ? 'Completo' : 'Incompleto'} />
                  <div className="form-grid">
                    <Field id="clienteNombre" label="Cliente" {...guideFor('clienteNombre')}>{input('clienteNombre')}</Field>
                    <Field id="clienteTelefono" label="Teléfono" {...guideFor('clienteTelefono')}>{input('clienteTelefono')}</Field>
                    <Field id="ciudad" label="Ciudad">{input('ciudad')}</Field>
                    <Field id="whatsapp" label="WhatsApp">{input('whatsapp')}</Field>
                  </div>
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="01B" title="Proyecto / diseño" description="Producto, tipo de trabajo y acabado." status={form.producto ? 'Completo' : 'Revisar'} />
                  <div className="form-grid">
                    <Field id="giro" label="Giro">{input('giro')}</Field>
                    <Field id="tipoTrabajo" label="Tipo de trabajo">
                      <select id="tipoTrabajo" value={form.tipoTrabajo} onChange={(event) => update('tipoTrabajo', event.target.value)}>
                        {currentTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </Field>
                    <Field id="producto" label="Producto" {...guideFor('producto')}>{input('producto')}</Field>
                    <Field id="material" label="Diseño / acabado base">{input('material')}</Field>
                    <Field id="acabado" label="Acabado">{input('acabado')}</Field>
                    <Field id="beneficio" label="Beneficio">{textareaInput('beneficio')}</Field>
                  </div>
                </details>

                <details className="quote-accordion" open>
                  <DashboardSummary number="02" title="Medidas del trabajo" description="Área, metro lineal y piezas del proyecto." status={quote.areaTotal > 0 ? 'Completo' : 'Revisar'} highlight />
                  <div className="quick-results measure-totals">
                    <div><span>Área total del proyecto</span><strong>{decimal(quote.areaTotal)} m²</strong></div>
                    <div><span>Metro lineal total</span><strong>{decimal(quote.linearTotal)} m</strong></div>
                    <div><span>Cantidad total de piezas</span><strong>{decimal(quote.cantidad, 0)}</strong></div>
                  </div>
                  <CalculationChain
                    title="Cálculo de medidas"
                    steps={[
                      { title: 'Área por pieza', input: `${quote.measureRows[0]?.ancho || 0} cm x ${quote.measureRows[0]?.alto || 0} cm`, operation: '(ancho / 100) x (alto / 100)', result: `${decimal(quote.measureRows[0]?.area || 0)} m²`, next: 'Área total del proyecto' },
                      { title: 'Área total del proyecto', input: `${quote.measureRows.length} partida(s)`, operation: 'Suma de área por pieza x cantidad.', result: `${decimal(quote.areaTotal)} m²`, next: 'Metro lineal total' },
                      { title: 'Metro lineal total', input: 'Ancho + alto por partida', operation: '((ancho + alto) x 2 / 100) x cantidad.', result: `${decimal(quote.linearTotal)} m`, next: 'Cantidad total' },
                      { title: 'Cantidad total', input: 'Cantidad de cada partida', operation: 'Suma de cantidades capturadas.', result: `${decimal(quote.cantidad, 0)} pieza(s)`, next: 'Materiales' },
                    ]}
                  />
                  <div className="quote-table quote-measures-table">
                    <div className="quote-table-header">Nombre</div>
                    <div className="quote-table-header">Ancho</div>
                    <div className="quote-table-header">Alto</div>
                    <div className="quote-table-header">Fondo</div>
                    <div className="quote-table-header">Cantidad</div>
                    <div className="quote-table-header">Área</div>
                    <div className="quote-table-header">Metro lineal</div>
                    <div className="quote-table-header">Subtotal</div>
                    <div className="quote-table-header">Borrar</div>
                    {quote.measureRows.map((item) => (
                      <div key={item.id} className="quote-table-row quote-measure-row">
                        <input value={item.nombre} onChange={(event) => updateMeasureItem(item.id, 'nombre', event.target.value)} aria-label="Nombre de medida" />
                        <input type="number" value={item.ancho} onChange={(event) => updateMeasureItem(item.id, 'ancho', numberValue(event.target.value))} aria-label="Ancho" />
                        <input type="number" value={item.alto} onChange={(event) => updateMeasureItem(item.id, 'alto', numberValue(event.target.value))} aria-label="Alto" />
                        <input type="number" value={item.fondo} onChange={(event) => updateMeasureItem(item.id, 'fondo', numberValue(event.target.value))} aria-label="Fondo" />
                        <input type="number" value={item.cantidad} onChange={(event) => updateMeasureItem(item.id, 'cantidad', numberValue(event.target.value))} aria-label="Cantidad" />
                        <strong>{decimal(item.areaTotal)} m²</strong>
                        <strong>{decimal(item.linearTotal)} m</strong>
                        <strong>{decimal(item.areaTotal)} m²</strong>
                        <button type="button" className="ghost" onClick={() => removeMeasureItem(item.id)} aria-label="Eliminar medida"><Eraser size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="ghost add-row-button" onClick={addMeasureItem}>Agregar medida</button>
                </details>

                <details className="quote-accordion" open>
                  <DashboardSummary number="04" title="Materiales de cotización" description="Compra, merma, margen y utilidad por material." status={quote.material > 0 ? 'Completo' : 'Revisar'} highlight />
                  <div className="form-grid material-base-grid">
                    <Field id="materialCotizacion" label="Material cotización" {...guideFor('materialCotizacion')}>{input('materialCotizacion')}</Field>
                    <Field id="precioM2" label="Precio m²" {...guideFor('precioM2')}>{input('precioM2', 'number')}</Field>
                    <Field id="costoMaterialM2" label="Costo m²" {...guideFor('costoMaterialM2')}>{input('costoMaterialM2', 'number')}</Field>
                    <Field id="merma" label="Merma %" {...guideFor('merma')}>{input('merma', 'number')}</Field>
                    <Field id="margenMaterial" label="Margen %" {...guideFor('margenMaterial')}>{input('margenMaterial', 'number')}</Field>
                  </div>
                  <div className="quote-table quote-materials-table">
                    <div className="quote-table-header">Material</div>
                    <div className="quote-table-header">Categoría</div>
                    <div className="quote-table-header">Compra</div>
                    <div className="quote-table-header">Base</div>
                    <div className="quote-table-header">Área/ml/cant.</div>
                    <div className="quote-table-header">Medida compra</div>
                    <div className="quote-table-header">Merma %</div>
                    <div className="quote-table-header">Margen %</div>
                    <div className="quote-table-header">Cantidad a comprar</div>
                    <div className="quote-table-header">Costo interno</div>
                    <div className="quote-table-header">Cliente</div>
                    <div className="quote-table-header">Utilidad</div>
                    <div className="quote-table-header">Borrar</div>
                    {quote.materialRows.map((item) => (
                      <div key={item.id} className="quote-table-row quote-material-row">
                        <input value={item.nombre} onChange={(event) => updateMaterialItem(item.id, 'nombre', event.target.value)} aria-label="Material" />
                        <select value={item.categoria} onChange={(event) => updateMaterialItem(item.id, 'categoria', event.target.value)} aria-label="Categoría">
                          <option>Vidrio</option>
                          <option>Aluminio</option>
                          <option>Madera/Melamina</option>
                          <option>Herraje</option>
                          <option>Otro</option>
                        </select>
                        <select value={item.tipoCompra} onChange={(event) => updateMaterialItem(item.id, 'tipoCompra', event.target.value)} aria-label="Tipo de compra">
                          <option value="manual">Manual</option>
                          <option value="pieza">Pieza</option>
                          <option value="area">m²</option>
                          <option value="lineal">Metro lineal</option>
                          <option value="hoja">Hoja / placa</option>
                        </select>
                        <select value={item.baseCalculo} onChange={(event) => updateMaterialItem(item.id, 'baseCalculo', event.target.value)} aria-label="Base de cálculo">
                          <option value="medidas_area">Área total de medidas</option>
                          <option value="manual_area">Área manual</option>
                          <option value="lineal">Metro lineal</option>
                          <option value="manual_qty">Cantidad manual</option>
                        </select>
                        <strong>{decimal(item.rowQuantity)} {item.unidad}</strong>
                        <div className="measure-purchase">
                          <input type="number" value={item.ancho} onChange={(event) => updateMaterialItem(item.id, 'ancho', numberValue(event.target.value))} aria-label="Ancho compra" />
                          <input type="number" value={item.alto} onChange={(event) => updateMaterialItem(item.id, 'alto', numberValue(event.target.value))} aria-label="Alto compra" />
                          <input type="number" value={item.largo} onChange={(event) => updateMaterialItem(item.id, 'largo', numberValue(event.target.value))} aria-label="Largo compra" />
                        </div>
                        <input type="number" value={item.merma} onChange={(event) => updateMaterialItem(item.id, 'merma', numberValue(event.target.value))} aria-label="Merma" />
                        <input type="number" value={item.rowMargin} onChange={(event) => updateMaterialItem(item.id, 'margen', numberValue(event.target.value))} aria-label="Margen" />
                        <strong>{item.tipoCompra === 'hoja' ? `${item.hojasNecesarias} hoja(s)` : item.tipoCompra === 'lineal' ? `${decimal(item.metrosNecesarios)} m` : `${item.piezasNecesarias || decimal(item.rowQuantity, 0)} pza(s)`}</strong>
                        <strong>{money(item.costTotal)}</strong>
                        <strong>{money(item.saleTotal)}</strong>
                        <strong>{money(item.marginAmount)}</strong>
                        <button type="button" className="ghost" onClick={() => removeMaterialItem(item.id)} aria-label="Eliminar material"><Eraser size={16} /></button>
                        <CalculationChain
                          title={`Ver cálculo: ${item.nombre}`}
                          steps={[
                            { title: 'Base usada', input: item.baseCalculo, operation: 'Se toma área, lineal o cantidad según la base.', result: `${decimal(item.rowQuantity)} ${item.unidad}`, next: 'Merma' },
                            { title: 'Merma', input: `${decimal(item.rowQuantity)} con ${decimal(item.merma, 1)}%`, operation: `base x (1 + ${decimal(item.merma, 1)} / 100)`, result: item.tipoCompra === 'hoja' ? `${decimal(item.areaConMerma)} m²` : item.tipoCompra === 'lineal' ? `${decimal(item.largoConMerma)} m` : `${decimal(item.cantidadConMerma)} pza(s)`, next: item.tipoCompra === 'hoja' ? 'Área por hoja' : 'Costo interno' },
                            item.tipoCompra === 'hoja' ? { title: 'Área por hoja', input: `${item.ancho} cm x ${item.alto} cm`, operation: '(ancho / 100) x (alto / 100)', result: `${decimal(item.areaHoja)} m²`, next: 'Hojas necesarias' } : null,
                            item.tipoCompra === 'hoja' ? { title: 'Hojas necesarias', input: `${decimal(item.areaConMerma)} m² / ${decimal(item.areaHoja)} m²`, operation: 'Se redondea hacia arriba.', result: `${item.hojasNecesarias} hoja(s)`, next: 'Costo interno' } : null,
                            { title: 'Costo interno', input: item.tipoCompra === 'hoja' ? `${item.hojasNecesarias} x ${money(item.costoUnitario)}` : `${decimal(item.rowQuantity)} x ${money(item.costoUnitario)} + merma`, operation: 'Cantidad comprada x costo unitario.', result: money(item.costTotal), next: 'Margen' },
                            { title: 'Margen', input: `${decimal(item.rowMargin, 1)}%`, operation: 'Costo interno real x margen = precio cliente', result: `${money(item.precioCliente)} por unidad base`, next: 'Precio cliente' },
                            { title: 'Precio cliente', input: `${decimal(item.rowQuantity)} x ${money(item.precioCliente)}`, operation: 'Base usada x precio unitario cliente.', result: money(item.saleTotal), next: 'Utilidad' },
                            { title: 'Utilidad', input: `${money(item.saleTotal)} - ${money(item.costTotal)}`, operation: 'Precio cliente - costo interno.', result: money(item.marginAmount), next: 'Resumen' },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                  <button type="button" className="ghost add-row-button" onClick={addMaterialItem}>Agregar material</button>
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="05" title="Herrajes y accesorios" description="Accesorios, juegos, piezas y margen." status={quote.hardwareSale > 0 ? 'Completo' : 'Revisar'} />
                  <div className="quote-table quote-accessories-table">
                    <div className="quote-table-header">Accesorio</div>
                    <div className="quote-table-header">Tipo</div>
                    <div className="quote-table-header">Cantidad</div>
                    <div className="quote-table-header">Merma %</div>
                    <div className="quote-table-header">Margen %</div>
                    <div className="quote-table-header">Costo unit.</div>
                    <div className="quote-table-header">Precio unit.</div>
                    <div className="quote-table-header">Total costo</div>
                    <div className="quote-table-header">Total cliente</div>
                    <div className="quote-table-header">Borrar</div>
                    {quote.accessoryRows.map((item) => (
                      <div key={item.id} className="quote-table-row quote-accessory-row">
                        <input value={item.nombre} onChange={(event) => updateAccessoryItem(item.id, 'nombre', event.target.value)} aria-label="Accesorio" />
                        <select value={item.tipoCompra} onChange={(event) => updateAccessoryItem(item.id, 'tipoCompra', event.target.value)} aria-label="Tipo de accesorio">
                          <option value="pieza">Pieza</option>
                          <option value="juego">Juego</option>
                          <option value="manual">Manual</option>
                        </select>
                        <input type="number" value={item.cantidad} onChange={(event) => updateAccessoryItem(item.id, 'cantidad', numberValue(event.target.value))} aria-label="Cantidad" />
                        <input type="number" value={item.merma} onChange={(event) => updateAccessoryItem(item.id, 'merma', numberValue(event.target.value))} aria-label="Merma" />
                        <input type="number" value={item.rowMargin} onChange={(event) => updateAccessoryItem(item.id, 'margen', numberValue(event.target.value))} aria-label="Margen" />
                        <input type="number" value={item.costoUnitario} onChange={(event) => updateAccessoryItem(item.id, 'costoUnitario', numberValue(event.target.value))} aria-label="Costo unitario" />
                        <input type="number" value={item.precioManual ? item.precioUnitario : Math.round(item.precioCliente)} onChange={(event) => updateAccessoryItem(item.id, 'precioUnitario', numberValue(event.target.value))} aria-label="Precio unitario" />
                        <strong>{money(item.costTotal)}</strong>
                        <strong>{money(item.saleTotal)}</strong>
                        <button type="button" className="ghost" onClick={() => removeAccessoryItem(item.id)} aria-label="Eliminar accesorio"><Eraser size={16} /></button>
                        <CalculationChain
                          title={`¿Cómo se calculó ${item.nombre}?`}
                          steps={[
                            { title: 'Cantidad', input: `${decimal(item.rowQuantity, 0)} ${item.tipoCompra}`, operation: 'Cantidad capturada.', result: `${decimal(item.rowQuantity, 0)} pza(s)`, next: 'Costo unitario' },
                            { title: 'Costo unitario', input: money(item.costoUnitario), operation: 'Costo proveedor por unidad.', result: money(item.costoUnitario), next: 'Costo total' },
                            { title: 'Costo total', input: `${decimal(item.rowQuantity, 0)} x ${money(item.costoUnitario)}`, operation: 'Cantidad x costo con merma.', result: money(item.costTotal), next: 'Margen' },
                            { title: 'Margen', input: `${decimal(item.rowMargin, 1)}%`, operation: 'Costo interno real x margen = precio cliente', result: money(item.precioCliente), next: 'Precio cliente' },
                            { title: 'Precio cliente', input: `${decimal(item.rowQuantity, 0)} x ${money(item.precioCliente)}`, operation: 'Cantidad x precio unitario.', result: money(item.saleTotal), next: 'Resumen' },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                  <button type="button" className="ghost add-row-button" onClick={addAccessoryItem}>Agregar accesorio</button>
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="06" title="Mano de obra" description="Servicio de fabricación e instalación." status={quote.manoObra > 0 ? 'Completo' : 'Revisar'} />
                  <div className="form-grid">
                    <Field id="manoObra" label="Mano de obra" {...guideFor('manoObra')}>{input('manoObra', 'number')}</Field>
                    <Field id="incluye" label="Incluye">{textareaInput('incluye')}</Field>
                    <Field id="entrega" label="Entrega">{input('entrega')}</Field>
                  </div>
                  <CalculationChain
                    title="Cadena de mano de obra"
                    steps={[
                      { title: 'Horas', input: 'No se capturan horas separadas.', operation: 'Se usa el monto total de mano de obra.', result: money(quote.manoObra), next: 'Costo hora' },
                      { title: 'Costo hora', input: 'Incluido en mano de obra.', operation: 'Sin desglose de horas para no cambiar lógica.', result: money(quote.manoObra), next: 'Costo interno' },
                      { title: 'Costo interno', input: money(quote.manoObra), operation: 'ALUXOR instala; se trata como ingreso/utilidad operativa.', result: money(quote.laborProfit), next: 'Precio cliente' },
                      { title: 'Precio cliente', input: money(quote.manoObra), operation: 'Se suma al subtotal del cliente.', result: money(quote.manoObra), next: 'Resumen' },
                    ]}
                  />
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="06B" title="Extras y ajustes" description="Extras, descuento, anticipo y folio." status={quote.extras > 0 || quote.descuento > 0 ? 'Revisar' : 'Completo'} />
                  <div className="form-grid">
                    <Field id="extras" label="Extras" {...guideFor('extras')}>{input('extras', 'number')}</Field>
                    <Field id="descuento" label="Descuento %" {...guideFor('descuento')}>{input('descuento', 'number')}</Field>
                    <Field id="anticipo" label="Anticipo %" {...guideFor('anticipo')}>{input('anticipo', 'number')}</Field>
                    <Field id="folioManual" label="Folio manual opcional" {...guideFor('folioManual')}>{input('folioManual')}</Field>
                  </div>
                  <CalculationChain
                    title="Cadena de extras"
                    steps={[
                      { title: 'Cantidad', input: 'Cargo único', operation: 'Se toma el monto capturado en extras.', result: money(quote.extras), next: 'Costo' },
                      { title: 'Costo', input: money(quote.extras), operation: 'Se suma a costo interno y precio cliente.', result: money(quote.extras), next: 'Margen' },
                      { title: 'Margen', input: 'Sin margen separado.', operation: 'No se modifica la lógica actual.', result: money(quote.extras), next: 'Precio cliente' },
                      { title: 'Precio cliente', input: money(quote.extras), operation: 'Se suma al subtotal.', result: money(quote.extras), next: 'Resumen' },
                    ]}
                  />
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="08" title="Documento / PDF" description="Condiciones, vigencia, notas y estado." status={form.condiciones ? 'Completo' : 'Incompleto'} />
                  <div className="form-grid">
                    <Field id="vigencia" label="Vigencia días" {...guideFor('vigencia')}>{input('vigencia', 'number')}</Field>
                    <Field id="formaPago" label="Forma de pago" {...guideFor('formaPago')}>{input('formaPago')}</Field>
                    <Field id="estadoCotizacion" label="Estado de cotización" {...guideFor('estadoCotizacion')}>
                      <select id="estadoCotizacion" value={form.estadoCotizacion} onChange={(event) => update('estadoCotizacion', event.target.value)}>
                        <option>Pendiente</option>
                        <option>Enviada</option>
                        <option>Aceptada</option>
                        <option>En fabricación</option>
                        <option>Instalación</option>
                        <option>Terminada</option>
                        <option>Cancelada</option>
                      </select>
                    </Field>
                    <Field id="condiciones" label="Condiciones" {...guideFor('condiciones')}>{textareaInput('condiciones')}</Field>
                    <Field id="notasCliente" label="Notas para cliente" {...guideFor('notasCliente')}>{textareaInput('notasCliente')}</Field>
                    <Field id="notasInternas" label="Notas internas" {...guideFor('notasInternas')}>{textareaInput('notasInternas')}</Field>
                  </div>
                  <p className="advanced-note">Estos datos no modifican el cálculo de la cotización.</p>
                </details>

                <details className="quote-accordion">
                  <DashboardSummary number="07" title="Resumen y análisis" description="Datos faltantes y advertencias de cotización." status={dataHealth.warnings.length ? 'Revisar' : 'Completo'} />
                  <div className="data-health-panel compact-health">
                    <h4>Datos completos</h4>
                    <div className="data-health-list">
                      {dataHealth.present.map((item) => <span key={item.label} className="data-health-ok">{item.label}</span>)}
                    </div>
                    <h4>Datos faltantes</h4>
                    <div className="data-health-list">
                      {dataHealth.missing.map((item) => <span key={item.label} className="data-health-missing">{item.label}</span>)}
                    </div>
                    {dataHealth.warnings.length > 0 && (
                      <>
                        <h4>Advertencias</h4>
                        <div className="data-health-list" role="status" aria-live="polite">
                          {dataHealth.warnings.map((warning) => <span key={warning} className="data-health-warning">{warning}</span>)}
                        </div>
                      </>
                    )}
                  </div>
                </details>
              </div>
            </article>

            <aside
              className={`quote-floating ${floatingSummary.compact ? 'compact' : ''} ${floatingSummary.minimized ? 'minimized' : ''}`}
              style={{ left: floatingSummary.x, top: floatingSummary.y }}
              aria-label="Resumen de cotización"
              aria-live="polite"
            >
              <div className="quote-floating-head" onMouseDown={startSummaryDrag}>
                <strong>Resumen de cotización</strong>
                <div>
                  <button type="button" onClick={() => setFloatingSummary((current) => ({ ...current, compact: !current.compact }))}>Compacta</button>
                  <button type="button" onClick={() => setFloatingSummary((current) => ({ ...current, minimized: !current.minimized }))}>{floatingSummary.minimized ? 'Abrir' : 'Cerrar'}</button>
                  <button type="button" onClick={() => setFloatingSummary({ x: 24, y: 120, compact: false, minimized: false })}>Inicial</button>
                </div>
              </div>
              {!floatingSummary.minimized && (
                <div className="quote-floating-body">
                  <div className="total-number">{money(quote.total)}</div>
                  <div className="live-summary-grid">
                    <div className="live-summary-item"><span>Total cliente</span><strong>{money(quote.total)}</strong></div>
                    <div className="live-summary-item"><span>Anticipo</span><strong>{money(quote.deposit)}</strong></div>
                    <div className="live-summary-item"><span>Saldo</span><strong>{money(quote.rest)}</strong></div>
                    <div className="live-summary-item"><span>Utilidad</span><strong>{money(quote.profit)}</strong></div>
                    <div className="live-summary-item"><span>Estado</span><strong>{form.estadoCotizacion}</strong></div>
                    <div className="live-summary-item"><span>Datos</span><strong>{dataHealth.score}%</strong></div>
                  </div>
                  {dataHealth.warnings.length > 0 && (
                    <p className="live-summary-warning" role="status" aria-live="polite">{dataHealth.warnings[0]}</p>
                  )}
                  <div className="actions compact">
                    <button type="button" onClick={saveToHistory}><Save size={18} /> Guardar</button>
                    <button type="button" className="ghost" onClick={() => openPrint('client')}><FileText size={18} /> Editar PDF</button>
                    <button type="button" className="ghost" onClick={openWhatsApp}><MessageCircle size={18} /> WhatsApp</button>
                  </div>
                  <CalculationChain
                    title="Cadena del resumen"
                    defaultOpen={!floatingSummary.compact}
                    steps={[
                      { title: 'Materiales', input: `${quote.materialRows.length} material(es)`, operation: 'Suma de precios cliente por material.', result: money(quote.material), next: 'Herrajes' },
                      { title: 'Herrajes', input: `${quote.accessoryRows.length} accesorio(s)`, operation: 'Suma de precios cliente por accesorio.', result: money(quote.hardwareSale), next: 'Mano de obra' },
                      { title: 'Mano de obra', input: money(quote.manoObra), operation: 'Se suma al cliente.', result: money(quote.manoObra), next: 'Extras' },
                      { title: 'Extras', input: money(quote.extras), operation: 'Se suma al cliente e interno.', result: money(quote.extras), next: 'Costo interno' },
                      { title: 'Costo interno', input: `${money(quote.internalMaterialCost)} + ${money(quote.hardwareCost)} + ${money(quote.extras)}`, operation: 'Material interno + herrajes + extras.', result: money(quote.internalTotal), next: 'Precio cliente' },
                      { title: 'Precio cliente', input: `${money(quote.subtotal)} - ${money(quote.discountAmount)}`, operation: 'Subtotal menos descuento.', result: money(quote.total), next: 'Anticipo' },
                      { title: 'Anticipo', input: `${decimal(quote.anticipo, 1)}%`, operation: 'Total x anticipo.', result: money(quote.deposit), next: 'Saldo' },
                      { title: 'Saldo', input: `${money(quote.total)} - ${money(quote.deposit)}`, operation: 'Total menos anticipo.', result: money(quote.rest), next: 'Documento' },
                    ]}
                  />
                  <details className="floating-analysis" open={!floatingSummary.compact}>
                    <summary>Análisis profesional</summary>
                    <div className="chain-insights">
                      {chainInsights.map((item) => <span key={item}>{item}</span>)}
                    </div>
                    {professionalAnalysis.map((item) => (
                      <article key={item.role} className="professional-card">
                        <span>{item.role}</span>
                        <h4>{item.title}</h4>
                        <p className="professional-total">{item.total}</p>
                        {!floatingSummary.compact && <p>{item.why}</p>}
                      </article>
                    ))}
                  </details>
                </div>
              )}
            </aside>
          </section>
  );
}
