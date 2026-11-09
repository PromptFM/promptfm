import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'warn',
      // New in eslint-plugin-react-hooks 7 (shipped with eslint-config-next 16). Existing components trip them,
      // so they warn until each one is reworked.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'reports/**', 'next-env.d.ts'],
  },
];

export default config;
