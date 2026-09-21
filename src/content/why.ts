import type { Locale } from '../i18n';

export interface WhyContent {
  /** URL path of this page for the locale. */
  path: string;
  meta: { title: string; description: string };
  eyebrow: string;
  h1: string;
  lead: string;
  sections: { id: string; h2: string; paragraphs: string[] }[];
  steps: { h2: string; intro: string; items: { title: string; text: string }[] };
  faq: { h2: string; items: { q: string; a: string }[] };
  cta: { text: string; button: string };
  byline: string;
  updated: string;
}

export const why: Record<Locale, WhyContent> = {
  tr: {
    path: '/neden/',
    meta: {
      title: 'İrticalen’i neden yaptım? Kaydırmaya karşı bir dakikalık konuşma',
      description:
        'Brainrot, dağınık dikkat ve “aklımdakini anlatamıyorum” hissine karşı basit bir antrenman: rastgele bir konu, bir dakika, yüksek sesle konuşmak. İrticalen’in neden var olduğunu ve nasıl kullanılacağını anlatıyorum.',
    },
    eyebrow: 'Neden var?',
    h1: 'İrticalen’i neden yaptım?',
    lead: 'Çünkü bir gün fark ettim ki saatlerce içerik tüketiyorum ama biri “ne düşünüyorsun?” diye sorduğunda iki düzgün cümle kuramıyorum. Bu site, o iki cümleyi geri kazanmak için yaptığım küçük bir alet.',
    sections: [
      {
        id: 'sorun',
        h2: 'Sorun bilgi eksikliği değil, akış',
        paragraphs: [
          'Telefonu elimize aldığımızda bir şey seçmiyoruz; bir akışa giriyoruz. On beş saniyelik videolar, başlıklar, bildirimler. Her biri bir öncekini siliyor. Günün sonunda yüzlerce şey görmüş ama hiçbirini düşünmemiş oluyoruz.',
          'İngilizcede buna “brain rot” deniyor; Oxford 2024’te yılın kelimesi seçti. Türkçede de “brainrot” diye yerleşti. Tıbbi bir teşhis değil, herkesin tanıdığı bir his: dikkatin parçalanması, bir konuda kalamamak, bir sayfayı bitirememek, konuşurken cümlenin ortasında kaybolmak.',
          'Bence işin en sinsi tarafı şu: tüketirken kendimizi bilgili hissediyoruz. O konuda üç video izledik ya. Ama anlatmaya kalkınca ortaya bir şey çıkmıyor, çünkü izlemek ile düşünmek aynı şey değil.',
        ],
      },
      {
        id: 'konusmak',
        h2: 'Konuşmak, düşünmenin sınavıdır',
        paragraphs: [
          'Bir şeyi gerçekten anlayıp anlamadığını öğrenmenin en hızlı yolu, onu yüksek sesle birine anlatmaya çalışmak. Kafanın içinde net görünen fikir, ağzından çıkarken dağılıyorsa, aslında net değilmiş.',
          'Hazırlıksız konuşmak bu sınavın en çıplak hali. Not yok, arama motoru yok, “bir dakika bakayım” yok. Sadece sen, bir konu ve geçen saniyeler. O bir dakikada beynin, akışta hiç yapmadığı bir şeyi yapmak zorunda: tek bir konuda kalmak, bir fikir seçmek, onu sıraya koymak ve bitirmek.',
          'Eskiler buna “irticalen konuşmak” derdi. Kürsüye kâğıtsız çıkıp derdini anlatabilmek bir meziyetti. Bugün kürsüye çıkan az, ama aynı beceri toplantıda, mülakatta, sofrada, bir arkadaşına derdini anlatırken lazım.',
        ],
      },
      {
        id: 'bir-dakika',
        h2: 'Neden sadece bir dakika?',
        paragraphs: [
          'Çünkü büyük sözler tutmuyor. “Artık her gün bir saat kitap okuyacağım” diyen herkes ikinci hafta bırakıyor. Bir dakika ise bahane bırakmıyor: çay demlenirken, asansör beklerken, bilgisayar açılırken yapılır.',
          'Bir dakika aynı zamanda dürüst bir süre. Konuşmaya başlayınca ne kadar uzun olduğunu görürsün. İlk denemede çoğu insan yirminci saniyede susuyor. Bu utanılacak bir şey değil; ölçüm. Bir hafta sonra kırkıncı saniyeye gelirsin.',
        ],
      },
      {
        id: 'ne-degil',
        h2: 'Bu site ne değil',
        paragraphs: [
          'Bir kurs değil, bir yapay zekâ koçu değil, seni puanlayan bir uygulama değil. Sesini kaydetmiyor, hesap açtırmıyor, bildirim göndermiyor, reklam göstermiyor. Dikkatini geri kazanmana yardım etmeye çalışan bir şeyin dikkatini çalmaya uğraşması tuhaf olurdu.',
          'Açarsın, çevirirsin, konuşursun, kapatırsın. Hepsi bu. Kodu açık; isteyen bakabilir, isteyen konu önerebilir.',
        ],
      },
    ],
    steps: {
      h2: 'Nasıl kullanmalı?',
      intro: 'Kural yok, ama bende işe yarayan düzen bu:',
      items: [
        { title: 'Yüksek sesle konuş.', text: 'İçinden geçirmek sayılmaz. Kulağın kendi cümleni duymalı; boşluklar ancak o zaman ortaya çıkar.' },
        { title: 'Konuyu beğenmesen de değiştirme.', text: 'Hayat da konu seçtirmiyor. “Bu konuda söyleyecek bir şeyim yok” dediğin an, antrenmanın başladığı an.' },
        { title: 'Takılınca üç soruya dön.', text: 'Nedir? Neden önemli? Ne yapmalı? Ekranda yazıyor. Bu üçü, hemen her konuda bir dakikalık iskelet kurar.' },
        { title: 'Haftada bir Araştırmalı modu dene.', text: 'On dakika oku, sonra anlat. Okuduğunu bir dakikaya sığdırmak, en iyi özet çıkarma alıştırması.' },
        { title: 'Her gün bir tur.', text: 'Uzun seanslar değil, tekrar işe yarıyor. Günde bir dakika, ayda otuz farklı konuda düşünmüş olmak demek.' },
      ],
    },
    faq: {
      h2: 'Sık sorulanlar',
      items: [
        { q: 'İrticalen ne demek?', a: '“İrticalen”, Arapça irticâl kökünden gelen eski bir Türkçe zarftır; hazırlık yapmadan, o anda içine doğduğu gibi, doğaçlama olarak demektir. “İrticalen konuşmak” hazırlıksız konuşmak anlamına gelir.' },
        { q: 'Brainrot nedir?', a: 'Brainrot (brain rot), sürekli kısa ve değersiz içerik tüketmenin dikkati ve düşünme alışkanlığını köreltmesi hissini anlatan gündelik bir terimdir. Tıbbi bir teşhis değildir. Oxford University Press, “brain rot”u 2024’te yılın kelimesi seçti.' },
        { q: 'Hazırlıksız konuşma nasıl geliştirilir?', a: 'Düzenli ve kısa tekrarla: rastgele bir konu seç, süre tut, yüksek sesle konuş. Takıldığında basit bir iskelet kullan: Nedir? Neden önemli? Ne yapmalı? Günde bir dakika, haftada bir uzun seanstan daha çok işe yarar.' },
        { q: 'İrticalen ücretli mi, üyelik gerekiyor mu?', a: 'Hayır. İrticalen ücretsizdir, üyelik istemez, ses kaydı almaz, çerez ve izleme kullanmaz. Ayarların yalnızca kendi tarayıcında saklanır. Kaynak kodu GitHub’da açıktır.' },
        { q: 'Günde ne kadar pratik yapmalıyım?', a: 'Bir dakikalık tek bir tur yeterli bir başlangıçtır. Önemli olan süre değil, her gün yapılmasıdır. Rahatlayınca süreyi ayarlardan 10 dakikaya kadar uzatabilirsin.' },
        { q: 'Kimler için uygun?', a: 'Toplantıda söz alınca tutulanlar, mülakata hazırlananlar, sunum yapanlar, öğrenciler, yabancı dilde akıcılık çalışanlar ve genel olarak “aklımdakini anlatamıyorum” diyen herkes için.' },
      ],
    },
    cta: { text: 'Okumak da bir çeşit kaydırma. Şimdi bir dakikanı ver.', button: 'Bir konu çevir' },
    byline: 'Yazan: Yasin Özmen',
    updated: '2026-09-21',
  },
  en: {
    path: '/en/why/',
    meta: {
      title: 'Why I built İrticalen: one minute of speaking against the scroll',
      description:
        'A simple drill against brain rot, scattered attention and the feeling of “I can’t put it into words”: a random topic, one minute, speaking out loud. Why İrticalen exists and how to use it.',
    },
    eyebrow: 'Why it exists',
    h1: 'Why I built İrticalen',
    lead: 'Because one day I noticed that I consume content for hours, yet when someone asks “so what do you think?” I can’t produce two decent sentences. This site is a small tool for winning those two sentences back.',
    sections: [
      {
        id: 'problem',
        h2: 'The problem is not a lack of information. It’s the feed.',
        paragraphs: [
          'When we pick up the phone we don’t choose something; we enter a stream. Fifteen-second videos, headlines, notifications. Each one erases the one before. By the end of the day we have seen hundreds of things and thought about none of them.',
          'People call it “brain rot”; Oxford named it Word of the Year in 2024. It is not a medical diagnosis, just a feeling everyone recognises: attention in pieces, being unable to stay with one subject, to finish a page, losing the thread halfway through your own sentence.',
          'The sneaky part is that consuming makes us feel informed. We watched three videos about it, after all. But when we try to explain it, nothing comes out, because watching and thinking are not the same activity.',
        ],
      },
      {
        id: 'speaking',
        h2: 'Speaking is the exam for thinking',
        paragraphs: [
          'The fastest way to find out whether you understand something is to try explaining it out loud. If the idea that looked clear in your head falls apart on the way out, it was never clear.',
          'Speaking without preparation is that exam at its barest. No notes, no search engine, no “let me check”. Just you, a topic and the seconds passing. For that one minute your brain has to do what the feed never asks of it: stay on one subject, pick an idea, put it in order and finish it.',
          'Turkish has an old word for this: “irticalen”, to speak extemporaneously. Few of us stand at a lectern today, but the same skill is needed in a meeting, in an interview, at a dinner table, or when telling a friend what is actually wrong.',
        ],
      },
      {
        id: 'one-minute',
        h2: 'Why only one minute?',
        paragraphs: [
          'Because big promises don’t last. Everyone who says “I’ll read for an hour every day” quits in week two. One minute leaves no excuse: while the tea brews, while the lift arrives, while the laptop boots.',
          'One minute is also an honest length. Once you start talking you discover how long it is. On a first try most people go quiet around second twenty. That is not embarrassing; it is a measurement. A week later you reach forty.',
        ],
      },
      {
        id: 'what-it-is-not',
        h2: 'What this site is not',
        paragraphs: [
          'Not a course, not an AI coach, not an app that scores you. It does not record your voice, ask for an account, send notifications or show ads. It would be odd for something that tries to give your attention back to compete for it.',
          'You open it, draw a topic, speak, close it. That is all. The code is open; anyone can read it or suggest topics.',
        ],
      },
    ],
    steps: {
      h2: 'How to use it',
      intro: 'There are no rules, but this is the routine that works for me:',
      items: [
        { title: 'Speak out loud.', text: 'Thinking it through silently does not count. Your ear has to hear your own sentence; only then do the gaps show.' },
        { title: 'Don’t swap a topic you dislike.', text: 'Life does not let you pick topics either. The moment you think “I have nothing to say about this” is the moment the training starts.' },
        { title: 'When you stall, go back to three questions.', text: 'What? So what? Now what? They are on the screen, and they build a one-minute skeleton for almost any subject.' },
        { title: 'Try Researched mode once a week.', text: 'Read for ten minutes, then explain. Fitting what you read into one minute is the best summarising exercise there is.' },
        { title: 'One round every day.', text: 'Repetition works, long sessions don’t. A minute a day means having thought about thirty different subjects in a month.' },
      ],
    },
    faq: {
      h2: 'Frequently asked',
      items: [
        { q: 'What does “irticalen” mean?', a: '“İrticalen” is an old Turkish adverb from the Arabic irtijāl. It means without preparation, on the spot, extemporaneously. “İrticalen konuşmak” means to speak impromptu.' },
        { q: 'What is brain rot?', a: 'Brain rot is an informal term for the feeling that constantly consuming short, low-value content dulls attention and the habit of thinking. It is not a medical diagnosis. Oxford University Press chose “brain rot” as its Word of the Year for 2024.' },
        { q: 'How do you get better at impromptu speaking?', a: 'With short, regular repetition: draw a random topic, set a timer and speak out loud. When you stall, use a simple skeleton: What? So what? Now what? One minute a day beats one long session a week.' },
        { q: 'Is İrticalen free? Do I need an account?', a: 'It is free, needs no account, records nothing and uses no cookies or tracking. Your settings stay in your own browser. The source code is open on GitHub.' },
        { q: 'How much should I practise per day?', a: 'A single one-minute round is a good start. What matters is doing it daily, not the length. You can extend the timer up to 10 minutes in settings.' },
        { q: 'Who is it for?', a: 'Anyone who freezes when a meeting turns to them, people preparing for interviews or presentations, students, language learners working on fluency, and anyone who feels “I can’t put what’s in my head into words”.' },
      ],
    },
    cta: { text: 'Reading is a kind of scrolling too. Now give it one minute.', button: 'Spin a topic' },
    byline: 'By Yasin Özmen',
    updated: '2026-09-21',
  },
};
