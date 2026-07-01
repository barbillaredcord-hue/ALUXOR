export default function WorkspaceLayout({ sidebar, content, inspector }) {
  const hasInspector = Boolean(inspector);

  return (
    <div className={hasInspector ? "workspace-layout" : "workspace-layout no-inspector"}>
      <aside className="workspace-layout-sidebar" aria-label="Navegación principal">
        {sidebar}
      </aside>

      <main className="workspace-layout-content" aria-label="Área principal de trabajo">
        {content}
      </main>

      {hasInspector ? (
        <aside className="workspace-layout-inspector" aria-label="Inspector inteligente">
          {inspector}
        </aside>
      ) : null}
    </div>
  );
}
