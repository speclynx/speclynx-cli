const path = require('node:path');

module.exports = {
  ignore: ['**/*.d.ts'],
  env: {
    cjs: {
      browserslistEnv: 'production',
      presets: [
        [
          '@babel/preset-env',
          {
            debug: false,
            modules: 'commonjs',
            forceAllTransforms: false,
            ignoreBrowserslistConfig: false,
            exclude: ['transform-function-name'],
          },
        ],
        ['@babel/preset-typescript', { onlyRemoveTypeImports: false }],
      ],
      plugins: [
        [
          '@babel/plugin-transform-runtime',
          {
            moduleName: '@babel/runtime-corejs3',
            absoluteRuntime: false,
            version: '^8.0.0',
          },
        ],
        process.env.NODE_ENV !== 'test'
          ? [
              path.join(__dirname, './scripts/babel-plugin-add-import-extension.cjs'),
              { extension: 'cjs' },
            ]
          : false,
      ].filter(Boolean),
    },
    es: {
      browserslistEnv: 'production',
      presets: [
        [
          '@babel/preset-env',
          {
            debug: false,
            modules: false,
            forceAllTransforms: false,
            ignoreBrowserslistConfig: false,
            exclude: ['transform-function-name'],
          },
        ],
        ['@babel/preset-typescript', { onlyRemoveTypeImports: false }],
      ],
      plugins: [
        [
          '@babel/plugin-transform-runtime',
          {
            moduleName: '@babel/runtime-corejs3',
            absoluteRuntime: false,
            version: '^8.0.0',
          },
        ],
        [
          path.join(__dirname, './scripts/babel-plugin-add-import-extension.cjs'),
          { extension: 'mjs' },
        ],
      ],
    },
  },
};
