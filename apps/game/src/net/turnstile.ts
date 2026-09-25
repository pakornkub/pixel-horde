// Cloudflare Turnstile (invisible) token for anonymous sign-up, when a site key is configured.
declare global {
  interface Window { turnstile?: { render(el: HTMLElement, o: Record<string, unknown>): string; remove(id: string): void } }
}

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error('turnstile load failed'));
    document.head.appendChild(s);
  });
  return loading;
}

export async function getCaptchaToken(siteKey: string): Promise<string> {
  await loadScript();
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:20';
  document.body.appendChild(box);
  try {
    return await new Promise<string>((res, rej) => {
      const id = window.turnstile!.render(box, {
        sitekey: siteKey, size: 'flexible', appearance: 'interaction-only',
        callback: (t: string) => { res(t); window.turnstile!.remove(id); },
        'error-callback': () => rej(new Error('turnstile failed')),
      });
    });
  } finally {
    setTimeout(() => box.remove(), 500);
  }
}
