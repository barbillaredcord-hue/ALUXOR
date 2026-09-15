begin;
revoke all
on function private.inventory_movement_effect(text, numeric, jsonb)
from public, anon;
grant execute
on function private.inventory_movement_effect(text, numeric, jsonb)
to authenticated, service_role;
commit;
