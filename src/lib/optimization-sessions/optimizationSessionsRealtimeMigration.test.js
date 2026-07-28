import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL(
  '../../../supabase/migrations/20260728120000_enable_optimization_sessions_realtime.sql',
  import.meta.url,
), 'utf8');

describe('migración Realtime de Optimization Sessions', () => {
  it('emite INSERT, UPDATE y DELETE mediante Broadcast privado por workspace', () => {
    expect(sql).toMatch(
      /create trigger optimization_sessions_broadcast_change[\s\S]*?after insert or update or delete[\s\S]*?on public\.optimization_sessions/i,
    );
    expect(sql).toMatch(/realtime\.broadcast_changes\s*\(/i);
    expect(sql).toMatch(/'optimization-sessions:'\s*\|\|\s*target_workspace_id/i);
    expect(sql).toMatch(
      /when tg_op = 'DELETE' then old\.workspace_id[\s\S]*?else new\.workspace_id/i,
    );
  });

  it('autoriza solo recepción Broadcast del workspace permitido', () => {
    expect(sql).toMatch(
      /create policy optimization_sessions_broadcast_select[\s\S]*?on realtime\.messages[\s\S]*?for select[\s\S]*?to authenticated/i,
    );
    expect(sql).toMatch(/realtime\.messages\.extension\s*=\s*'broadcast'/i);
    expect(sql).toMatch(/select realtime\.topic\(\)/i);
    expect(sql).toMatch(/private\.has_workspace_permission\([\s\S]*?'view_workspace'/i);
  });

  it('no crea acceso global, anon ni una suscripción sin workspace', () => {
    expect(sql).not.toMatch(/\busing\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/\bto\s+anon\b/i);
    expect(sql).not.toMatch(/supabase_realtime|alter publication/i);
    expect(sql).toMatch(
      /split_part\(\(select realtime\.topic\(\)\), ':', 2\)[\s\S]*?\^\[0-9a-f\]/i,
    );
  });

  it('no modifica columnas, tabla física ni reglas de negocio', () => {
    expect(sql).not.toMatch(/\bcreate table\b/i);
    expect(sql).not.toMatch(/\balter table public\.optimization_sessions\b/i);
    expect(sql).not.toMatch(/\b(add|drop|alter)\s+column\b/i);
    expect(sql).not.toMatch(/\bupdate public\.optimization_sessions\b/i);
  });
});
