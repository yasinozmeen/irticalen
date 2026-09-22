# İzleme ve geri bildirim — sözleşme

Amaç: ziyaretçinin akışın neresinde bıraktığını görmek (huni), hataları yakalamak, konu önerisi ve
sorun bildirimi almak. **Kişisel veri yok:** çerez yok, IP saklanmaz, tarayıcı kimliği saklanmaz,
kalıcı kullanıcı numarası yok. Oturum numarası yalnız bellekte durur; sayfa kapanınca yok olur.
`navigator.doNotTrack === '1'` ise hiçbir olay gönderilmez (geri bildirim formu yine çalışır).

Servis: Cloudflare Worker, aynı alan adında `/api/*` (CORS gerekmez). Depo: Cloudflare D1.

## POST /api/e — olay
Gövde JSON (sendBeacon `text/plain` de yollayabilir; gövde her durumda JSON olarak ayrıştırılır), en çok 2 KB:

| alan | tip | not |
|---|---|---|
| `s` | string 8–40, yalnız harf/rakam/tire | bellekteki oturum numarası (zorunlu) |
| `n` | string | olay adı, aşağıdaki listeden (zorunlu) |
| `l` | `tr` \| `en` | dil |
| `m` | `off-the-cuff` \| `deep-research` | mod |
| `c` | string ≤40 | kategori kimliği |
| `t` | string ≤200 | konu ya da hata mesajı |
| `v` | number | sayısal değer (saniye) |
| `ph` | string ≤20 | o anki evre: `idle` `spinning` `research` `ready` `speech` `done` |
| `p` | string ≤80 | sayfa yolu |
| `d` | `mobile` \| `desktop` | genişlik < 768 → mobile |
| `r` | string ≤80 | yönlendiren alan adı (yalnız host) |

Olay adları: `page_view` `spin` `land` `start_research` `research_done` `start_speech` `speech_done`
`close_early` (v = kalan sn; `ph` hangi evrede kapatıldığını söyler — `speech`'te az kalan süreyle kapatmak çoğu zaman "erken bitirdim" demektir, `ready`'de `v` yoktur) `mode_change` `category_change` `settings_open` `sheet_open`
`share_click` `feedback_open` `feedback_sent` `js_error` (t = mesaj) `leave` (v = sayfada geçen sn).

Yanıt: `204` (geçerli), `400` (geçersiz — gövde yok sayılır), `413` (büyük). Sunucu ayrıca `ts`
(epoch ms) ve `country` (`request.cf.country`, 2 harf) ekler. IP ve User-Agent SAKLANMAZ.

## POST /api/feedback — konu önerisi / sorun bildirimi
Gövde JSON, en çok 4 KB: `kind` (`topic` \| `problem` \| `other`, zorunlu), `text` (1–1000, zorunlu),
`contact` (≤120, isteğe bağlı — kişi kendi isteğiyle yazar), `l`, `p`, `s`, `ph`, `d`.
Yanıt: `201` `{ "ok": true }`, `400`, `413`, `429`.

Kötüye kullanıma karşı: kişi başına günde 5, toplamda günde 1000 kayıt. "Kişi"yi ayırt etmek için IP adresi
SAKLANMAZ; yerine `SHA-256(IP + gizli tuz + günün tarihi)` özetinin ilk 12 baytı saklanır. Bu özet IP'ye geri
çevrilemez ve aynı kişi ertesi gün farklı bir özet üretir (günler arası eşleştirme yapılamaz). Yalnız geri
bildirimde tutulur; olaylarda (`/api/e`) hiç yoktur. Saatte 20'den fazla kayıt gelirse Telegram bildirimi
susar, kayıtlar yine saklanır.

## POST /api/telegram — sahibin kendi fikir notları
Telegram botuna yazılan mesajlar (webhook) aynı `feedback` tablosuna `kind = 'idea'`, `path = 'telegram'`,
`session = 'tg:<update_id>'` ile yazılır; bot "kaydedildi ✓" diye cevap verir. Yalnız
`X-Telegram-Bot-Api-Secret-Token` başlığı `TELEGRAM_WEBHOOK_SECRET` ile eşleşen ve sohbeti `TELEGRAM_CHAT_ID`
olan mesajlar kaydedilir; başka sohbetler sessizce yok sayılır. `/` ile başlayan komutlar ve boş mesajlar
kaydedilmez. Telegram yeniden denerse `update_id` aynı notun iki kez yazılmasını önler.
`POST /api/telegram/setup` (aynı gizli başlıkla) botun webhook'unu bu adrese kurar; bot anahtarı Worker'dan çıkmaz.

## /api/panel — sahibin defteri (Telegram Mini App)
Botta mesaj kutusunun yanındaki "defter" düğmesi (yalnız sahibin sohbetinde kurulur) `GET /api/panel` sayfasını
açar; sayfada veri yoktur. Veri `POST /api/panel/data` (`{ init, range: today|7|30|all }`) ve
`POST /api/panel/note` (`{ init, id, action: done|undone|hide|unhide }`) ile gelir. `init`, Telegram'ın imzaladığı
açılış verisidir: imza bot anahtarıyla doğrulanır, 24 saatten eskisi ve `user.id` ≠ `TELEGRAM_CHAT_ID` olanı `403`.
"sil" kaydı silmez, `hidden_at` ile gizler; "yapıldı" `done_at` yazar. Telegram'ın tarayıcı sürümünde
(web.telegram.org) açılmaz — sitenin `frame-ancestors 'none'` kuralı yüzünden; telefon ve bilgisayar uygulamasında açılır.

## Diğer
- `GET /api/health` → `200 {"ok":true}`.
- `/api/*` dışındaki ve tanımsız yollar → `404`. Yalnız `POST`/`GET`; diğerleri `405`.
- Başka bir siteden gelen `POST` (yabancı `Origin`) → `403`.
- Servis çökerse site aynen çalışır: istemci hiçbir hatayı yüzeye çıkarmaz.
