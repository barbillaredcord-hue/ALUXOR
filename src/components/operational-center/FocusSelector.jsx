export default function FocusSelector({
  projects = [],
  selectedId,
  open,
  onToggle,
  onSelect,
}) {
  const priorityProjects = projects.filter((project) => project.priority);

  return (
    <div className="operational-focus-selector">
      <button type="button" className="ghost" onClick={onToggle} aria-expanded={open}>
        Cambiar proyecto
      </button>

      {open && (
        <div className="operational-focus-options">
          <div>
            <strong>Proyectos prioritarios</strong>
            {priorityProjects.length ? priorityProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={project.id === selectedId ? 'is-selected' : ''}
                onClick={() => onSelect(project.id)}
              >
                <span>{project.projectName}</span>
                <small>{project.customerName} · {project.status}</small>
              </button>
            )) : <p>No hay proyectos prioritarios.</p>}
          </div>

          <div>
            <strong>Todos los proyectos</strong>
            {projects.length ? projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={project.id === selectedId ? 'is-selected' : ''}
                onClick={() => onSelect(project.id)}
              >
                <span>{project.projectName}</span>
                <small>{project.customerName} · {project.status}</small>
              </button>
            )) : <p>No hay proyectos activos.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
