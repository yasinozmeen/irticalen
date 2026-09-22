import { useEffect, useRef, useState } from 'preact/hooks';
import { xIntentUrl, whatsappUrl } from '../lib/share';
import type { Dictionary } from '../i18n';

export type ShareChannel = 'x' | 'whatsapp' | 'copy_link' | 'copy_image' | 'download_image' | 'native' | 'youtube';

interface Props {
  dict: Dictionary;
  imageUrl: string;
  text: string;
  url: string;
  /** Ask + skill link + session block for an AI agent that prepares the YouTube upload. */
  youtubePrompt: string;
  onBack: () => void;
  onTrack: (channel: ShareChannel) => void;
}

function clipboardImageSupported(): boolean {
  try {
    return typeof ClipboardItem !== 'undefined' && typeof navigator?.clipboard?.write === 'function';
  } catch {
    return false;
  }
}

/**
 * Our own share panel — replaces the timer overlay's content in place (same dialog, same focus
 * trap root) instead of calling `navigator.share` directly. See docs SPEC part B.
 */
export function SharePanel({ dict, imageUrl, text, url, youtubePrompt, onBack, onTrack }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');
  const [youtubeState, setYoutubeState] = useState<'idle' | 'done' | 'failed'>('idle');
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imageCopySupported] = useState(clipboardImageSupported);
  const [nativeSupported] = useState(() => {
    try {
      return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    } catch {
      return false;
    }
  });

  const mountedRef = useRef(true);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // The panel replaces the button that opened it, so focus would otherwise drop to <body>.
  useEffect(() => {
    primaryRef.current?.focus();
    return () => {
      mountedRef.current = false;
      if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleX = (): void => {
    onTrack('x');
    try {
      window.open(xIntentUrl(text, url), '_blank', 'noopener');
    } catch {
      // best-effort
    }
  };

  const handleWhatsapp = (): void => {
    onTrack('whatsapp');
    try {
      window.open(whatsappUrl(text, url), '_blank', 'noopener');
    } catch {
      // best-effort
    }
  };

  const handleCopyLink = async (): Promise<void> => {
    onTrack('copy_link');
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      if (!mountedRef.current) return;
      setCopyState('done');
    } catch {
      if (!mountedRef.current) return;
      setCopyState('failed');
    }
    if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setCopyState('idle');
    }, 2500);
  };

  // Stays "copied" (with the one-line hint) — the visitor now switches to their agent and back.
  const handleYoutube = async (): Promise<void> => {
    onTrack('youtube');
    try {
      await navigator.clipboard.writeText(youtubePrompt);
      if (mountedRef.current) setYoutubeState('done');
    } catch {
      if (mountedRef.current) setYoutubeState('failed');
    }
  };

  const downloadImage = (): void => {
    onTrack('download_image');
    try {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      // best-effort
    }
  };

  const handleImageAction = async (): Promise<void> => {
    if (!imageCopySupported) {
      downloadImage();
      return;
    }
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      onTrack('copy_image');
    } catch {
      downloadImage();
    }
  };

  const handleNative = (): void => {
    onTrack('native');
    try {
      navigator.share({ text, url }).catch(() => {
        // user cancelled — nothing to do
      });
    } catch {
      // ignore
    }
  };

  return (
    <div class="share-panel">
      <img class="share-panel-image" src={imageUrl} width={520} height={273} alt={dict.share.imageAlt} loading="eager" />
      <p class="share-panel-text">{text}</p>

      <div class="share-panel-actions">
        <button ref={primaryRef} type="button" class="btn btn-primary" onClick={handleX}>
          {dict.share.x}
        </button>
        <button type="button" class="btn btn-secondary" onClick={handleWhatsapp}>
          {dict.share.whatsapp}
        </button>
        <button type="button" class="btn btn-secondary" onClick={() => void handleYoutube()}>
          {youtubeState === 'done' ? dict.share.youtubeDone : youtubeState === 'failed' ? dict.share.copyLinkFailed : dict.share.youtube}
        </button>
        <button type="button" class="btn btn-secondary" onClick={() => void handleCopyLink()}>
          {copyState === 'done' ? dict.share.copyLinkDone : copyState === 'failed' ? dict.share.copyLinkFailed : dict.share.copyLink}
        </button>
        <button type="button" class="btn btn-secondary" onClick={() => void handleImageAction()}>
          {imageCopySupported ? dict.share.copyImage : dict.share.downloadImage}
        </button>
        {nativeSupported && (
          <button type="button" class="btn btn-secondary" onClick={handleNative}>
            {dict.share.more}
          </button>
        )}
        <button type="button" class="btn btn-secondary share-panel-back" onClick={onBack}>
          {dict.share.back}
        </button>
      </div>

      {youtubeState === 'done' && <p class="share-panel-hint timer-rise">{dict.share.youtubeHint}</p>}

      <p class="sr-only" aria-live="polite">
        {youtubeState === 'done' ? dict.share.youtubeDone : youtubeState === 'failed' ? dict.share.copyLinkFailed : ''}
      </p>
      <p class="sr-only" aria-live="polite">
        {copyState === 'done' ? dict.share.copyLinkDone : copyState === 'failed' ? dict.share.copyLinkFailed : ''}
      </p>
    </div>
  );
}

