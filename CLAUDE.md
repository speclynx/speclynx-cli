# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@speclynx/cli` is a command-line tool for API specification processing (overlay, dereference, bundle, convert, validate). It uses the `commander` library and is published to npm under the `@speclynx` scope.

## Build & Development Commands

```bash
npm run build          # clean + build ES modules (.mjs) + CommonJS (.cjs)
npm run build:es       # build ES modules only
npm run build:cjs      # build CommonJS only
npm run lint           # run ESLint
npm run lint:fix       # run ESLint with auto-fix
npm run typescript:check-types  # type-check without emitting
npm test               # build + compile tests + run mocha
npm run clean          # remove compiled artifacts
```

## Architecture

- **`bin/speclynx.mjs`** — static entry point with shebang, imports compiled `src/cli.mjs`. Not processed by Babel.
- **`src/cli.ts`** — root CLI logic using `commander`; registers each command.
- **`src/commands/<command>/`** — one folder per command, with `index.ts` (the `commander` Command definition + options) and `action.ts` (the async handler and its `*ActionOptions` interface). Subcommands nest further (e.g. `overlay/apply/`). Current commands: `overlay` (with `apply`/`diff`) and `validate` (backed by `@speclynx/apidom-ls`). `validate` also has a `formatters/` folder — a registry of diagnostic renderers (`stylish` default, `json`) selected by `--format`.
- **`test/`** — Mocha + Chai tests mirroring the `src/commands/` layout, with fixtures under `test/fixtures/commands/<command>/` (only cross-command fixtures live at the `test/fixtures/` root). TypeScript files compiled to `.mjs` by Babel before mocha runs them.

## Build Pipeline

TypeScript is type-checked by `tsc` but **never emitted by it**. Babel handles all compilation:
- `src/*.ts` → `src/*.mjs` (ES modules) and `src/*.cjs` (CommonJS) — compiled output lives alongside source
- `test/*.ts` → `test/*.mjs` — compiled during `npm test`
- `scripts/babel-plugin-add-import-extension.cjs` — custom Babel plugin that rewrites import paths with `.mjs`/`.cjs` extensions

Browserslist targets: `node 20` (production), `node 26.3.1` (development).

## Conventions

- **Commits**: Conventional Commits, max 69-char header, imperative tense. Enforced by commitlint + husky.
- **Linting**: ESLint flat config. Import extensions required (`.ts`). Prettier integrated. Mocha rules for test files.
- **Branches**: `feature/description` or `fix/1234-description`.
- **Release**: semantic-release via manual GitHub Actions dispatch. Produces npm tarball with provenance attestation.
