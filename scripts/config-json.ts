// Prints generated data for migrations: `defaults` (Balance Config), `schema` (JSON Schema), `flags`.
import { z } from 'zod';
import { BalanceConfigSchema, DEFAULT_CONFIG, DEFAULT_FLAGS } from '../packages/config/src/index';
const what = process.argv[2] || 'defaults';
const out = what === 'schema' ? z.toJSONSchema(BalanceConfigSchema, { io: 'input', unrepresentable: 'any' }) : what === 'flags' ? DEFAULT_FLAGS : DEFAULT_CONFIG;
process.stdout.write(JSON.stringify(out));
