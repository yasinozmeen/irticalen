/** Konuşma modu: hazırlıksız (off-the-cuff) ya da araştırmalı (deep-research). */
export type Mode = 'off-the-cuff' | 'deep-research';

/** Oturumun anlık aşaması. */
export type Phase = 'idle' | 'research' | 'ready' | 'speech' | 'done';

/** Arayüz dili. */
export type Locale = 'tr' | 'en';

/** Konu kategorisi (yalnız hazırlıksız modda seçilebilir). */
export interface Category {
  id: string;
  label: string;
  emoji: string;
  topics: string[];
}

/** Kullanıcı ayarları (kalıcı). */
export interface Settings {
  speechSec: number;
  researchSec: number;
  muted: boolean;
}
