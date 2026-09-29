import { useEffect, useState } from 'preact/hooks';
import { clearRecLog, onRecLog, recDebugEnabled, recLog, recLogLines, recLogText } from '../lib/recDebug';

/**
 * GEÇİCİ (2026-09-29): `?kayitlog=1` iken ekranın altında canlı kayıt günlüğü + "günlüğü indir".
 * Telefonda kaydın donmasını anlamak için; sorun çözülünce `recDebug.ts` ile birlikte silinecek.
 */
export function RecDebugPanel() {
  const [, setVersion] = useState(0);
  const [open, setOpen] = useState(true);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!recDebugEnabled()) return;
    recLog('günlük açık — sayfa yüklendi');
    return onRecLog(() => setVersion((v) => v + 1));
  }, []);

  if (!recDebugEnabled()) return null;

  const download = (): void => {
    if (url) URL.revokeObjectURL(url);
    const next = URL.createObjectURL(new Blob([recLogText()], { type: 'text/plain;charset=utf-8' }));
    setUrl(next);
    const a = document.createElement('a');
    a.href = next;
    a.download = `irticalen-kayit-gunlugu-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const lines = recLogLines();
  return (
    <div class="rec-debug" role="log" aria-label="kayıt günlüğü">
      <div class="rec-debug-bar">
        <strong>kayıt günlüğü · {lines.length} satır</strong>
        <button type="button" onClick={download}>günlüğü indir</button>
        <button type="button" onClick={clearRecLog}>temizle</button>
        <button type="button" onClick={() => setOpen(!open)}>{open ? 'gizle' : 'göster'}</button>
      </div>
      {open && <pre class="rec-debug-lines">{lines.slice(-8).join('\n')}</pre>}
    </div>
  );
}
