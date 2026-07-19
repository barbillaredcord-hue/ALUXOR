import { useState } from 'react';
import AboutSettings from '../components/settings/AboutSettings.jsx';
import BackupsSettings from '../components/settings/BackupsSettings.jsx';
import CatalogSettings from '../components/settings/CatalogSettings.jsx';
import GeneralSettings from '../components/settings/GeneralSettings.jsx';
import IntegrationsSettings from '../components/settings/IntegrationsSettings.jsx';
import NotificationsSettings from '../components/settings/NotificationsSettings.jsx';
import ProductionSettings from '../components/settings/ProductionSettings.jsx';
import QuoteSettings from '../components/settings/QuoteSettings.jsx';
import UsersSettings from '../components/settings/UsersSettings.jsx';

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
  const [activeTab, setActiveTab] = useState('general');

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
            <GeneralSettings
              appLogo={appLogo}
              settings={settings}
              canManage={canManage}
              saving={saving}
              onSaveCompanyName={onSaveCompanyName}
              onLogoUpload={onLogoUpload}
              onRemoveLogo={onRemoveLogo}
            />
          )}
          {activeTab === 'users' && <UsersSettings />}
          {activeTab === 'catalog' && <CatalogSettings />}
          {activeTab === 'quotes' && <QuoteSettings />}
          {activeTab === 'production' && <ProductionSettings />}
          {activeTab === 'notifications' && <NotificationsSettings />}
          {activeTab === 'integrations' && <IntegrationsSettings />}
          {activeTab === 'backups' && <BackupsSettings />}
          {activeTab === 'about' && <AboutSettings />}
        </div>
      </div>
    </section>
  );
}
