export default function WorkspaceLayout({ sidebar, content, inspector }) {
  return (
    <div className="workspace-layout">
      <aside className="workspace-layout-sidebar">
        {sidebar}
      </aside>
      <main className="workspace-layout-content">
        {content}
      </main>
      <aside className="workspace-layout-inspector">
        {inspector}
      </aside>
    </div>
  );
}
