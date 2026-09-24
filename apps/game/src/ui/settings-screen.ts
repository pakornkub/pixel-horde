// Settings overlay (ticket 07): every option applies immediately and persists on the device.
import { t } from '@pixel-horde/i18n';
import { applyLang, canVibrate, saveSettings, settings, type Settings } from '../settings';
import { $, hide, show } from './overlays';

let from = 'ovTitle';

function seg<K extends keyof Settings>(key: K, opts: readonly Settings[K][], label: (v: Settings[K]) => string, onSet?: (v: Settings[K]) => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'seg';
  box.setAttribute('role', 'group');
  for (const o of opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label(o);
    b.setAttribute('aria-pressed', String(settings[key] === o));
    b.addEventListener('click', () => {
      settings[key] = o;
      if (onSet) onSet(o); else saveSettings();
      render();
    });
    box.appendChild(b);
  }
  return box;
}

function slider(key: 'music' | 'sfx'): HTMLElement {
  const r = document.createElement('input');
  r.type = 'range'; r.min = '0'; r.max = '100'; r.step = '5';
  r.value = String(Math.round(settings[key] * 100));
  r.setAttribute('aria-label', t(`set.${key}`));
  r.addEventListener('input', () => { settings[key] = Number(r.value) / 100; saveSettings(); });
  return r;
}

function row(labelKey: string, control: HTMLElement): HTMLElement {
  const d = document.createElement('div');
  d.className = 'setrow';
  const l = document.createElement('span');
  l.textContent = t(labelKey);
  d.append(l, control);
  return d;
}

const onOff = (v: boolean): string => t(v ? 'set.opt.on' : 'set.opt.off');

function render(): void {
  const list = $('setList');
  list.innerHTML = '';
  list.append(
    row('set.lang', seg('lang', ['th', 'en'] as const, (v) => t(`set.opt.${v}`), (v) => applyLang(v))),
    row('set.music', slider('music')),
    row('set.sfx', slider('sfx')),
    row('set.shake', seg('shake', ['off', 'light', 'full'] as const, (v) => t(`set.opt.${v}`))),
  );
  if (canVibrate()) list.append(row('set.vibrate', seg('vibrate', [false, true] as const, onOff)));
  list.append(
    row('set.ultFlash', seg('ultFlash', [false, true] as const, onOff)),
    row('set.effects', seg('effects', ['off', 'some', 'all'] as const, (v) => t(`set.opt.${v}`))),
    row('set.numbers', seg('numbers', ['off', 'some', 'all'] as const, (v) => t(`set.opt.${v}`))),
    row('set.tips', seg('tips', [false, true] as const, onOff)),
  );
  const replay = document.createElement('button');
  replay.className = 'btn ghost';
  replay.textContent = t('set.tipsReplay');
  const msg = document.createElement('p');
  msg.className = 'setmsg';
  replay.addEventListener('click', () => { settings.tipsSeen = []; settings.tips = true; saveSettings(); render(); $('setList').querySelector('.setmsg')!.textContent = t('set.tipsReplayed'); });
  list.append(replay, msg);
}

export function openSettings(fromOverlay: string): void {
  from = fromOverlay;
  hide(from);
  render();
  show('ovSettings');
  setTimeout(() => ($('setList').querySelector('button,input') as HTMLElement | null)?.focus({ preventScroll: true }), 30);
}

export function closeSettings(): void {
  hide('ovSettings');
  show(from);
}

export const settingsOpen = (): boolean => $('ovSettings').classList.contains('on');
