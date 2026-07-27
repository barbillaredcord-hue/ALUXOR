import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OPTIMIZATION_SESSION_REMOTE_FIELDS } from './remoteAdapter.js';

const MIGRATION_URL = new URL(
  '../../../supabase/migrations/20260726171722_create_optimization_sessions.sql',
  import.meta.url,
);
const sql = readFileSync(MIGRATION_URL, 'utf8');

const SQL_TYPES = Object.freeze({
  id: 'text',
  execution_id: 'text',
  workspace_id: 'text',
  quote_id: 'text',
  material_id: 'text',
  created_at: 'timestamptz',
  created_by: 'text',
  updated_at: 'timestamptz',
  engine_version: 'jsonb',
  input_signature: 'text',
  status: 'text',
  configuration: 'jsonb',
  candidate_ids: 'jsonb',
  recommended_candidate_id: 'text',
  selected_candidate_id: 'text',
  proposal_id: 'text',
  summary: 'jsonb',
  metadata: 'jsonb',
  version: 'integer',
  last_modified_by: 'text',
  revision: 'integer',
  audit: 'jsonb',
  contract_version: 'integer',
});

function tableColumns() {
  const body = sql.match(
    /create table public\.optimization_sessions\s*\(([\s\S]*?)\n\);/i,
  )?.[1] ?? '';
  return body
    .split('\n')
    .map((line) => line.match(
      /^\s{2}([a-z][a-z0-9_]*)\s+(text|timestamptz|jsonb|integer)\b/i,
    ))
    .filter(Boolean)
    .map((match) => ({ name: match[1], type: match[2].toLowerCase() }));
}

describe('migración optimization_sessions', () => {
  it('declara exactamente las columnas y tipos del Remote Adapter', () => {
    const columns = tableColumns();

    expect(columns.map(({ name }) => name))
      .toEqual([...OPTIMIZATION_SESSION_REMOTE_FIELDS]);
    expect(Object.fromEntries(
      columns.map(({ name, type }) => [name, type]),
    )).toEqual(SQL_TYPES);
  });

  it('incluye constraints estructurales compatibles con el dominio durable', () => {
    expect(sql).toMatch(/check \(version >= 1\)/i);
    expect(sql).toMatch(/check \(contract_version in \(1, 2\)\)/i);
    expect(sql).toMatch(/jsonb_typeof\(configuration\) = 'object'/i);
    expect(sql).toMatch(/jsonb_typeof\(candidate_ids\) = 'array'/i);
    expect(sql).toMatch(/jsonb_typeof\(summary\) = 'object'/i);
    expect(sql).toMatch(/jsonb_typeof\(metadata\) = 'object'/i);
    expect(sql).toMatch(/jsonb_typeof\(audit\) = 'array'/i);
    expect(sql).toMatch(/jsonb_array_length\(audit\) = revision/i);
    expect(sql).toMatch(/status in \('open', 'selected', 'proposed', 'closed'\)/i);
  });

  it('incluye los índices de acceso e optimistic versioning', () => {
    [
      'optimization_sessions_workspace_updated_idx',
      'optimization_sessions_workspace_id_version_idx',
      'optimization_sessions_workspace_quote_idx',
      'optimization_sessions_workspace_material_idx',
      'optimization_sessions_workspace_execution_idx',
      'optimization_sessions_workspace_status_idx',
      'optimization_sessions_workspace_created_by_idx',
      'optimization_sessions_workspace_last_modified_by_idx',
    ].forEach((indexName) => {
      expect(sql).toContain(`create index ${indexName}`);
    });
    expect(sql).toMatch(
      /optimization_sessions_workspace_id_version_idx[\s\S]*?\(workspace_id, id, version\)/i,
    );
  });

  it('no adelanta RLS, Realtime, triggers, RPC ni tablas auxiliares', () => {
    expect(sql).not.toMatch(/enable row level security|create policy/i);
    expect(sql).not.toMatch(/supabase_realtime|alter publication/i);
    expect(sql).not.toMatch(/create trigger|create (?:or replace )?function/i);
    expect(sql).not.toMatch(/\bcreate table\b(?!\s+public\.optimization_sessions)/i);
  });

  it('no contiene ni modifica responsabilidades del motor físico', () => {
    expect(sql).not.toMatch(
      /cut-optimizer|optimizer\.js|geometry\.js|strategies\/|best-fit|shelf\.js/i,
    );
  });
});
