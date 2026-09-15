import { useState } from 'react';

export default function WorkspaceLayout({ sidebar, content, inspector }) {
  const hasInspector = Boolean(inspector);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

  return (
    <div className={hasInspector ? "workspace-layout" : "workspace-layout no-inspector"}>
      <aside
        className={`workspace-layout-sidebar ${mobileSidebarOpen ? 'is-mobile-open' : 'is-mobile-collapsed'}`}
        aria-label="Navegación principal"
      >
        <button
          type="button"
          className="mobile-sidebar-toggle"
          aria-expanded={mobileSidebarOpen}
          aria-controls="mobile-company-panel"
          onClick={() => setMobileSidebarOpen((open) => !open)}
        >
          <img
            src="/branding/br-logo-horizontal.png"
            alt=""
            className="mobile-sidebar-toggle-logo"
          />
          <span className="mobile-sidebar-toggle-copy">
            <strong>Panel de empresa</strong>
            <small>{mobileSidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}</small>
          </span>
          <span className="mobile-sidebar-toggle-chevron" aria-hidden="true">
            {mobileSidebarOpen ? '⌃' : '⌄'}
          </span>
        </button>

        <div id="mobile-company-panel" className="mobile-sidebar-content">
          {sidebar}
        </div>
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
