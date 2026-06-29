export default function DashboardSection({
  ejemplos,
  defaults,
  setForm,
  setActiveSection,
  roleCards,
}) {
  return (
    <section className="panel-grid">
      {ejemplos.map(({ name, icon: Icon, data }) => (
        <button
          key={name}
          type="button"
          className="feature-card"
          onClick={() => {
            setForm({ ...defaults, ...data });
            setActiveSection('cotizador');
          }}
        >
          <Icon size={24} />
          <strong>{name}</strong>
          <span>Cargar ejemplo</span>
        </button>
      ))}

      {roleCards.map((card) => (
        <article key={card.title} className="panel">
          <h3>{card.title}</h3>
          <ul>
            {card.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>
      ))}
    </section>
  );
}
