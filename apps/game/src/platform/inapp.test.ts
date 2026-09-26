import { describe, expect, it } from 'vitest';
import { chromeIntent, inAppBrowser } from './inapp';

describe('in-app browser detection', () => {
  it('spots the WebViews that block Google sign-in', () => {
    // the player's report (feedback #1): Facebook on iPhone
    expect(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/24A437 [FBAN/FBIOS;FBAV/579.0.0.23.106;FBBV/1068430635]')).toBe('facebook');
    expect(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0')).toBe('line');
    expect(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 Instagram 350.0')).toBe('instagram');
    expect(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36')).toBe('webview');
  });
  it('leaves real browsers alone', () => {
    expect(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 26_7_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/153.0.8010.24 Mobile/15E148 Safari/604.1')).toBeNull();
    expect(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')).toBeNull();
    expect(inAppBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Safari/537.36')).toBeNull();
  });
  it('builds a Chrome intent for Android', () => {
    expect(chromeIntent('https://pixel-horde.pages.dev/play/')).toBe('intent://pixel-horde.pages.dev/play/#Intent;scheme=https;package=com.android.chrome;end');
  });
});
