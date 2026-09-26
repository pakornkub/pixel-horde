import { describe, expect, it } from 'vitest';
import { parseDebug } from './debug';

describe('?debug= URL flags', () => {
  it('reads god and a forced event next to other params', () => {
    expect(parseDebug('?offline&debug=god,bloodmoon')).toEqual({ god: true, event: 'bloodmoon', realm: undefined });
  });

  it('reads a forced Realm', () => {
    expect(parseDebug('?debug=realm:greenvale,rival')).toEqual({ god: false, event: 'rival', realm: 'greenvale' });
  });

  it('ignores unknown flags and a missing param', () => {
    expect(parseDebug('?debug=bogus')).toEqual({ god: false, event: undefined, realm: undefined });
    expect(parseDebug('')).toEqual({ god: false, event: undefined, realm: undefined });
  });
});
