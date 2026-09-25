// The Balance Config the next Run will use. Built-in defaults for now; ticket 13 loads the
// published version from the server (cached locally) and swaps it in at Stage start.
import { DEFAULT_RESOLVED, type ResolvedConfig } from '@pixel-horde/sim';

export const active: { cfg: ResolvedConfig } = { cfg: DEFAULT_RESOLVED };
