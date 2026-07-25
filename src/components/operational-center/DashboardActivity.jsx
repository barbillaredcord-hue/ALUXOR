function activityDate(value) {
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed)
    ? 'Sin fecha'
    : new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
}

export default function DashboardActivity({ activity = [], onOpen }) {
  return (
    <section className="operational-activity">
      <div>
        <span className="operational-kicker">Actividad</span>
        <strong>Actualizaciones recientes</strong>
      </div>
      <ol>
        {activity.length ? activity.slice(0, 6).map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => onOpen(item)}>
              <span>
                <strong>{item.projectName}</strong>
                {item.description}
              </span>
              <time dateTime={item.occurredAt}>{activityDate(item.occurredAt)}</time>
            </button>
          </li>
        )) : <li><span>No hay actividad reciente.</span></li>}
      </ol>
    </section>
  );
}
