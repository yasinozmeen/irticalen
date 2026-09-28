# Masaüstü taslakları

Statik taslaklar; gerçek renk değişkenleri, Newsreader ve kâğıt dokusu `desktop.css` içinde (`src/styles/global.css`'ten kopya). Hiçbir üretim dosyasına dokunulmadı.

Görmek için: `cd design-options/desktop && python3 -m http.server 8000` → `http://localhost:8000/` (galeri). Her taslakta durum adresle seçilir: `?s=idle` (boşta), `?s=landed` (konu geldi), B'de ayrıca `?s=first` (ilk ziyaret). Sonuna `&check` eklenirse sayfa kendi kendini denetler (kaydırma, taşma, çubuğun altına girme) ve sol üstte yeşil/kırmızı etiket gösterir.

| Dosya | Ne |
|---|---|
| `zengin-a.html` · `zengin-a-bosta.png` · `zengin-a-konu.png` | Zengin yön A — açık kitap |
| `zengin-b.html` · `zengin-b-bosta.png` · `zengin-b-konu.png` · `zengin-b-ilk-ziyaret.png` | Zengin yön B — çalışma defteri |
| `minimalist.html` · `minimalist-bosta.png` · `minimalist-konu.png` | Bugünkü sade hâl, dil seçimi üst çubuktan kalkmış |
| `ayarlar.html` · `ayarlar.png` | Ayarlar penceresi: dil + görünüm + mevcut sayaç ayarları |
| `desktop.css` · `desktop.js` · `index.html` | Ortak stil, durum/denetim betiği, galeri |

## Ortak kararlar (iki zengin yönde de)

- **Genişlik:** içerik 760px yerine 1200px'e açılır; alttaki çubuk da aynı kenarlara hizalanır. Sütunlar yalnız 1px çizgiyle ayrılır; kutu, gölge, kart yok.
- **Konuşma iskeleti sayaç açılmadan görünür**, düğmenin hemen üstünde tek satır: *takılırsan* 1 nedir? 2 bir örnek 3 ne düşünüyorum? Araştırmalı modda iki satır olur: *önce* topla 7 dk · kur 2 dk · ısın 1 dk, *sonra* iskelet + konuşma süresi. Dakikalar ayardaki süreden `planResearchStages` ile hesaplanır. Kişi başlamadan önce ne kadar zamanı olduğunu görür. Bu parça hangi yön seçilirse seçilsin alınmaya değer.
- **Ekran yüksekliğine uyum:** zengin görünümde çark ve dev konu ekran yüksekliğine göre de küçülür. 1440×900 ve 1280×800'de, ayrıca bu ekranlarda tarayıcı çubukları düşülünce kalan ~813 ve ~713 piksellik alanda da kaydırma çıkmıyor (`&check` ile ölçüldü). Genişlikte değerler minimalistle aynı: 72px çark satırı, en çok 120px konu.
- **Kelime bölünmez:** konu satırları `paperLines` mantığıyla (her kelime kendi satırında) dizildi. En uzun konu adı ("saatleri ayarlama enstitüsü") B'de denendi.

## Yön A — açık kitap

Masaüstü açık bir kitap gibi. Sol sayfa **fihrist**: mod anahtarı, altında kategoriler açık liste olarak (açılır menü kalkar). Seçili kategorinin altında içinden üç örnek konu italik yazılır, böylece kişi ne seçtiğini görür. Araştırmalı modda aynı liste alanlara dönüşür (hepsi, zihin ve davranış, ekonomi ve karar…). Sayfanın dibinde **"irticalen" sözlük maddesi** sabit durur: okunuş, tür, tanım, örnek cümle. Kısa ekranda örnek cümle gizlenir. Sağ sayfa bugünkü pratik alanı ve iskelet.
**Gösterdiği:** kategori seçimi tek tıklık olur, tüm kategoriler bir bakışta görünür, sözlük maddesi markayı taşır.
**Bilerek dışarıda bıraktığı:** seri, son konular, sayılar. Kişisel veri göstermez; ilk ziyarette de 100. ziyarette de aynı görünür, hiçbir zaman boş kalmaz. Sözlük sayfada olduğu için alt çubuktan "irticalen ne demek?" kalkar.

## Yön B — çalışma defteri

Ana sütun bugünkü düzen (mod + kategori açılır menüsü, çark, iskelet, düğmeler). Sağda kalemle not tutulan bir **defter kenarı** var. Üstte seri tek cümle olarak yazılır: **13 gün** aralıksız konuştun. En uzun seri ve toplam gün bir alt satırdadır. Altında son 5 haftanın küçük takvimi: konuşulan gün mürekkeple yazılır ve altı çizilir (tek mod ince, iki mod kalın çizgi), bugün kırmızı çizgiyle gösterilir. En altta "Bugün iki konu konuştun." ve o konular listelenir. İlk ziyarette kenar boş durmaz, ne olacağını söyler: *ilk gün, bir konuşmayı sonuna kadar götür, serin başlasın.*
**Gösterdiği:** alışkanlık ve ilerleme; geri gelmek için sebep.
**Bilerek dışarıda bıraktığı:** açık kategori listesi ve sayfadaki sözlük maddesi (alt çubukta kalır). Grafik, yüzde, "toplam dakika" gibi pano sayıları yok; her şey cümle ya da takvim.
**Gerektirdiği:** seri ve takvim, mevcut `streak.ts` verisiyle çalışır (`buildCalendar`). "Bugün konuştukların" listesi için ise yeni, küçük bir yerel kayıt gerekir: bitirilen konu, mod ve süre. Paralelde bir seri sayfası (üst çubuk + takvim) yapılıyor. B seçilirse iki ayrı takvim tasarımı olmamalı; kenar o bileşeni kullanmalı.

## Minimalist ↔ zengin anahtarı ve dil

- **Ayarlar penceresi**, yukarıdan aşağıya: **dil** (türkçe · english), **görünüm** (minimalist · zengin) ve bir cümlelik açıklama, ince çizgi, ardından mevcut sayaç süreleri ve iki onay kutusu. Seçimler mod anahtarıyla aynı dilde: seçili olan mürekkep rengi, kalın ve altı çizili; diğeri kurşun kalem rengi.
- **Görünüm satırı yalnız geniş ekranda görünür** (öneri: ≥1100px). Telefon ve dar pencerede sayfa her zaman minimalisttir; satır gizlenir, çünkü zengin yerleşim oraya sığmaz. Varsayılan minimalist; seçim tarayıcıda saklanır (ör. `irticalen:view`). Geçiş anında konu kelimesi yerinde kalır, yeni sütun kayarak gelir (mevcut `runViewTransition` kuralı).
- **Dil** artık yalnız ayarlarda; üst çubukta yalnız logo ve ayar simgesi kalır. Dil seçimi bugünkü gibi `/en/` sayfasına gider.
- **Açık soru:** Türkçe sayfaya düşen İngilizce konuşan biri dili nasıl bulacak? Ayar simgesi evrensel ama tek başına zayıf bir işaret. Öneri: tarayıcı dili Türkçe değilse ilk ziyarette bir kez, alt çubukta küçük bir "english" bağlantısı göster ya da hreflang/yönlendirme ile çöz.

## Denetimde çıkan yan bulgu

Minimalist taslak bugünkü sayfanın kopyası. 1280×800 görüntü alanında kaydırmasız; ama 1280×800 bir ekranda tarayıcı çubukları düşülünce kalan ~713px'de ~30px taşıyor ve "çevir" düğmesi alt çubuğun altına giriyor. Canlı sitede de aynısı olabilir; ayrıca kontrol edilmeli. `dist` o sırada yeniden derlendiği için canlıda ölçülemedi.
