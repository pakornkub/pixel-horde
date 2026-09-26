import { REALM_IDS, type DebugEvent, type SimOptions } from '@pixel-horde/sim';

const EVENTS: DebugEvent[] = ['dragon', 'frostdragon', 'stormdragon', 'rival', 'bloodmoon'];

/** Debug flags from the page URL: ?debug=dragon|frostdragon|stormdragon|rival|bloodmoon|god|awaken|realm:<id> (comma separated). */
export function parseDebug(search: string): NonNullable<SimOptions['debug']> {
  const flags = new Set((new URLSearchParams(search).get('debug') || '').split(',').filter(Boolean));
  return {
    god: flags.has('god'),
    event: EVENTS.find((k) => flags.has(k)),
    realm: REALM_IDS.find((r) => flags.has('realm:' + r)),
    awaken: flags.has('awaken'),
  };
}
