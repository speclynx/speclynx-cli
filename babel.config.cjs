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
            loose: true,
            useBuiltIns: false,
            forceAllTransforms: false,
            ignoreBrowserslistConfig: false,
            exclude: ['transform-function-name'],
          },
        ],
        [
          '@babel/preset-typescript',
          {
            allowDeclareFields: true,
          },
        ],
      ],
      plugins: [
        [
          '@babel/plugin-transform-runtime',
          {
            corejs: { version: 3, proposals: false },
            absoluteRuntime: false,
            helpers: true,
            regenerator: false,
            version: '^7.22.15',
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
            useBuiltIns: false,
            forceAllTransforms: false,
            ignoreBrowserslistConfig: false,
            exclude: ['transform-function-name'],
          },
        ],
        [
          '@babel/preset-typescript',
          {
            allowDeclareFields: true,
          },
        ],
      ],
      plugins: [
        [
          '@babel/plugin-transform-runtime',
          {
            corejs: { version: 3, proposals: false },
            absoluteRuntime: false,
            helpers: true,
            regenerator: false,
            useESModules: true,
            version: '^7.22.15',
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
