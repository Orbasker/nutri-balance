CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS foods_name_trgm_idx
  ON foods
  USING gin (lower(name) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS food_aliases_alias_trgm_idx
  ON food_aliases
  USING gin (lower(alias) extensions.gin_trgm_ops);
