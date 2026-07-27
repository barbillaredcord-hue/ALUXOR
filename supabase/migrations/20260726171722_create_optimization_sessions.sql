begin;

-- Durable remote rows for Optimization Session.
-- Identifiers remain opaque text because the durable contract accepts UUIDs
-- and deterministic legacy identifiers without coercion.
create table public.optimization_sessions (
  id text primary key,
  execution_id text not null,
  workspace_id text not null,
  quote_id text not null,
  material_id text not null,
  created_at timestamptz not null,
  created_by text not null,
  updated_at timestamptz not null,
  engine_version jsonb not null,
  input_signature text not null,
  status text not null,
  configuration jsonb not null default '{}'::jsonb,
  candidate_ids jsonb not null default '[]'::jsonb,
  recommended_candidate_id text,
  selected_candidate_id text,
  proposal_id text,
  summary jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  last_modified_by text not null,
  revision integer not null,
  audit jsonb not null default '[]'::jsonb,
  contract_version integer not null default 2,
  
  constraint optimization_sessions_required_text_check
    check (
      pg_catalog.btrim(id) <> ''
      and pg_catalog.btrim(execution_id) <> ''
      and pg_catalog.btrim(workspace_id) <> ''
      and pg_catalog.btrim(quote_id) <> ''
      and pg_catalog.btrim(material_id) <> ''
      and pg_catalog.btrim(created_by) <> ''
      and pg_catalog.btrim(input_signature) <> ''
      and pg_catalog.btrim(last_modified_by) <> ''
    ),
  constraint optimization_sessions_engine_version_check
    check (jsonb_typeof(engine_version) in ('string', 'number')),
  constraint optimization_sessions_status_check
    check (status in ('open', 'selected', 'proposed', 'closed')),
  constraint optimization_sessions_configuration_object_check
    check (jsonb_typeof(configuration) = 'object'),
  constraint optimization_sessions_candidate_ids_array_check
    check (jsonb_typeof(candidate_ids) = 'array'),
  constraint optimization_sessions_summary_object_check
    check (jsonb_typeof(summary) = 'object'),
  constraint optimization_sessions_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint optimization_sessions_version_check
    check (version >= 1),
  constraint optimization_sessions_revision_check
    check (revision >= 1),
  constraint optimization_sessions_audit_array_check
    check (
      jsonb_typeof(audit) = 'array'
      and jsonb_array_length(audit) = revision
    ),
  constraint optimization_sessions_contract_version_check
    check (contract_version in (1, 2))
);

-- The leftmost workspace key supports isolation on every indexed access path.
create index optimization_sessions_workspace_updated_idx
  on public.optimization_sessions(workspace_id, updated_at desc, id asc);

-- Supports the conditional update by workspace, identity and expected version.
create index optimization_sessions_workspace_id_version_idx
  on public.optimization_sessions(workspace_id, id, version);

create index optimization_sessions_workspace_quote_idx
  on public.optimization_sessions(workspace_id, quote_id);

create index optimization_sessions_workspace_material_idx
  on public.optimization_sessions(workspace_id, material_id);

create index optimization_sessions_workspace_execution_idx
  on public.optimization_sessions(workspace_id, execution_id);

create index optimization_sessions_workspace_status_idx
  on public.optimization_sessions(workspace_id, status);

create index optimization_sessions_workspace_created_by_idx
  on public.optimization_sessions(workspace_id, created_by);

create index optimization_sessions_workspace_last_modified_by_idx
  on public.optimization_sessions(workspace_id, last_modified_by);

comment on table public.optimization_sessions is
  'Durable Optimization Session references; physical candidates and geometry are not stored.';

comment on column public.optimization_sessions.candidate_ids is
  'Ordered candidate references only; no candidate payloads or geometry.';

comment on column public.optimization_sessions.version is
  'Optimistic version supplied and advanced by the domain client.';

commit;
