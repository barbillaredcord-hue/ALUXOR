import { describe, expect, it } from 'vitest';
import {
  canAssignRole,
  canChangeRoles,
  canManageInventory,
  canManageProduction,
  canManageQuotes,
  canManageUsers,
  canViewAudit,
} from './permissions.js';

describe('permisos de workspace', () => {
  it('reserva usuarios, roles y auditoría para owner/admin', () => {
    expect(canManageUsers('owner')).toBe(true);
    expect(canChangeRoles('admin')).toBe(true);
    expect(canViewAudit('editor')).toBe(false);
    expect(canAssignRole('admin', 'editor', 'owner')).toBe(false);
    expect(canAssignRole('owner', 'editor', 'owner')).toBe(true);
  });

  it('limita cada rol operativo a su módulo', () => {
    expect(canManageQuotes('sales')).toBe(true);
    expect(canManageProduction('sales')).toBe(false);
    expect(canManageProduction('production')).toBe(true);
    expect(canManageInventory('warehouse')).toBe(true);
  });

  it('mantiene viewer sin permisos de escritura', () => {
    expect(canManageQuotes('viewer')).toBe(false);
    expect(canManageProduction('viewer')).toBe(false);
    expect(canManageInventory('viewer')).toBe(false);
  });
});
