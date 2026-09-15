do $$
declare
  current_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.amend_purchase_item(uuid,uuid,uuid,uuid,integer,jsonb,jsonb,text,text,text,uuid,timestamptz)'::regprocedure
  ) into current_definition;
  execute pg_catalog.replace(current_definition, 'pg_catalog.coalesce', 'coalesce');
end;
$$;
;
