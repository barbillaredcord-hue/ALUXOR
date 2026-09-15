begin;

do $migration$
declare
  function_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.amend_purchase_item(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,text,text,text,uuid,timestamptz)'::regprocedure
  ) into function_definition;
  if function_definition not like '%pg_catalog.coalesce(p_reason,%' then
    raise exception 'EXPECTED_AMENDMENT_FUNCTION_DEFINITION_NOT_FOUND';
  end if;
  execute pg_catalog.replace(
    function_definition,
    'pg_catalog.coalesce(p_reason,',
    'coalesce(p_reason,'
  );
end;
$migration$;

revoke all on function public.amend_purchase_item(
  uuid, uuid, uuid, uuid, integer, jsonb, jsonb, text, text, text, uuid, timestamptz
) from public, anon;
grant execute on function public.amend_purchase_item(
  uuid, uuid, uuid, uuid, integer, jsonb, jsonb, text, text, text, uuid, timestamptz
) to authenticated;

commit;
;
