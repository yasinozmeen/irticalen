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
  ip_hash TEXT,
  -- sahibin defterinde: "yapıldı" işareti ve "sil" (kayıt silinmez, yalnız gizlenir)
  done_at INTEGER,
  hidden_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_feedback_ts ON feedback(ts);

CREATE INDEX IF NOT EXISTS idx_feedback_iphash_ts ON feedback (ip_hash, ts);

-- Telegram'dan gelen sahibin notları: aynı güncelleme iki kez gelirse ikincisi yok sayılır (INSERT OR IGNORE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_idea_session ON feedback (session) WHERE kind = 'idea';

-- Mevcut veritabanına sonradan eklenen sütunlar (bir kez çalıştırıldı, 2026-09-22):
-- ALTER TABLE feedback ADD COLUMN done_at INTEGER;
-- ALTER TABLE feedback ADD COLUMN hidden_at INTEGER;
