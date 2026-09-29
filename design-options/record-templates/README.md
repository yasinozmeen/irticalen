# Kayıt stilleri: sahne panosu (aşama 1 / 3)

"Kendini kaydet"in yeni **tek video** seçeneği için görsel stiller. Tarayıcı, kayıt sırasında kamera ve ekran görüntüsünü tek bir canvas'ta birleştirir ve stilin öğelerini üstüne çizer. Bu klasörde yalnız **sahne panosu** var: durağan kareler. Animasyon ve video yok. Ürün sahibi onay verene kadar bir sonraki aşamaya (kaba hareket taslağı) geçilmez.

Kareler de gerçek kayıttaki yöntemle, **canvas 2D** ile çiziliyor (`index.html` içindeki `draw(S)` işlevleri). Kamera yerine düz tonlu bir siluet, ekran yerine sitenin sayaç ekranının basit bir kopyası kullanıldı. Örnek oturum: *batık maliyet yanılgısı*, hazırlıksız, 3 dakika.

## Dosyalar

| Dosya | Ne |
|---|---|
| `index.html` | Sahne panosu: ortak kurallar, 4 stil (her birinde 7 düzen karesi + 3 kare dizisi, 15'er kare), ayarlar önizlemesi |
| `pano-tam.png` | Sayfanın tamamı, 1440 px genişlik |
| `pano-kagit.png` · `pano-balon.png` · `pano-gece.png` · `pano-izgara.png` | Her stil ayrı |
| `pano-ortak.png` · `pano-onizleme.png` | Ortak kurallar tablosu · ayarlar önizlemesi panosu |
| `fonts.css` · `fonts/` | Stillerin yazı aileleri (video-kurgu stillerinden kopya; latin + latin-ext). Newsreader Google Fonts'tan gelir |

Açmak için: `cd design-options/record-templates && python3 -m http.server 8000`, sonra `http://localhost:8000/`. Tek bir stili görmek için `?stil=balon` ekle. Tek bir kareyi tam boy görmek için `?kare=gece,cam,v,75,540` (stil, mod `both|cam|screen`, oran `h|v`, saniye, genişlik; sona `,ui` eklenirse Shorts arayüzü de çizilir).

## Stil ve düzen nasıl seçilir

Kişi ayarlarda **stil** (kâğıt · balon · gece · ızgara) ve **oran** (yatay 16:9 · dikey 9:16) seçer. **Düzeni kayıt modu belirler**:

- kamera + ekran → yatay: ekran solda, kamera sağda · dikey: ekran üstte, kamera altta
- yalnız kamera → yatay: kamera + yanda stilin sayaç kartı · dikey: sayaç kartı üstte, kamera altta
- yalnız ekran → yalnız yatay (16:9 ekranı dikeye sığdırmak okunmaz; bu modda "dikey" seçilirse yatay kaydedilir, ayarda söylenir)

## Neden bu dört stil

Video kurgudaki 9 stilden, **gerçek zamanlı çizime dayanıklı** ve **hissi birbirinden en farklı** dördü seçildi:

- **kâğıt:** sakin, sitenin kendisi. Zorunlu ve varsayılan stil.
- **balon:** enerjik, markanın kendi rengi ve şekli. Paylaşımda en tanınır stil.
- **gece:** koyu ve odaklı. Açık stillerin karşısındaki tek koyu seçenek.
- **ızgara:** cesur ve grafik. Stilin ana fikri (bölüm değişince ızgaranın yeniden kurulması) gerçek zamanlıya en iyi taşınan fikir.

Dışarıda kalanlar ve nedenleri:

- **punto, terminal, sahne:** kimlikleri kelime kelime altyazıya dayanıyor (dev kinetik yazı, `> yazılıyor▌`, büyük sarı altyazı). Kayıt anında konuşmanın metni bilinmiyor; altyazısız hâlleri boş kalıyor.
- **sahne** ayrıca kamerayı tam ekran yapıp yazıyı yüzün üstüne koyuyor. Bu, "öğeler yüzü kapatmaz" kuralına aykırı.
- **odak:** ekranı tam kadraja alıp kamerayı küçük daire yapıyor. Gece ile aynı koyu hissi veriyor, üstüne yeni bir şey katmıyor.
- **gazete:** kâğıda çok yakın (ikisi de açık zeminli, serif, kırmızı vurgulu). İkinci bir "editoryal" seçenek olarak sonra eklenebilir.
- **krem**'in yuvarlak köşeleri ve gölgeleri alınmadı. Onun yerini sitenin kendi kurallarıyla (F — Kâğıt) çizilen **kâğıt** alıyor.

## Her stilde aynı olan davranış

Görünüş stile göre değişir, **ne zaman ne göründüğü** her stilde aynıdır:

| | açılış 0–3 sn | konuşma | süre. | süre sonrası | kapanış (süre + 3 sn → durdurana kadar) |
|---|---|---|---|---|---|
| etiket yuvası | "hazırlıksız · 3 dakika" | 01 nedir? → 02 bir örnek → 03 ne düşünüyorum? (süre üçe bölünür, sitedeki `speechArcStep` ile aynı) | "süre." | "süre." | "süre." |
| sayaç | boş | stilin kendi çizgisi dolar | dolu | dolu (taşma sayacı yok) | dolu |
| logo | elmaslar | elmaslar mikrofon seviyesiyle oynayan üç çubuğa döner (sitedeki `Logo` durumları) | tek çubuk | tek çubuk | son kartta büyük |
| konu | her karede görünür ama yalnız bir yerde: ekranlı düzenlerde ekranın kendisinde, yalnız kamerada stilin sayaç kartında | | | | |
| kamera / ekran | yeri kayıt boyunca sabit | | | | kamera kalır; ekranın (ya da sayaç kartının) yerine son kart gelir |

Kapanış kararı: kaydın sonuna saniye eklenemediği için **son kart süre dolduktan 3 saniye sonra** gelir ve kişi kaydı durdurana kadar ekranda kalır. Kişi süre bittikten sonra konuşmayı bağlayabilir, yüzü görünmeye devam eder. Kayıt ne zaman durdurulursa durdurulsun, son kare adresi (`irticalen.yasinozmeen.me`) ve "konu gelir, söz sende." cümlesini gösterir. Tam ekranı kaplayan bir kapanış kartı yok.

## Stiller

**kâğıt.** Site nasıl görünüyorsa video da öyle görünür: kâğıt zemin, mürekkep, tek kırmızı vurgu, Newsreader. Yuvarlak köşe, gölge ve kutu yok. Başlıkta solda logo, sağda etiket yuvası var. Başlığın altındaki ince çizgi aynı zamanda sayaç cetvelidir: 12 çentik var, konuşma ilerledikçe mürekkep dolar. Yalnız kamera düzeninde kameranın yanındaki alan, sitenin sayaç ekranı gibi doğrudan kâğıda yazılır ("konu", konu adı, dev rakamlar). Ekran plakası kâğıt zeminde kaybolmasın diye ince bir çizgiyle çevrilidir. Kapanışta ekranın yerine aşağıdan yeni bir kâğıt yükselir; üstünde logo, cümle ve adres var. His: kitap sayfası, sessiz.

**balon.** Kobalt zemin üstünde hafif bir çini deseni var (logodaki elmaslar, %5 görünürlükte). Kamera, logodaki keskin köşeli konuşma balonunun içinde konuşur. Ekran sır rengi kenarlı bir karo gibi durur, arkasında sert ve bulanıksız bir gölge var. Sayaç 12 elmastan oluşur, elmaslar tek tek dolar. Süre dolunca hepsi mercan rengine döner. Kapanışta ekranın yerine ikinci bir balon gelir: kameraya "cevap veren" balon, içinde logo, cümle ve adres. Balonun bu stilde bilerek kullanılan tek "gölge"si karo gölgesidir. Bulanık değil, düz bir şekil; kurgudaki balondan geliyor. His: enerjik, "hadi" dedirten.

**gece.** Neredeyse siyah, sıcak bir zemin; ince kenarlı koyu kartlar; tek vurgu kehribar. Sol üstte logonun altında etiket var (kehribar renkli numara + ad). Sağ üstte bir stüdyo monitörü gibi zaman kodu durur (`01:45 / 03:00`). Altta ince bir kehribar çizgi dolar. Yalnız kamera düzeninde kamera sola yaslanır, sağdaki kartta "kalan" süre ve iskelet listesi var. Böylece kurgudaki "yüz düzeninde iki yanda boş siyah" kusuru burada yok. Kapanışta koyu bir kart aydınlanır, üstünde kehribar bir çizgi uzar. His: akşam kaydı, ciddi, odaklı.

**ızgara.** Kalın siyah çizgilerle bölünmüş hücreler, kırmızı-mavi-sarı düz bloklar. Kamera ve ekran kendi hücrelerinde durur ve hiç kıpırdamaz. İskelet adımı değişince renk blokları yer ve renk değiştirir: yeni renk eskisinin üstüne silerek gelir, iki renk karışmaz. Adım numarası da hücre içinde kayarak değişir. Sayaç ayrı bir çubuk değil; adım hücresi soldan sağa sarıyla dolar. Süre dolunca hücre dev bir "süre." damgası taşır. Kapanışta ekran hücresine yukarıdan mavi bir hücre iner. Dikeyde ızgara bilerek kenara kadar taşar. Yazılar güvenli alanda kalır, ama ekran hücresinin sağdaki ~100 px'i uzun telefon ekranlarında kırpılabilir. His: afiş, cesur.

## Bilerek dışarıda bırakılanlar

- **Kelime kelime altyazı ve sessizlik kesme:** kayıt anında metin yok. İleride ayrı bir özellik olabilir (kayıttan sonra yerelde yazıya dökme).
- **Hareketli grafik sahneleri, etiketler (sticker), abone ara parçası, hızlandırma rozeti:** kurguya özgüler, canlı kayıtta anlamları yok.
- **Taşma sayacı** ("+0:12"): her videoyu "süreyi aştı" diye damgalardı. Süre sonrası sakin kalır.
- **Kırmızı "kayıt" işareti, ayna önizleme:** yalnız kişi için var, videoya girmez. Dosyadaki görüntü aynalanmaz.
- **Kâğıt dokusu (gren):** videoda düz zemin kullanılıyor, paylaşım kartlarındaki (OG) gibi. Gren bit bütçesini yer, sıkıştırmada bulanık bir lekeye döner.
- **İkinci sayaç:** ekranlı düzenlerde dev rakamlar zaten ekranda. Stil yalnız ince ilerleyişi çizer.
- **Dikey yalnız ekran** düzeni (yukarıdaki nedenle).

## Ayarlar penceresindeki küçük önizleme

Stil seçilirken yanında, seçilen oranda küçük ve canlı bir karo döner (yatay 200 px, dikey 90 px). Kaydın bütün hikâyesi 4 saniyelik bir döngüde oynar:

1. 0,0–0,6 sn: açılış
2. 0,6–2,4 sn: sayaç hızla dolar, adım değişir
3. 2,4–3,0 sn: "süre."
4. 3,0–4,0 sn: kapanış kartı, sonra başa döner

Karo, kayıtta kullanılacak çizim işlevinin aynısıyla çizilir; ayrı bir görsel dosyası yok, stil değişince karo da kendiliğinden değişir. Kamera açılmaz, siluet kullanılır: yalnız önizleme için kamera izni istemek erken olur. "Hareketi azalt" açıksa yalnız 2. kare durağan gösterilir. Döngü yalnız pencere açıkken ve karo görünürken çalışır. Stil ya da oran değişince karo 200 ms'de solarak yeni stile geçer. Panodaki "ayarlarda küçük önizleme" bölümünde dört stilin dört karesi gerçek boyutta.

## Gerçek zamanlı canvas çiziminde dikkat edilecekler

1. **Kayıt hattı:** `canvas.captureStream(30)` + mikrofon ses izi → tek `MediaStream` → mevcut `MediaRecorder` ve MIME seçimi (`src/lib/recorder.ts`). Kamera ve ekran birer gizli `<video>`ya bağlanır, her karede `drawImage` ile plakaya "cover" kırpılır.
2. **En büyük risk, sekme gizlenince çizimin durması:** gizli sekmede `requestAnimationFrame` durur. Tarayıcı `setTimeout`/`setInterval`'ı saniyede bire kısar, Chrome'da 5 dakikadan sonra daha da seyreltir. Kişi başka bir pencere paylaşıp irticalen sekmesini arkada bırakırsa video donar. Çözüm yolları:
   - Çizimi bir Web Worker'a taşımak: `OffscreenCanvas`, kareler Chrome'da `MediaStreamTrackProcessor` ile aktarılır.
   - Ya da çizimi Worker'dan gelen bir tik ile sürmek.
   - Safari'de `MediaStreamTrackProcessor` yok. Orada "sekmeyi açık tut" uyarısı gerekir.
   - En yaygın durumda sorun yok: kişi irticalen sekmesinin kendisini paylaşıyorsa sekme görünür kalır.
3. **Zaman:** hareketler kare sayısından değil, `performance.now() − konuşma başlangıcı`ndan hesaplanır (panodaki `derive(t)`). Bu, sayacın kullandığı zaman kaynağıyla aynıdır; kare düşse de adım değişimi ve "süre." kaymaz.
4. **Yazı tipi yükleme:** canvas, yüklenmemiş bir yazı tipini sessizce yedek fontla çizer. Kayıt başlamadan önce kullanılacak her yüz (ağırlık ve italik dahil) `document.fonts.load()` ile beklenmeli; yüklenemezse kayıt stilsiz başlamamalı, bu durum kişiye söylenmeli. Türkçe harfler latin-ext dosyasında (ı ğ ş İ). Stil yazı tipleri (Figtree, Space Grotesk, IBM Plex Mono, Big Shoulders Display, Instrument Sans) yalnız o stil seçilince, siteden (self-host) yüklenmeli. Cloudflare'deki CSP'de dış kaynak olarak yalnız Google Fonts var; `font-src`'da `'self'` olduğu doğrulanmalı, yoksa yazı tipleri sessizce engellenir. `ctx.letterSpacing` her tarayıcıda yok; yoksa harf aralığı olmadan çizilir, bu kabul edilebilir.
5. **Okunabilirlik:**
   - Dikeyde en küçük yazı 36 px (1080 genişlikte, telefonda ≈ 13 pt). Başlık etiketleri 36–42 px, konu 48 px üstü.
   - Yatayda yazılar 30 px'in altına inmez. Yatay video telefonda dik tutulunca küçük etiketler zor okunur; yatay, masaüstü ve tam ekran izleme içindir.
   - Hiçbir yazı videonun üstüne binmez; hepsi düz zemindedir, bu yüzden gölge ya da kontur gerekmez.
   - İnce çizgiler en az 2 px. Daha incesini sıkıştırma siler.
   - Konu kelimeden bölünmez; sığmazsa punto küçülür (`fit`), gerekirse ikinci satıra geçer.
6. **Dikeyde güvenli alan:** yazı, logo ve kartlar x 120–960 ve y 120–1660 arasında kalır. Alttaki 260 px'e platformun yazıları gelir. Uzun ekranlı telefonlar ise görüntüyü büyütüp her yandan ~100 px kırpar. Zemin kenara taşabilir. Panoda Shorts arayüzü karesi bunu gösteriyor.
7. **Ekranın içeriği:**
   - Kişi irticalen sekmesini paylaşırsa sayfanın kendi "kayıt" işareti ve ayna kamera önizlemesi de ekran görüntüsüne girer. Tek video kaydında bunlar sayfada gizlenmeli; küçük önizlemeyi canvas'ın kendisi göstermeli.
   - Dikeyde ekran, sayaç bloğuna yakınlaştırılır. Chrome'da bu Region Capture ile olur (`CropTarget.fromElement` ile yalnız sayaç öğesi kırpılır). Diğer tarayıcılarda kırpmasız çizilir.
   - Paylaşılan yüzeyin irticalen sekmesi olup olmadığı Chrome'da Capture Handle ile anlaşılır. Anlaşılamıyorsa güvenli varsayım "başka pencere" düzenidir: stil konuyu kendisi yazar (panoda "paylaşılan ekran irticalen sekmesi değilse" karesi). Konunun iki kez görünmesi, hiç görünmemesinden iyidir.
8. **Performans:**
   - Sabit katmanlar (zemin, çini deseni, çerçeveler) bir kez ekran dışı bir canvas'a çizilir. Her karede yalnız bir zemin kopyası, 1–2 video `drawImage` ve birkaç yazı çizilir. 1080p30 güncel bir dizüstünde rahat çalışır.
   - Kare süresi 25 ms'yi geçerse 720p'ye inilir.
   - Bulanıklık, gölge (`shadowBlur`) ve `filter` hiç kullanılmaz; hem pahalı hem kimliğe aykırı.
   - Dosya büyüklüğü: 1080p'de ~5 Mbit/sn ile 3 dakikalık kayıt ≈ 110 MB.
9. **Kapanış ve durdurma:** son kart "süre + 3 sn"de gelir. Süre dolmadan kapatılan kayıt zaten atılıyor (mevcut kural). 30 dakikalık kayıt tavanı aynen kalır.
10. **Ses ve logo:** logodaki üç çubuk bir `AnalyserNode`'dan okunan mikrofon seviyesiyle oynar; maliyeti çok düşük. Ses sessizse çubuklar yerinde durur.
11. **Dil:** İngilizce sayfada etiket, iskelet ve kapanış cümlesi i18n'den gelir. Metin uzunlukları değişeceği için `fit` şart.

## Karar bekleyenler (ürün sahibine)

- Kapanış cümlesi **"konu gelir, söz sende."**: sitedeki mod açıklamasından alındı. Başka bir cümle istenirse tek yerden değişir.
- Açılış etiketi **"hazırlıksız · 3 dakika"**: araştırmalı modda "araştırmalı · 3 dakika" olur.
- Tek video, mevcut "ayrı dosyalar"ın **yerine mi, yanına mı** gelsin? Panodaki ayar taslağında ikisi yan yana ("video: ayrı dosyalar · tek video").

## Tavsiye (ilk sürüm)

- **Stiller:** kâğıt (varsayılan) + balon. Biri sakin ve sitenin kendisi, öteki enerjik ve paylaşımda en tanınır olanı. Hisleri birbirinden en uzak ikili bu.
- **Düzenler:** beşi de. Parçalar ortak olduğu için düzen başına maliyet küçük. En önemlileri kamera + ekran yatay (YouTube), kamera + ekran dikey ve yalnız kamera dikey (Shorts ve Reels).
- **gece ve ızgara ikinci dalgada.** İlk gerçek videolar izlendikten sonra, hangi hissin eksik kaldığına bakılarak eklenmeli. Izgaranın dikeyde kenara taşan hücreleri bir de gerçek telefonda denenmeli.
- **Uygulamadan önce kapatılması gereken teknik risk:** "sekme gizlenince çizim durur" (yukarıda madde 2). Başka pencere paylaşımı ya bununla çözülmeli ya da ilk sürümde yalnız irticalen sekmesini paylaşmaya yönlendirmeli.
