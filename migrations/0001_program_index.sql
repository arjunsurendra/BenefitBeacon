CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('city', 'county', 'state', 'federal')),
  jurisdiction TEXT NOT NULL,
  city_scope TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('food', 'health', 'utilities', 'home', 'veterans', 'family', 'transportation', 'other')),
  summary TEXT NOT NULL,
  benefit TEXT NOT NULL,
  eligibility_text TEXT NOT NULL,
  apply_url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_snippet TEXT NOT NULL,
  interest_tags TEXT NOT NULL,
  audience_tags TEXT NOT NULL,
  housing_scope TEXT NOT NULL DEFAULT 'any',
  min_age INTEGER,
  max_age INTEGER,
  income_targeted INTEGER NOT NULL DEFAULT 0,
  requires_children INTEGER NOT NULL DEFAULT 0,
  requires_disability INTEGER NOT NULL DEFAULT 0,
  requires_veteran INTEGER NOT NULL DEFAULT 0,
  requires_caregiver INTEGER NOT NULL DEFAULT 0,
  embedding_json TEXT NOT NULL,
  last_checked TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS programs_city_scope_idx ON programs(city_scope);
CREATE INDEX IF NOT EXISTS programs_category_idx ON programs(category);
CREATE INDEX IF NOT EXISTS programs_active_idx ON programs(active);
