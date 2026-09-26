// In-app browsers (Facebook, Messenger, Instagram, LINE, TikTok…) open shared links in their own WebView,
// where Google refuses to sign in ("403 disallowed_useragent"). Linking Google there asks the player to
// open the game in the real browser instead: Android can jump to Chrome, iOS gets the link copied.

/** The app whose WebView this is, or null in a normal browser. */
export function inAppBrowser(ua: string): string | null {
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return /Messenger|MESSENGER/.test(ua) ? 'messenger' : 'facebook';
  if (/Instagram/.test(ua)) return 'instagram';
  if (/\bLine\//.test(ua)) return 'line';
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'tiktok';
  if (/Twitter/.test(ua)) return 'twitter';
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return 'webview';
  return null;
}

/** Android: an intent URL that opens this page in Chrome (falls back to the Play Store page if Chrome is missing). */
export function chromeIntent(href: string): string {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`;
}

export const isAndroid = (ua: string): boolean => /Android/.test(ua);
