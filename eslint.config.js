import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const banned = (object, props, why) => props.map((property) => ({ object, property, message: why }));
const NONDET = 'Not deterministic across browsers; use packages/sim/src/core/fmath.ts or the seeded RNG.';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'pixel-horde.html', '.scratch/**', 'docs/**', 'tests/browser/.out/**', 'apps/game/src/render/sprites.ts', 'apps/game/src/render/tiles.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.mjs', 'scripts/**'], languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } } },
  {
    // The headless sim must be deterministic and platform-free (CLAUDE.md → Structure).
    files: ['packages/sim/src/**/*.ts'],
    ignores: ['packages/sim/src/core/fmath.ts'],
    rules: {
      'no-restricted-properties': ['error',
        ...banned('Math', ['random', 'sin', 'cos', 'tan', 'atan', 'atan2', 'hypot', 'pow', 'exp', 'log', 'log2', 'log10', 'cbrt', 'expm1', 'log1p', 'sinh', 'cosh', 'tanh'], NONDET),
        { object: 'Date', property: 'now', message: 'No wall-clock in the sim; use ticks.' },
        { object: 'performance', property: 'now', message: 'No wall-clock in the sim; use ticks.' },
      ],
      'no-restricted-globals': ['error',
        ...['window', 'document', 'navigator', 'localStorage', 'fetch', 'WebSocket', 'performance', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'HTMLCanvasElement', 'CanvasRenderingContext2D']
          .map((name) => ({ name, message: 'The sim must not touch DOM, Canvas, network or timers.' })),
      ],
      'no-restricted-syntax': ['error',
        { selector: "BinaryExpression[operator='**']", message: 'Use fmath.ipow/pow (** is not guaranteed deterministic).' },
        { selector: "NewExpression[callee.name='Date']", message: 'No wall-clock in the sim.' },
      ],
    },
  },
);
