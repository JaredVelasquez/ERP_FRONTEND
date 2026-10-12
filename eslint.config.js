import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

const platformBan = {
  paths: [{ name: 'electron', message: 'Only platform/electron may import electron.' }],
  patterns: [{ group: ['@capacitor/*'], message: 'Only platform/capacitor may import Capacitor.' }],
}

export default tseslint.config(
  { ignores: ['dist/**', 'dist-electron/**', 'android/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', platformBan],
    },
  },
  {
    files: ['src/platform/electron/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/platform/capacitor/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'electron', message: 'Only platform/electron may import electron.' }] },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}', 'src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: platformBan.paths,
          patterns: [
            ...platformBan.patterns,
            { group: ['@/platform', '@/platform/*'], message: 'Modules and shared use contracts, not platform code.' },
          ],
        },
      ],
    },
  },
)
