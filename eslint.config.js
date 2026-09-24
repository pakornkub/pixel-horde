import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/game/src/legacy/**', 'pixel-horde.html', '.scratch/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
