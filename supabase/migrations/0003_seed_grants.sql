-- Table-level privileges (RLS policies still gate row access):
--   * authenticated -> SELECT only (read_authenticated policy)
--   * service_role  -> full DML, bypasses RLS (seed scripts / admin backfill)
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
