CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  session TEXT NOT NULL,
  name TEXT NOT NULL,
  locale TEXT,
  mode TEXT,
  category TEXT,
  topic TEXT,
  value REAL,
  phase TEXT,
  path TEXT,
  device TEXT,
  ref_host TEXT,
  country TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_name_ts ON events(name, ts);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  contact TEXT,
  locale TEXT,
  path TEXT,
  session TEXT,
  phase TEXT,
  device TEXT,
  country TEXT,
  -- günlük tuzla özetlenmiş IP (geri çevrilemez, ertesi gün eşleşmez); yalnız kişi başı günlük sınır için
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_ts ON feedback(ts);

CREATE INDEX IF NOT EXISTS idx_feedback_iphash_ts ON feedback (ip_hash, ts);
