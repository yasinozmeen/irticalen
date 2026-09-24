---
name: irticalen-hazirlik
description: İrticalen'in Araştırmalı modunda çıkan bir terim (ör. "Pareto ilkesi", "Sahne ışığı etkisi") için hazırlık sürecinin "topla" bölümünde gereken SAF BİLGİYİ verir — öz, nasıl çalışır, şaşırtıcı detay, somut örnek, sık karıştırılanlar, tartışmalı yanlar. Yorum yapmaz, konuşma kurgulamaz, "senin fikrin" kısmını boş bırakır. Kullanıcı "/irticalen-hazirlik <terim>" yazdığında ya da "şu terim için hazırlık bilgisi ver" dediğinde kullan.
---

# irticalen → hazırlık bilgisi

Kullanıcı [irticalen](https://irticalen.yasinozmeen.me) sitesinde Araştırmalı modda bir terim çekti.
Araştırma süresi üç bölüm: **topla → kur → ısın**. Bu skill yalnız **topla** bölümüne hizmet eder:
kullanıcının "beş şeyi ara" listesindeki dört olgusal maddeyi doldurur, beşincisini (senin fikrin)
kullanıcıya bırakır.

Amaç: kullanıcı bilgiyi hızla alsın, beynini zorlayan kısım (fikir üretmek, iskeleti kurmak,
konuşmayı kurgulamak) **tamamen ona kalsın**.

## Kırmızı çizgiler

1. **Yorum yok.** "Bence", "bu önemli çünkü", "asıl mesele", "insanlar genelde yanılır" gibi değer
   yargısı ve çıkarım cümlesi yazma. Yalnız kaynaklara dayanan olgular.
2. **Konuşma kurgusu yok.** Giriş cümlesi önerme, "şöyle bağlayabilirsin", "iyi bir kapanış olur",
   "Nedir? / Bir örnek / Ne düşünüyorum?" iskeletine yerleştirme, retorik tavsiye — hiçbiri.
3. **"Senin fikrin" maddesi BOŞ kalır.** Oraya soru bile yazma; tek satır "—" bırak.
4. **Fikir sunan ifadeleri alıntı olarak ver.** Bir yazarın, araştırmacının görüşü olgudur
   ("Kahneman'a göre…"); kendi görüşün olgu değildir.
5. **Uydurma yok.** Sayı, yıl, isim, deney sonucu veriyorsan kaynağı olsun. Emin olmadığın
   ayrıntıyı "kaynaklarda net değil" diye işaretle ya da hiç yazma.

## Nasıl çalışır

1. Terimi al. Dil: terim Türkçeyse Türkçe, İngilizceyse İngilizce yaz. Terim belirsizse
   (birden fazla anlam) en yaygın anlamı seç ve ilk satırda hangisini seçtiğini söyle; sorma.
2. **Web'de doğrula.** Bir ansiklopedik kaynak (Wikipedia/Britannica/Stanford Encyclopedia vb.)
   + mümkünse özgün kaynak (deneyin makalesi, terimi ortaya atan kitap). Psikoloji etkileri için
   **tekrarlanabilirlik durumuna** (replication) mutlaka bak; bu olgudur, yorum değildir.
3. Aşağıdaki şablonu doldur. Toplam **250–400 kelime**; kullanıcının okuyup not almasına
   birkaç dakika yeter, daha uzunu topla bölümüne sığmaz.

## Çıktı şablonu (başlıklar birebir, sıra sabit)

```
# <terim>

**öz** — tek cümle: terim ne, kim/ne zaman ortaya attı.

**nasıl çalışıyor** — 3–5 cümle: mekanizma ya da tanımın içeriği; varsa özgün deney/kaynak.

**şaşırtıcı detay** — 1–3 madde: rakam, ters köşe, az bilinen köken. Her maddede kaynak.

**somut örnek** — 1–2 gerçek, tarihli/isimli örnek (uydurma senaryo değil).

**senin fikrin** — —

---
sık karıştırılan: <benzer 1–2 terim ve tek cümlelik fark>
tartışmalı / dikkat: <tekrarlanamayan deney, çürütülmüş iddia, yanlış atıf — yoksa "bilinen bir tartışma yok">
kaynaklar: <2–4 kısa bağlantı>
```

Şablon dışına satır ekleme; "kurmak için ipucu", "ek notlar", "özet" gibi bölümler yasak.

## Örnek (kısaltılmış)

Kullanıcı: `/irticalen-hazirlik Sahne ışığı etkisi`

```
# Sahne ışığı etkisi

**öz** — İnsanların, başkalarının kendilerine gerçekte olduğundan çok daha fazla dikkat ettiğini
sanması; terimi 2000'de Thomas Gilovich, Victoria Medvec ve Kenneth Savitsky ortaya attı.

**nasıl çalışıyor** — … (deneyin kurgusu, ölçülen fark) …

**şaşırtıcı detay**
- Cornell deneyinde Barry Manilow tişörtü giyen katılımcılar, odadakilerin yaklaşık %50'sinin
  fark ettiğini tahmin etti; gerçek oran ~%25'ti (Gilovich ve ark., 2000).

**somut örnek** — …

**senin fikrin** — —

---
sık karıştırılan: Hayali seyirci (Elkind, 1967) — ergenlik odaklı, daha eski kavram.
tartışmalı / dikkat: Etki küçük örneklemlerle ölçüldü; büyük çaplı tekrar çalışması sınırlı.
kaynaklar: …
```
