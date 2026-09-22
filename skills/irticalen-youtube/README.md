# irticalen → YouTube skill

irticalen'de konuşurken kendini çektiysen, bu skill videonu YouTube'a hazırlar.

1. Konuşma bitince paylaş ekranında **YouTube için kopyala**'ya bas.
2. Kopyalanan metni dosyalarına erişebilen bir AI ajanına yapıştır (Claude Code, Codex CLI, Gemini CLI…).
3. Ajan videonun yerini sorar; sonra yazıya döker, bölümleri bulur, düzenleme önerir, kısa bir
   konuşma karnesi yazar, başlık/açıklama/etiket hazırlar ve beş küçük resim üretir.
4. Yüklemeyi varsayılan olarak sen yaparsın; ajan adımları söyler. İstersen otomatik yüklemeyi
   birlikte kurmayı önerir.

Orijinal videona dokunulmaz; her şey videonun yanında yeni bir klasöre yazılır.

Küçük resim şablonları: [`thumbnails/`](thumbnails/) (`kagit`, `murekkep`, `cetvel`, `iskelet`, `kare`).

---

**EN** — Filmed your irticalen talk? Tap **copy for YouTube** on the share screen, paste it to an AI
agent that can read your files, and it prepares transcript, chapters, edit suggestions, a short
speaking report, title/description/tags and five thumbnails. Your original video is never touched.
Instructions for the agent: [`SKILL.md`](SKILL.md).
