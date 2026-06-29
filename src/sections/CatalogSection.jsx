import { Check, Eraser, Package } from 'lucide-react';

export default function CatalogSection({
  catalog,
  addCatalogItem,
  updateCatalogItem,
  numberValue,
  applyCatalogItem,
  removeCatalogItem,
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Catálogo</h2>
          <p>Productos rápidos para cargar precios base.</p>
        </div>
        <button type="button" onClick={addCatalogItem}><Package size={18} /> Agregar actual</button>
      </div>
      <div className="table-list">
        {catalog.map((item) => (
          <article key={item.id} className="catalog-row">
            <input value={item.nombre} onChange={(event) => updateCatalogItem(item.id, 'nombre', event.target.value)} aria-label="Nombre" />
            <input value={item.categoria} onChange={(event) => updateCatalogItem(item.id, 'categoria', event.target.value)} aria-label="Categoría" />
            <input value={item.tipoTrabajo} onChange={(event) => updateCatalogItem(item.id, 'tipoTrabajo', event.target.value)} aria-label="Tipo" />
            <input type="number" value={item.precio} onChange={(event) => updateCatalogItem(item.id, 'precio', numberValue(event.target.value))} aria-label="Precio" />
            <button type="button" onClick={() => applyCatalogItem(item)}><Check size={16} /> Usar</button>
            <button type="button" className="ghost" onClick={() => removeCatalogItem(item.id)}><Eraser size={16} /></button>
          </article>
        ))}
      </div>
    </section>
  );
}
