create index receptions_reverted_by_idx
  on public.receptions(reverted_by)
  where reverted_by is not null;
;
