import { useEffect, useState } from 'react';

export default function SettingsSection({
  appLogo,
  settings,
  canManage,
  saving,
  error,
  onSaveCompanyName,
  onLogoUpload,
  onRemoveLogo,
}) {
  const [companyName, setCompanyName] = useState(settings?.company_name || 'ALUXOR / BosqueReal');
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    setCompanyName(settings?.company_name || 'ALUXOR / BosqueReal');
  }, [settings?.company_name]);

  return (
    <section className="panel settings-panel">
      <div className="section-head">
        <div>
          <h2>Configuración del workspace</h2>
          <p>Marca global sincronizada para todos los miembros activos.</p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="settings-layout">
        <aside className="settings-sidebar">
    <button
      type="button"
      className={activeTab === 'general' ? 'active' : ''}
      onClick={() => setActiveTab('general')}
    >
      General
    </button>

    <button
      type="button"
      className={activeTab === 'users' ? 'active' : ''}
      onClick={() => setActiveTab('users')}
    >
      Usuarios y permisos
    </button>

    <button
      type="button"
      className={activeTab === 'catalog' ? 'active' : ''}
      onClick={() => setActiveTab('catalog')}
    >
      Catálogo
    </button>

    <button
      type="button"
      className={activeTab === 'quotes' ? 'active' : ''}
      onClick={() => setActiveTab('quotes')}
    >
      Cotización
    </button>

    <button
      type="button"
      className={activeTab === 'production' ? 'active' : ''}
      onClick={() => setActiveTab('production')}
    >
      Producción
    </button>

    <button
      type="button"
      className={activeTab === 'notifications' ? 'active' : ''}
      onClick={() => setActiveTab('notifications')}
    >
      Notificaciones
    </button>

    <button
      type="button"
      className={activeTab === 'integrations' ? 'active' : ''}
      onClick={() => setActiveTab('integrations')}
    >
      Integraciones
    </button>

    <button
      type="button"
      className={activeTab === 'backups' ? 'active' : ''}
      onClick={() => setActiveTab('backups')}
    >
      Respaldos
    </button>

    <button
      type="button"
      className={activeTab === 'about' ? 'active' : ''}
      onClick={() => setActiveTab('about')}
    >
      Acerca de
    </button>
  </aside>

    <div className="settings-content">
        {activeTab === 'general' && (
          <>
        <div className="settings-grid">
        <div className="logo-preview-box">
          {appLogo ? <img src={appLogo} alt="Vista previa del logo" /> : <div className="brand-mark">A</div>}
          <strong>{settings?.company_name || 'ALUXOR / BosqueReal'}</strong>
        </div>
        <div>
          <label htmlFor="workspaceCompanyName">Nombre de empresa</label>
          <input
            id="workspaceCompanyName"
            value={companyName}
            maxLength={160}
            disabled={!canManage || saving}
            onChange={(event) => setCompanyName(event.target.value)}
          />
          <div className="actions">
            <button type="button" disabled={!canManage || saving} onClick={() => onSaveCompanyName(companyName)}>
              Guardar nombre
            </button>
            <label htmlFor="settingsLogoUpload" className="upload-logo">
              Subir logo
              <input
                id="settingsLogoUpload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={!canManage || saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onLogoUpload(file, companyName);
                  event.target.value = '';
                }}
              />
            </label>
            <button type="button" className="ghost" disabled={!canManage || saving || !appLogo} onClick={() => onRemoveLogo(companyName)}>
              Quitar logo
            </button>
          </div>
        </div>
      </div>
        {!canManage && (
          <p className="advanced-note">
            Solo owner o admin pueden modificar esta configuración.
          </p>
        )}

        <p className="advanced-note">
          Los iconos de una PWA ya instalada dependen del sistema operativo y pueden conservarse hasta reinstalar o actualizar la app.
        </p>
      </>
    )}
    {activeTab === 'users' && (
  <div className="settings-placeholder">
    <h3>Usuarios y permisos</h3>
    <p>
      Aquí se administrarán los miembros del workspace, solicitudes de acceso,
      roles, permisos, suspensión y reactivación de usuarios.
    </p>
  </div>
)}

{activeTab === 'catalog' && (
  <div className="settings-placeholder">
    <h3>Catálogo</h3>
    <p>
      Aquí se administrarán materiales, perfiles, herrajes, accesorios,
      proveedores y configuraciones generales del catálogo.
    </p>
  </div>
)}

{activeTab === 'quotes' && (
  <div className="settings-placeholder">
    <h3>Cotización</h3>
    <p>
      Aquí se configurarán impuestos, márgenes, formatos, folios,
      condiciones comerciales y reglas de cotización.
    </p>
  </div>
)}

{activeTab === 'production' && (
  <div className="settings-placeholder">
    <h3>Producción</h3>
    <p>
      Aquí se configurarán procesos de fabricación, corte, optimización,
      estados de producción y flujo de trabajo.
    </p>
  </div>
)}

{activeTab === 'notifications' && (
  <div className="settings-placeholder">
    <h3>Notificaciones</h3>
    <p>
      Aquí se administrarán las notificaciones internas, correos,
      recordatorios y alertas automáticas.
    </p>
  </div>
)}

{activeTab === 'integrations' && (
  <div className="settings-placeholder">
    <h3>Integraciones</h3>
    <p>
      Aquí se configurarán Supabase, almacenamiento, servicios externos,
      APIs e integraciones futuras.
    </p>
  </div>
)}

{activeTab === 'backups' && (
  <div className="settings-placeholder">
    <h3>Respaldos</h3>
    <p>
      Aquí se administrarán los respaldos automáticos, restauraciones
      e historial de copias de seguridad.
    </p>
  </div>
)}

{activeTab === 'about' && (
  <div className="settings-placeholder">
    <h3>Acerca de</h3>
    <p>
      Información de la aplicación, versión, licencia, documentación
      y créditos del sistema.
    </p>
  </div>
)}
  </div>
    </div>
      </section>
  );
}
