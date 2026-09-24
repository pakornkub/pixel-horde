// Prints the built-in Balance Config as JSON (used to seed version 0 in a migration).
import { DEFAULT_CONFIG } from '../packages/config/src/index';
process.stdout.write(JSON.stringify(DEFAULT_CONFIG));
