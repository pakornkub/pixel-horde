import { describe, expect, it } from 'vitest';
import { parseDebug } from './debug';

describe('?debug= URL flags', () => {
  it('reads god and a forced event next to other params', () => {
    expect(parseDebug('?offline&debug=god,bloodmoon')).toEqual({ god: true, event: 'bloodmoon', realm: undefined, awaken: false });
  });

  it('reads a forced Realm', () => {
    expect(parseDebug('?debug=realm:greenvale,rival')).toEqual({ god: false, event: 'rival', realm: 'greenvale', awaken: false });
  });

  it('reads awaken (start Awakened)', () => {
    expect(parseDebug('?debug=god,awaken').awaken).toBe(true);
  });

  it('ignores unknown flags and a missing param', () => {
    expect(parseDebug('?debug=bogus')).toEqual({ god: false, event: undefined, realm: undefined, awaken: false });
    expect(parseDebug('')).toEqual({ god: false, event: undefined, realm: undefined, awaken: false });
  });
});
