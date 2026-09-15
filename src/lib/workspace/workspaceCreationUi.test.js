import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hookSource = readFileSync(new URL('../../hooks/useWorkspace.js', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../../components/settings/GeneralSettings.jsx', import.meta.url), 'utf8');

describe('superficie de creación y cambio de negocio', () => {
  it('expone selección, creación y guardia síncrona contra doble envío', () => {
    expect(hookSource).toContain('workspaceCreationInFlightRef');
    expect(hookSource).toContain('selectWorkspace');
    expect(hookSource).toContain('WorkspaceService.createWorkspace(name)');
  });

  it('mantiene copy accesible y estados de creación en Settings', () => {
    expect(settingsSource).toContain('Cambiar negocio');
    expect(settingsSource).toContain('Crear negocio');
    expect(settingsSource).toContain('creatingWorkspace');
    expect(settingsSource).toContain('workspaceCreationError');
    expect(settingsSource).toContain('workspaceCreationSuccess');
  });
});
