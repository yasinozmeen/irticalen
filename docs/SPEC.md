## Davranış spec'i (orijinalin incelemesinden)

**Durumlar:** `idle → speech → done` (Hazırlıksız) · `idle → research → ready → speech → done` (Araştırmalı). Çevirme (`spinning`) ayrı geçici durum; o sırada ve oturum açıkken tüm kontroller kilitli.

**Ana ekran:** marka + "yapan" satırı · mod anahtarı (2'li radiogroup, ok tuşlarıyla) + mod açıklaması · yalnız Hazırlıksız modda kategori açılır listesi (listbox; Araştırmalı modda gizli, havuz sabit "Derin Araştırma") · konu alanı etiketi `Hazır` / `Çekiliyor…` / `Konun` + büyük konu başlığı · butonlar: `Çevir`→`Tekrar çevir` (`Çevriliyor…` iken pasif) ve `{X} dk sayacı başlat` / `{X} dk araştırmayı başlat` (konu yokken pasif) · sağ üstte ayarlar.
- Kategori değişince otomatik yeni rastgele konu gelir.

**Çevirme:** ~4800 ms, kübik ease-out, `requestAnimationFrame`; adım sayısı = (3 + 0–2 tam tur) × liste + 1..n-1 kaydırma → **bir öncekiyle aynı konuya inemez**. Her adımda azalan sesle tık; inişte 3 notalı akor. 5100 ms güvenlik zaman aşımı.
- Görsel olarak gerçek bir çark döner: iPhone alarm saati seçici (UIPickerView) gibi, bize dönük yatay eksenli görünmez bir 12 yüzlü silindir; konular satır satır yüzeylerde yazılı, adım arttıkça alttan gelip ortaya oturuyor, üst/alt komşular silindir eğrisiyle küçülüp maskeyle soluyor. RAF döngüsü her karede tamburun rotasyonunu (CSS custom property, imperative ref ile) günceller — Preact state'i yalnız tamsayı adım değişince (ses/tık ve metin) tetiklenir, 60fps'de gereksiz re-render yok.
- `prefers-reduced-motion: reduce` → 3B dönüş yok, sonuca anında inilir, çark statik üç satır görünümünde kalır.

**Sayaç katmanı (tam ekran dialog):** üstte konu · Araştırmalı'da "Araştırılıyor" etiketi (turkuaz vurgu) · dairesel ilerleme halkası + `MM:SS` · `aria-live` durum metni: `Araştır.` / `Araştırma bitti.` / `Konuş.` / `Süre.` · ready'de "Sırada: {X} konuşma." · butonlar: `Araştırmam bitti` (research), `Konuşmaya hazırım` (ready), `Kapat` (her zaman; `Esc` aynı iş). **Duraklat yok.** Süre bitince fanfar + halka nabız animasyonu. Arka plan `inert`.

**Sayaç:** `hedef = Date.now() + süre`; 100 ms'de bir `ceil((hedef-now)/1000)`.

**Ayarlar (dialog, odak tuzağı, Esc kapatır):** "Konuşma" 1–10 dk, "Araştırma" 1–60 dk (adım 1; varsayılan 1 dk / 10 dk) · "Ses efektlerini kapat" · "Sayaçta süreyi gizle" · "Bir dahaki sefere kayıtlı." · `Tamam`.

**Ses (Web Audio, dosyasız):** tık = bant geçiren, sönümlü beyaz gürültü ~30 ms, tıklar arası en az 45 ms (üst üste binip cızırdamasın) · iniş = C5–E5–G5 sinüs · bitiş fanfarı = G4–C5–E5–G5 + C6 üçgen dalga · ilk tıklamada AudioContext ısıtma · sessiz bayrağı her fonksiyonun başında.

**Kalıcılık:** `irticalen:speech`, `irticalen:research` (saniye), `irticalen:muted`, `irticalen:hideClock`, + bizde `irticalen:lang`. Hepsi try/catch; bozuk/eksik veri → varsayılan. Geçmiş/istatistik/seri **yok** (MVP'de de yok).

**Yok olanlar (bizde de yok):** mikrofon, ağ isteği, üyelik, service worker (yalnız manifest).

**Hata ekranı:** "Bir şeyler ters gitti" · "Pratiğe devam etmek için sayfayı yenile. Sayaç ayarların kayıtlı." · `Tekrar dene`.

**Erişilebilirlik/hareket:** radiogroup, listbox, dialog+aria-modal, role=timer, sr-only konu duyurusu; `prefers-reduced-motion` tüm animasyonları kapatır; genişlik breakpoint'i yok, `clamp()` + `100svh` + safe-area ile akışkan.

**Orijinalin görünümü (referans — kopyalanmayacak, Yasin kendi tasarımını seçecek):** koyu antrasit-yeşil zemin, krem metin, terracotta vurgu, Fraunces + Outfit, kapsül butonlar, film greni dokusu.

**Araştırma bölümleri (2026-09-22):** araştırma süresi üç bölüme ayrılır: `topla` → `kur` → `ısın` (~%70 / %20 / %10; her bölüm en az 30 sn; kur en çok 5 dk, ısın en çok 2 dk; toplam 3 dk altındaysa ısın yok). Bölüm süreyle kendiliğinden ilerler (hafif ses + kayarak gelen içerik), `sonraki bölüm` ile öne atlanabilir, geri gitmez. Sayaç tek parça sürer.
- *topla* — durum "Beş şeyi ara." + işaretlenebilir liste (zorunlu değil): öz · nasıl çalışıyor · şaşırtıcı detay · somut örnek · senin fikrin ("en önemlisi bu").
- *kur* — "İskeleti kur." + "Yeni bilgi toplamayı bırak." + konuşma iskeleti: **Nedir?** (öz, nasıl çalışıyor) · **Bir örnek** (somut örnek, şaşırtıcı detay) · **Ne düşünüyorum?** (senin fikrin); işaretlenenler mürekkep, diğerleri kurşun kalem.
- *ısın* — "Isın." + "İlk ve son cümleni bir kez sesli söyle." + aynı iskelet.

**Konuşma iskeleti:** Nedir? → Bir örnek → Ne düşünüyorum? (süre üçe bölünür). Her iki modda konuşma sırasında görünür.

**Süreyi gizle:** sayaçta `süreyi gizle`/`süreyi göster` bağlantısı (ve ayarlarda onay kutusu). Gizliyken rakam ve cetvel bulanıklaşır, dokununca açılır; "Süre." ekranında süre yine görünür. Varsayılan: görünür. Tercih kalıcıdır.
