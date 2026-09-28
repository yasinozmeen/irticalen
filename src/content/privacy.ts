import type { Locale } from '../lib/types';

export interface PrivacyContent {
  path: string;
  meta: { title: string; description: string };
  eyebrow: string;
  h1: string;
  lead: string;
  updatedLabel: string;
  updated: string;
  sections: { id: string; h2: string; paragraphs: string[] }[];
  back: string;
}

/** Plain-language privacy page. Keep in sync with docs/TRACKING.md and src/lib/streak.ts storage. */
export const privacy: Record<Locale, PrivacyContent> = {
  tr: {
    path: '/gizlilik/',
    meta: {
      title: 'Gizlilik — İrticalen',
      description: 'İrticalen seni tanımaz: hesap, çerez ve ses kaydı yok. Yalnız isimsiz kullanım sayıları tutulur.',
    },
    eyebrow: 'kısa ve açık',
    h1: 'Gizlilik',
    lead: 'İrticalen seni tanımaz. Hesap yok, çerez yok, ses kaydı yok. Tuttuğumuz tek şey, sitenin nasıl kullanıldığını gösteren isimsiz sayılar.',
    updatedLabel: 'Son güncelleme',
    updated: '2026-09-28',
    sections: [
      {
        id: 'ne-tutuluyor',
        h2: 'Ne tutuluyor',
        paragraphs: [
          'Sitede ne yapıldığını gösteren isimsiz sayılar: hangi sayfa açıldı, çark çevrildi mi, sayaç başladı ve bitti mi, hangi konu ve kategori seçildi, ekranın telefon mu bilgisayar mı olduğu, siteye hangi siteden gelindiği (yalnız o sitenin adı), ülke (iki harf) ve bir hata olursa hatanın kısa açıklaması.',
          'Bu sayılar her ziyarette rastgele üretilen bir oturum numarasıyla gruplanır. Numara yalnız tarayıcının belleğinde durur, sayfa kapanınca kaybolur. Seni bir ziyaretten ötekine tanıyan bir numara yoktur.',
        ],
      },
      {
        id: 'ne-tutulmuyor',
        h2: 'Ne tutulmuyor',
        paragraphs: [
          'Adın, e-postan, IP adresin, tarayıcı bilgilerin, sesin ya da görüntün. Çerez kullanılmaz. Site bir barındırma hizmeti üzerinden sunulur; bu hizmet bağlantı kurmak için IP adresini teknik olarak görür, ama biz onu saklamayız.',
        ],
      },
      {
        id: 'beni-izleme',
        h2: '"Beni izleme" ayarı',
        paragraphs: [
          'Tarayıcında "beni izleme" (Do Not Track) açıksa hiçbir kullanım sayısı gönderilmez. Site aynen çalışır.',
        ],
      },
      {
        id: 'bize-yaz',
        h2: '"Bize yaz" formu',
        paragraphs: [
          'Formdan yazdığın metin ve istersen bıraktığın iletişim bilgisi saklanır; bunları yalnız sana cevap vermek ve siteyi düzeltmek için okurum. Yeni mesajlar bana bir mesajlaşma uygulaması üzerinden bildirim olarak da gelir.',
          'Formun kötüye kullanılmasını sınırlamak için IP adresinden türetilmiş kısa bir özet tutulur. Bu özet IP adresine geri çevrilemez ve her gün değişir; yani seni günler arasında eşleştirmek için kullanılamaz.',
        ],
      },
      {
        id: 'tarayicinda-kalanlar',
        h2: 'Yalnız tarayıcında kalanlar',
        paragraphs: [
          'Ayarların (süreler, ses, süreyi gizleme), daha önce gördüğün konular (tekrar gelmesin diye), araştırmalı modda seçtiğin alan ve pratik serin (hangi gün konuştuğun). Bunlar bu tarayıcıda durur, bize gönderilmez. Tarayıcının site verilerini silersen hepsi gider.',
          '"Kendini kaydet" açarsan kamera ve/veya ekran kaydı yalnız cihazında tutulur; hiçbir yere gönderilmez ve sayfadan ayrılınca silinir.',
        ],
      },
      {
        id: 'paylasim',
        h2: 'Paylaşım',
        paragraphs: [
          'Paylaş düğmeleri yalnız sen dokunduğunda, seçtiğin uygulamayı paylaşılacak metinle açar. Sen dokunmadıkça hiçbir yere bir şey gönderilmez.',
        ],
      },
      {
        id: 'iletisim',
        h2: 'Soru ya da silme isteği',
        paragraphs: [
          'Yazdığın bir mesajın silinmesini istersen ya da bir sorun olursa "bize yaz" formundan ulaşman yeterli.',
        ],
      },
    ],
    back: 'ana sayfaya dön',
  },
  en: {
    path: '/en/privacy/',
    meta: {
      title: 'Privacy — İrticalen',
      description: 'İrticalen does not know who you are: no account, no cookies, no recordings. Only anonymous usage counts are kept.',
    },
    eyebrow: 'short and plain',
    h1: 'Privacy',
    lead: 'İrticalen does not know who you are. No account, no cookies, no recordings. The only thing kept is anonymous numbers that show how the site is used.',
    updatedLabel: 'Last updated',
    updated: '2026-09-28',
    sections: [
      {
        id: 'what-is-kept',
        h2: 'What is kept',
        paragraphs: [
          'Anonymous counts of what happens on the site: which page was opened, whether the wheel was spun, whether a timer started and finished, which topic and category were picked, whether the screen is a phone or a computer, which site you came from (only its name), the country (two letters) and, if something breaks, a short description of the error.',
          'These counts are grouped by a session number that is made up at random on each visit. It lives only in the browser’s memory and is gone when the page closes. There is no number that recognises you from one visit to the next.',
        ],
      },
      {
        id: 'what-is-not-kept',
        h2: 'What is not kept',
        paragraphs: [
          'Your name, email, IP address, browser details, voice or image. No cookies are used. The site is served through a hosting service that technically sees your IP address to connect you, but we do not store it.',
        ],
      },
      {
        id: 'do-not-track',
        h2: '"Do Not Track"',
        paragraphs: ['If "Do Not Track" is on in your browser, no usage counts are sent. The site works just the same.'],
      },
      {
        id: 'write-to-us',
        h2: 'The "write to us" form',
        paragraphs: [
          'The text you send and, if you choose, a way to contact you are kept; I read them only to reply and to improve the site. New messages also reach me as a notification through a messaging app.',
          'To limit abuse of the form, a short digest derived from your IP address is kept. It cannot be turned back into the IP address and changes every day, so it cannot be used to link you across days.',
        ],
      },
      {
        id: 'in-your-browser',
        h2: 'What stays in your browser only',
        paragraphs: [
          'Your settings (timer lengths, sound, hiding the clock), the topics you have already seen (so they do not repeat), the field you picked in research mode and your practice streak (which days you spoke). These stay in this browser and are never sent to us. Clearing the site’s data in your browser removes them.',
          'If you turn on "record yourself", the camera and/or screen recording is kept only on your device; it is never sent anywhere and is deleted once you leave the page.',
        ],
      },
      {
        id: 'sharing',
        h2: 'Sharing',
        paragraphs: [
          'Share buttons open the app you pick, with the text to share, only when you tap them. Nothing is sent anywhere unless you tap.',
        ],
      },
      {
        id: 'contact',
        h2: 'Questions or deletion requests',
        paragraphs: ['If you want a message you sent deleted, or something seems wrong, just use the "write to us" form.'],
      },
    ],
    back: 'back to the home page',
  },
};
