# İrticalen Tracking & Feedback API (Cloudflare Worker)

İrticalen web uygulaması için gizlilik odaklı (çerezsiz, IP/User-Agent saklamayan) izleme ve geri bildirim Worker servisi.

---

## Kurulum Adımları

1. **Cloudflare Girişi:**
   ```bash
   npx wrangler login
   ```

2. **D1 Veritabanı Oluşturma:**
   ```bash
   npx wrangler d1 create irticalen
   ```

3. **Veritabanı Kimliğini Tanımlama:**
   Komut çıktısındaki `database_id` değerini `wrangler.toml` içerisindeki `database_id` alanına yapıştırın:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "irticalen"
   database_id = "<OLUSTURULAN_DATABASE_ID>"
   ```

4. **Veritabanı Şemasını Uzak D1'e Uygulama:**
   ```bash
   npx wrangler d1 execute irticalen --remote --file=schema.sql
   ```

5. **Worker Dağıtımı:**
   ```bash
   npx wrangler deploy
   ```

---

## 5 Hazır Rapor Sorgusu

Sorguları Cloudflare Dashboard D1 konsolunda veya CLI üzerinden (`npx wrangler d1 execute irticalen --remote --command="..."`) çalıştırabilirsiniz:

### 1. Günlük Huni (Oturum Sayıları)
`page_view` → `spin` → `land` → `start_speech` → `speech_done` aşamalarındaki benzersiz oturum sayıları (son 24 saat):

```sql
SELECT
  COUNT(DISTINCT CASE WHEN name = 'page_view' THEN session END) AS page_view_sessions,
  COUNT(DISTINCT CASE WHEN name = 'spin' THEN session END) AS spin_sessions,
  COUNT(DISTINCT CASE WHEN name = 'land' THEN session END) AS land_sessions,
  COUNT(DISTINCT CASE WHEN name = 'start_speech' THEN session END) AS start_speech_sessions,
  COUNT(DISTINCT CASE WHEN name = 'speech_done' THEN session END) AS speech_done_sessions
FROM events
WHERE ts >= unixepoch() * 1000 - 86400000;
```

---

### 2. Erken Kapatma Ortalama Kalan Süre
`close_early` olaylarında konuşmanın bitmesine ortalama kaç saniye kaldığı:

```sql
SELECT
  COUNT(*) AS total_early_exits,
  ROUND(AVG(value), 1) AS avg_remaining_seconds,
  MIN(value) AS min_remaining_seconds,
  MAX(value) AS max_remaining_seconds
FROM events
WHERE name = 'close_early' AND value IS NOT NULL;
```

---

### 3. JavaScript Hataları Listesi
En sık karşılaşılan hatalar, oluştukları evre ve sayfa yolu:

```sql
SELECT
  topic AS error_message,
  phase,
  path,
  COUNT(*) AS occurrences,
  MAX(ts) AS last_seen_ts
FROM events
WHERE name = 'js_error'
GROUP BY topic, phase, path
ORDER BY occurrences DESC, last_seen_ts DESC
LIMIT 50;
```

---

### 4. Cihaz ve Ülke Dağılımı
Oturum bazında ziyaretçilerin cihaz türü ve ülke dağılımı:

```sql
SELECT
  COALESCE(device, 'unknown') AS device,
  COALESCE(country, 'unknown') AS country,
  COUNT(DISTINCT session) AS session_count
FROM events
GROUP BY device, country
ORDER BY session_count DESC;
```

---

### 5. Son 50 Geri Bildirim
Kullanıcılardan gelen en son 50 konu önerisi ve sorun bildirimi:

```sql
SELECT
  id,
  datetime(ts / 1000, 'unixepoch', 'localtime') AS created_at,
  kind,
  text,
  contact,
  locale,
  device,
  country
FROM feedback
ORDER BY ts DESC
LIMIT 50;
```
