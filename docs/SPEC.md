## Davranış spec'i (orijinalin incelemesinden)

**Durumlar:** `idle → speech → done` (Hazırlıksız) · `idle → research → ready → speech → done` (Araştırmalı). Çevirme (`spinning`) ayrı geçici durum; o sırada ve oturum açıkken tüm kontroller kilitli.

**Ana ekran:** marka + "yapan" satırı · mod anahtarı (2'li radiogroup, ok tuşlarıyla) + mod açıklaması · yalnız Hazırlıksız modda kategori açılır listesi (listbox; Araştırmalı modda gizli, havuz sabit "Derin Araştırma") · konu alanı etiketi `Hazır` / `Çekiliyor…` / `Konun` + büyük konu başlığı · butonlar: `Çevir`→`Tekrar çevir` (`Çevriliyor…` iken pasif) ve `{X} dk sayacı başlat` / `{X} dk araştırmayı başlat` (konu yokken pasif) · sağ üstte ayarlar.
- Kategori değişince otomatik yeni rastgele konu gelir.

**Çevirme:** ~4800 ms, kübik ease-out, `requestAnimationFrame`; adım sayısı = (3 + 0–2 tam tur) × liste + 1..n-1 kaydırma → **bir öncekiyle aynı konuya inemez**. Her adımda azalan sesle tık; inişte 3 notalı akor. 5100 ms güvenlik zaman aşımı.

**Sayaç katmanı (tam ekran dialog):** üstte konu · Araştırmalı'da "Araştırılıyor" etiketi (turkuaz vurgu) · dairesel ilerleme halkası + `MM:SS` · `aria-live` durum metni: `Araştır.` / `Araştırma bitti.` / `Konuş.` / `Süre.` · ready'de "Sırada: {X} konuşma." · butonlar: `Araştırmam bitti` (research), `Konuşmaya hazırım` (ready), `Kapat` (her zaman; `Esc` aynı iş). **Duraklat yok.** Süre bitince fanfar + halka nabız animasyonu. Arka plan `inert`.

**Sayaç:** `hedef = Date.now() + süre`; 100 ms'de bir `ceil((hedef-now)/1000)`.

**Ayarlar (dialog, odak tuzağı, Esc kapatır):** "Konuşma" 1–10 dk, "Araştırma" 1–60 dk (adım 1; varsayılan 1 dk / 10 dk) · "Ses efektlerini kapat" · "Bir dahaki sefere kayıtlı." · `Tamam`.

**Ses (Web Audio, dosyasız):** tık = bant geçiren, sönümlü beyaz gürültü ~30 ms, tıklar arası en az 45 ms (üst üste binip cızırdamasın) · iniş = C5–E5–G5 sinüs · bitiş fanfarı = G4–C5–E5–G5 + C6 üçgen dalga · ilk tıklamada AudioContext ısıtma · sessiz bayrağı her fonksiyonun başında.

**Kalıcılık:** `irticalen:speech`, `irticalen:research` (saniye), `irticalen:muted`, + bizde `irticalen:lang`. Hepsi try/catch; bozuk/eksik veri → varsayılan. Geçmiş/istatistik/seri **yok** (MVP'de de yok).

**Yok olanlar (bizde de yok):** mikrofon, ağ isteği, üyelik, service worker (yalnız manifest).

**Hata ekranı:** "Bir şeyler ters gitti" · "Pratiğe devam etmek için sayfayı yenile. Sayaç ayarların kayıtlı." · `Tekrar dene`.

**Erişilebilirlik/hareket:** radiogroup, listbox, dialog+aria-modal, role=timer, sr-only konu duyurusu; `prefers-reduced-motion` tüm animasyonları kapatır; genişlik breakpoint'i yok, `clamp()` + `100svh` + safe-area ile akışkan.

**Orijinalin görünümü (referans — kopyalanmayacak, Yasin kendi tasarımını seçecek):** koyu antrasit-yeşil zemin, krem metin, terracotta vurgu, Fraunces + Outfit, kapsül butonlar, film greni dokusu.
