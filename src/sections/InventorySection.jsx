import { Archive, PackageSearch } from 'lucide-react';
import { useMemo, useState } from 'react';

function normalizeGroup(value = '') {
  const label = String(value || '').toLowerCase();
  if (/madera|melamina|triplay|mdf/.test(label)) return 'Maderas / Melamina';
  if (/aluminio|perfil|ptr|metal|herrer/.test(label)) return 'Aluminio';
  if (/vidrio|cristal/.test(label)) return 'Vidrio';
  if (/tornillo|silic[oó]n|taquete|consumible/.test(label)) return 'Consumibles';
  if (/herraje|bisagra|corredera|jaladera/.test(label)) return 'Herrajes';
  return 'Otros';
}

function materialQuantity(item, decimal) {
  if (item.tipoCompra === 'hoja') return { quantity: item.hojasNecesarias, unit: 'hoja(s)' };
  if (item.tipoCompra === 'lineal') return { quantity: item.metrosNecesarios, unit: 'm' };
  if (item.tipoCompra === 'area') return { quantity: item.rowQuantity, unit: 'm²' };
  return { quantity: item.piezasNecesarias || item.rowQuantity, unit: 'pza(s)' };
}

export default function InventorySection({ form, quote, money, decimal }) {
  const items = useMemo(() => [
    ...quote.materialRows.map((item) => {
      const quantity = materialQuantity(item, decimal);
      return {
        id: `mat-${item.id}`,
        name: item.nombre,
        category: normalizeGroup(item.categoria || item.nombre),
        required: quantity.quantity,
        unit: quantity.unit,
        value: item.costTotal,
      };
    }),
    ...quote.accessoryRows.map((item) => ({
      id: `acc-${item.id}`,
      name: item.nombre,
      category: 'Herrajes',
      required: item.rowQuantity,
      unit: item.tipoCompra || 'pieza',
      value: item.costTotal,
    })),
  ].filter((item) => item.name), [quote, decimal]);

  const [available, setAvailable] = useState({});
  const availableFor = (id) => Number(available[id] || 0);
  const statusFor = (item) => {
    const current = availableFor(item.id);
    if (current >= item.required) return 'Disponible';
    if (current > 0) return 'Bajo';
    return 'Faltante';
  };
  const missingFor = (item) => Math.max(0, item.required - availableFor(item.id));
  const counts = items.reduce((acc, item) => {
    acc[statusFor(item)] += 1;
    return acc;
  }, { Disponible: 0, Bajo: 0, Faltante: 0 });
  const missingItems = items.filter((item) => missingFor(item) > 0);
  const totalValue = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const groups = items.reduce((acc, item) => {
    acc[item.category] = [...(acc[item.category] || []), item];
    return acc;
  }, {});

  return (
    <section className="inventory-section panel">
      <header className="inventory-hero">
        <div>
          <span>Inventario base</span>
          <h2>{form.producto || 'Proyecto sin nombre'}</h2>
          <p>Materiales del proyecto listos para convertirse en existencias.</p>
        </div>
        <Archive size={36} />
      </header>

      <div className="inventory-stats">
        <div><span>Items totales</span><strong>{items.length}</strong></div>
        <div><span>Disponibles</span><strong>{counts.Disponible}</strong></div>
        <div><span>Faltantes</span><strong>{counts.Faltante + counts.Bajo}</strong></div>
        <div><span>Valor estimado</span><strong>{money(totalValue)}</strong></div>
      </div>

      <div className="inventory-layout">
        <div className="inventory-groups">
          {Object.entries(groups).map(([group, groupItems]) => (
            <article key={group} className="inventory-group">
              <h3>{group}</h3>
              <div className="inventory-items">
                {groupItems.map((item) => {
                  const status = statusFor(item);
                  const missing = missingFor(item);
                  return (
                    <div key={item.id} className={`inventory-item inventory-item-${status.toLowerCase()}`}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.category} · {item.unit}</span>
                      </div>
                      <div><span>Requerido</span><strong>{decimal(item.required)} {item.unit}</strong></div>
                      <label>Disponible<input type="number" value={availableFor(item.id)} onChange={(event) => setAvailable((current) => ({ ...current, [item.id]: event.target.value }))} /></label>
                      <div><span>Faltante</span><strong>{decimal(missing)} {item.unit}</strong></div>
                      <em>{status}</em>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <aside className="inventory-missing">
          <h3><PackageSearch size={18} /> Materiales faltantes</h3>
          {missingItems.length ? missingItems.map((item) => (
            <span key={item.id}>{item.name} · {decimal(missingFor(item))} {item.unit}</span>
          )) : <p>No hay faltantes.</p>}
          <button type="button">Preparar compra</button>
        </aside>
      </div>
    </section>
  );
}
