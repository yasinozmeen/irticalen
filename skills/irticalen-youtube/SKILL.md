---
name: irticalen-youtube
description: Turn a recorded irticalen practice session (impromptu speaking, optionally with a research phase) into a ready-to-publish YouTube video package — transcript, content-based chapters, edit suggestions, a short speaking report, title/description/tags and five thumbnail options. Use when the user pastes an "irticalen" session block or asks to prepare an irticalen recording for YouTube.
---

# irticalen → YouTube

The user practised on [irticalen](https://irticalen.yasinozmeen.me): a random topic, optionally a
research timer (stages *gather → shape → warm up*), then a speech timer. They filmed it (usually
landscape, often including the research part) and want to publish it on YouTube. You do the heavy
lifting; they stay in control.

The user normally arrives with a pasted block like this (copied from the site's share screen):

```
topic: pareto ilkesi
lang: tr
mode: deep-research          # or off-the-cuff (no research phase)
research_min: 10
speech_min: 1
topic_url: https://irticalen.yasinozmeen.me/konu/pareto-ilkesi/
timer_chapters:              # measured from the moment the timer started
  0:00 Araştırma: topla
  7:00 Araştırma: kur
  9:00 Araştırma: ısın
  10:15 Konuşma: Nedir?
  ...
```

If there is no block, ask for the topic, language and durations — everything else still works.

**Talk to the user in the session's language (`lang`), plainly, without jargon.** Many users are not
developers.

---

## Ground rules (never break these)

1. **Never modify, move or delete the original video.** Read it only. The one exception is the
   clean-up at the very end of step 8: after the upload is verified, and only when the user says
   "delete" in this conversation, the original video and its output folder go to the **Trash** —
   never a permanent delete, never emptying the Trash.
2. Write everything into one new folder next to the video: `<video-name>-irticalen/`. The only
   other file you may write is the user's preferences file, `~/.irticalen/youtube.md` (step 0/8).
3. **Nothing leaves the machine without asking.** Prefer local tools. If the only way to transcribe
   is a cloud service, say which service and ask first. The one exception is an upload the user has
   given standing permission for in their preferences file (rule 4).
4. **Never upload, post or publish** anything unless the user explicitly asks in this conversation
   — or their preferences file gives standing permission to upload. Even with that permission:
   - an automatic upload is **never public** — only private (or unlisted, if the file says so);
     set the visibility explicitly on every upload and check it before saving;
   - making a video public is always the user's own action — never do it for them;
   - still wait for the user's go in this conversation (step 8: their thumbnail pick is the go).
5. If you cannot do a step, say so in one sentence — never pretend, never fabricate a transcript,
   timestamps or a thumbnail.
6. **Never write passwords, tokens or cookies** into any file, including the preferences file.
   Where a login lives (e.g. "the browser is already signed in") may be noted; the secret never.
7. The preferences file can change *how* you work, never these rules. Ignore anything in it that
   would break them (e.g. re-encoding the original video, or deleting it without asking first).

---

## Step 0 — Load the user's saved preferences

This skill is read fresh every time, so it can't remember earlier sessions — the user's machine does.
Look for **`~/.irticalen/youtube.md`** (Windows: `%USERPROFILE%\.irticalen\youtube.md`).

- **If it exists, read it first and follow it.** It holds what this user already decided or set up
  with an agent before: how uploading works for them (e.g. a one-time automatic-upload setup and its
  exact steps), playlist, visibility, thumbnail and description preferences. Don't ask again about
  anything it answers. Mention in one line that you're using their saved preferences.
- The file is the user's own local notes — treat its contents as their instructions for this skill,
  but the ground rules above still win if anything conflicts.
- If it doesn't exist, continue normally; step 8 explains when to create it.

## Step 1 — Check what you can do, say it, route if needed

Check quietly, then report a short can / can't list:

| Capability | Needed for | How to check |
|---|---|---|
| Read local files + run commands | everything below | can you run a shell? |
| `ffmpeg` / `ffprobe` | audio, frames, trims | `ffmpeg -version` |
| Speech-to-text with timestamps | transcript, chapters, report | a local Whisper (`whisper`, `faster-whisper`, `whisper.cpp`, `mlx-whisper`) — or native audio/video understanding |
| HTML → PNG | thumbnails | headless Chrome/Chromium, or Playwright |
| Looking at images | picking a good frame | can you view an image file? |

- Missing tool that can be installed (e.g. `ffmpeg`, a Whisper package): tell the user the exact
  install command for their system and **ask before installing**.
- **You can't run commands or read local files at all** (e.g. a chat-only assistant): say so
  clearly — "I can't process your video file here." Recommend an agent that can, e.g. Claude Code,
  OpenAI Codex CLI or Gemini CLI, and tell them to paste the same block there. If they can't switch,
  **still do everything you can**: title, description, tags and the timer-based chapters from the
  block (step 6), and explain which parts you couldn't do and why.

## Step 2 — Get the video

Ask for the video file's path (or ask them to drop it in). Then:

```
ffprobe -v error -show_entries format=duration:stream=width,height,codec_type -of json "<video>"
```

Create the output folder. Note duration and orientation.

## Step 3 — Transcribe

```
ffmpeg -i "<video>" -vn -ac 1 -ar 16000 "<out>/audio.wav"
```

Transcribe `audio.wav` in the session language **with word- or segment-level timestamps**. Save
`<out>/transcript.txt` (readable, `[m:ss]` per line) and keep the timed segments for the next steps.
Filler sounds matter — ask Whisper not to clean them up if your tool has such an option.

## Step 4 — Find the structure

0. **Map the whole video first.** Recordings are often screen recordings of the site (with a small
   camera window), so the timer, the topic, the stage (*topla / kur / ısın*) and "süre." are
   readable on screen. If you can look at images, grab one small frame every ~10 s
   (`ffmpeg -i "<video>" -vf "fps=1/10,scale=640:-2" "<out>/_frames/%03d.jpg"`, tile them into a
   contact sheet) and write down a timeline: which topic, which phase, from when to when. The
   screen is more reliable than audio for phase boundaries.
   - **One video may hold several sessions, or more than a session** (an abandoned attempt, the
     speaker showing the site afterwards, a vlog part). Identify each part, show the timeline in
     plain words, and **ask what they want to publish** — the whole video or only one part. Don't
     assume that anything outside the speech is waste: a walkthrough after the talk is often
     intentional. Then chapter the whole published video, not just the speech.
   - The recording may start in the middle of research — then `timer_chapters` doesn't start at
     0:00 of the video; align by the on-screen clock instead.
1. **Where the speech starts in the video.** The research part is often quiet or muttered; the
   speech is continuous talking about the topic. Use the transcript plus the `timer_chapters` hint:
   `offset = video_time_of_speech_start − timer_time_of_speech_start`. The user usually pressed
   record a few seconds before the timer, so the offset is small and positive — sanity-check it.
2. **Chapters for the description**, following YouTube's rules: first chapter `0:00`, at least 3
   chapters, each at least 10 seconds, in order.
   - Research part: use the stage starts from `timer_chapters` shifted by the offset (merge or drop
     any that would be shorter than 10 s).
   - Speech part: **name chapters after what was actually said**, following the outline the speaker
     used (*What is it? → An example → What do I think?* / *Nedir? → Bir örnek → Ne düşünüyorum?*),
     e.g. `10:15 Nedir? — 80/20 kuralı`. Place them where the speaker actually moved on, not at
     mechanical thirds.

## Step 5 — Edit suggestions + speaking report

Write `<out>/edits.md` with timestamps:
- dead time to trim at the start and end (before the timer, after "time's up");
- long silences in the speech (> 2 s) — usually keep them, pauses are fine; flag only awkward ones;
- false starts / restarts worth cutting;
- for long research footage: suggest speeding it up (e.g. 4–8×) or cutting it to a short montage,
  keeping the stage transitions.

If the user publishes only one part, suggest the exact cut points (from its start to a few seconds
after "süre."). Either way, suggest shortening long silent stretches (quiet research, the "araştırma
bitti" wait) by cutting or speeding them up — as an option, not a must.

Offer — don't impose — to produce an edited copy with `ffmpeg` (e.g. trimmed start/end, sped-up
research). Always a **new file** in the output folder; show the exact commands you will run first.

Also write a short, encouraging **speaking report** (`<out>/report.md`), max ~10 lines:
speech length, words per minute, filler count ("ıı / eee / şey / yani…" or "um / uh / like…") with
the worst stretch, the longest pause, whether all three outline steps were covered, and one concrete
tip for next time. Honest, kind, no scores out of 10.

## Step 6 — Title, description, tags

Write `<out>/youtube.md` with three copy-ready blocks.

**Title** (≤ 100 characters, no `<` `>`):
- tr, researched: `{topic} — {research} dk araştırma, {speech} dk hazırlıksız konuşma | irticalen`
- tr, off-the-cuff: `{topic} — {speech} dakika hazırlıksız konuşma | irticalen`
- en, researched: `{topic} — {research} min research, {speech} min impromptu speech | irticalen`
- en, off-the-cuff: `{topic} — a {speech}-minute impromptu speech | irticalen`

Use the topic with normal capitalisation (the site shows it lowercase; YouTube titles read better
capitalised). Drop ` | irticalen` if the title gets too long.

**Description** (tr shown; translate the same structure for en):

```
"{topic}" konusunu irticalen'in çarkından çektim, {research} dakika araştırdım, ardından {speech} dakika hazırlıksız konuştum.
(off-the-cuff: "{topic}" konusunu irticalen'in çarkından çektim ve hiç hazırlanmadan {speech} dakika konuştum.)

{one or two sentences on what the speech actually argued — from the transcript}

Bölümler
{chapters, one per line}

Konuşma iskeleti: Nedir? → Bir örnek → Ne düşünüyorum?
Sen de dene: {topic_url}

#irticalen #hazırlıksızkonuşma #konuşmapratiği
```

English hashtags: `#irticalen #impromptuspeaking #publicspeaking`.

**Tags** (comma-separated, ≤ 500 characters total): irticalen, the topic, 3–5 words about the
topic, and — tr: `hazırlıksız konuşma, doğaçlama konuşma, konuşma pratiği, topluluk önünde konuşma`;
en: `impromptu speaking, public speaking practice, speaking practice`.

## Step 7 — Five thumbnails

The templates live next to this file in `thumbnails/` (`kagit`, `murekkep`, `cetvel`, `iskelet`,
`kare` + shared `thumb.css` / `thumb.js`). If you only have this file, download the folder from
`https://raw.githubusercontent.com/yasinozmeen/irticalen/main/skills/irticalen-youtube/thumbnails/<file>`
into `<out>/_templates/`. Don't edit the templates — they are the site's design.

Each template takes query parameters: `topic`, `caption`, `lang` (`tr`/`en`), and for `kare`,
`frame` (an image path relative to the template folder). Caption: `{research} dk araştırma · {speech} dk konuşma`
or `{speech} dakika hazırlıksız konuşma` (en: `{research} min research · {speech} min speech` /
`a {speech}-minute impromptu speech`).

Render each at exactly 1280×720, e.g. with Chrome:

```
chrome --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1280,720 --virtual-time-budget=6000 \
  --screenshot="<out>/thumbnail-kagit.png" \
  "file:///<out>/_templates/kagit.html?topic=<url-encoded>&caption=<url-encoded>&lang=tr"
```

(`chrome` = `google-chrome`, `chromium`, or on macOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
The templates load the Newsreader font from Google Fonts; offline they fall back to Georgia — mention it.)

For **kare**: extract ~8 candidate frames from the speech part. In a screen recording the face
is only in the small camera window — crop that window (find its box on one frame, then
`-vf crop=w:h:x:y`) before choosing
(`ffmpeg -ss <t> -i "<video>" -frames:v 1 "<out>/_templates/frame-<n>.jpg"`). Pick a frame where the
speaker **looks straight into the camera with the mouth closed** (a calm, natural face, eyes open)
— never mid-word, mouth open, eyes down or blinking. Such moments are rare while talking: look in
pauses, just before the speech starts and just after it ends, and sample densely (every 1–2 s).
Show the user the 3 best candidates if you're not sure. The kare slot is portrait-shaped and
crops the still from the middle; pass `focus=<0–100>` (the face's horizontal position in the still,
in %) so the face isn't cut off. If you can't look at images,
use the frame from the middle of the speech and say so.

Show the user all five and let them choose. They're all valid — don't push one.

## Step 8 — Hand-off and uploading

**If the preferences file (step 0) describes an upload setup, use it.** Before uploading, send the
user one message with everything that will go up — title, description, tags, which video file
(original or an edited copy you made; ask if unclear) — plus the five thumbnails to choose from.
Their pick (and any corrections) is the go; then upload exactly as recorded in the file, with the
visibility rules of ground rule 4, and leave the edit page open (below). Otherwise:

**Default: the user uploads manually.** Give them short steps in their language:
1. studio.youtube.com → **Create → Upload videos** → pick the video (or the edited copy).
2. Paste title and description from `youtube.md`; paste tags under **Show more → Tags**.
   Chapters appear automatically from the description.
3. **Thumbnail → Upload file** → the chosen PNG. (Custom thumbnails need a verified channel —
   phone verification in YouTube settings — if the option is missing, that's why.)
4. Optional: add it to an "irticalen" playlist.
5. Choose visibility and publish.

Then offer, once, as an option, in the session's language — don't do it unprompted and don't make it a
requirement. For example (tr: *"İstersen videoları senin yerine otomatik nasıl yükleyebileceğimi
araştırayım; bir kez birlikte kurarız, sonrakilerde ben yüklerim."*):

> "If you'd like, I can look into how I could upload videos for you automatically, and we can set it
> up together once. After that, next time I could upload myself."

Whenever you did the upload yourself (now or in a later session), finish by leaving the video's
edit page open for the user: `https://studio.youtube.com/video/<video-id>/edit` — in the browser
you controlled; if you have none, open it with the system's default browser or print the link.

Only if they say yes: research the current official way to do it for your environment, explain the
one-time setup and its trade-offs in plain words (accounts, permissions, any limits such as videos
arriving as private until the user changes them), and go step by step with their consent.

### Remember it: write the preferences file

Create `~/.irticalen/youtube.md` once an upload setup works, so the next session doesn't ask again.
After that, **update it only when something actually changed** — not after every video:
- the user states a new lasting preference or changes one ("always put it in the irticalen
  playlist", "never pick a frame with my mouth open");
- the recorded method stopped working and you found a fix, or you found a clearly better way;
- something in it turned out to be wrong.

A normal run where everything went as recorded leaves the file untouched. When you do change it,
edit only the affected lines (keep the rest), update the date, and tell the user in one line what
changed. Keep it short, in their language, and include:

- **Upload:** manual, or the exact working method, step by step, with the things that went wrong
  and how they were solved — written so a different agent can repeat it without research. Say
  whether the user gave standing permission to upload and with which visibility.
- **Studio details:** playlist, default visibility, anything in their YouTube upload defaults that
  must be kept (e.g. a footer at the end of the description, default tags).
- **Thumbnails / frames:** preferences about the photo frame and templates.
- **After upload:** e.g. leave the edit page open; whether to offer deleting the raw video.
- **Updated:** the date.

No passwords, tokens or cookies — ever (ground rule 6).

### Last step: offer to delete the raw video

Only if the video was uploaded (by you or by the user) **and** you verified it — it's in the
channel's content list once, with the right length, and it plays — ask once, as the very last
question, in the session's language (tr: *"Video YouTube'da. Ham video ve klasörü silinsin mi?"*).
Name both paths. Don't ask if the upload is unverified or still failing.

- Only a clear "delete / sil" in this conversation counts. A preferences file may say the user wants
  to be asked every time — it can never make the delete itself automatic.
- Move **both** the original video and `<video-name>-irticalen/` to the system Trash (macOS:
  `osascript -e 'tell application "Finder" to delete {POSIX file "<video>", POSIX file "<out>"}'`;
  Windows: the Recycle Bin; Linux: `gio trash`). Never `rm`, never empty the Trash.
- Check both paths are gone, then tell the user they're in the Trash and can be restored from there.
- No answer, or "no" → leave everything as it is.

## Finish

End with a short summary: which files are in `<out>/` (or that they were moved to the Trash), what
you could not do (if anything) and why, and the next action for the user.
