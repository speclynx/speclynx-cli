# @speclynx/cli

[![Build Status](https://github.com/speclynx/speclynx-cli/actions/workflows/build.yml/badge.svg)](https://github.com/speclynx/speclynx-cli/actions)
[![npmversion](https://badge.fury.io/js/@speclynx%2Fcli.svg)](https://www.npmjs.com/package/@speclynx/cli)
[![Dependabot enabled](https://badgen.net/badge/icon/dependabot?icon=dependabot&label)](https://docs.github.com/en/code-security/supply-chain-security/keeping-your-dependencies-updated-automatically)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-3.0-40c463.svg)](https://github.com/speclynx/speclynx-cli/blob/HEAD/CODE_OF_CONDUCT.md)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/speclynx/speclynx-cli/blob/HEAD/LICENSE)

<div align="center">
    <a href="https://speclynx.com"><img width="636" height="407" alt="image" src="https://github.com/user-attachments/assets/1cfd6c8e-0206-4d53-9a2c-e4d10be84ca0" /></a>
</div>

Messy API specs? Bring order from the command line — **overlay**, **dereference**, **bundle**, **convert**, and **validate**.

> **Note:** Currently the `overlay` and `validate` commands are implemented. More commands are coming soon.

<div align="center">
    <b><a href="https://speclynx.com/cli">Documentation</a></b> | <b><a href="https://www.npmjs.com/package/@speclynx/cli">npm</a></b> | <b><a href="https://github.com/speclynx/speclynx-cli/issues">Issues</a></b>
</div>

<br />

`@speclynx/cli` is part of the [SpecLynx](https://speclynx.com/) ecosystem, built on top of [ApiDOM](https://github.com/speclynx/apidom) and [ApiDOM Language Service](https://github.com/speclynx/apidom-lsp).

## Installation

```sh
npm install -g @speclynx/cli
```

Or use directly with `npx`:

```sh
npx @speclynx/cli overlay apply overlay.json openapi.json
```

## Getting help

```sh
speclynx --help                  # list all commands
speclynx overlay --help          # list overlay subcommands
speclynx overlay apply --help    # show overlay apply options
speclynx overlay diff --help     # show overlay diff options
speclynx validate --help         # show validate options
```

## Commands

### `overlay apply`

Apply [Overlay 1.x](https://spec.openapis.org/overlay/v1.1.0.html) documents to API definitions.

**Supported Overlay versions:**

- [Overlay 1.0.0](https://spec.openapis.org/overlay/v1.0.0)
- [Overlay 1.1.0](https://spec.openapis.org/overlay/v1.1.0)

The target can be any JSON or YAML document.

```
speclynx overlay apply [options] <overlay> [target]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<overlay>` | Path to the overlay document (JSON or YAML) |
| `[target]` | Path to the target document; if omitted, uses the overlay `extends` field |

**Options:**

| Option | Description |
|--------|-------------|
| `--overlay <path>` | Additional overlay document to apply sequentially (repeatable) |
| `-o, --output <file>` | Write result to file instead of stdout |
| `-f, --format <format>` | Output format: `json` or `yaml` (auto-detected from target extension) |
| `--strict` | Fail if any action target matches zero nodes |
| `--verbose` | Print trace information about overlay application |

#### Examples

Apply an overlay to an OpenAPI document:

```sh
speclynx overlay apply overlay.json openapi.json
```

Apply an overlay that uses the `extends` field to reference the target:

```sh
speclynx overlay apply overlay.yaml
```

Write the result to a file:

```sh
speclynx overlay apply overlay.json openapi.json -o result.json
```

Force YAML output regardless of target extension:

```sh
speclynx overlay apply overlay.json openapi.json -f yaml
```

Apply multiple overlays sequentially:

```sh
speclynx overlay apply first.json openapi.json --overlay second.json --overlay third.json
```

Use strict mode to catch unmatched targets:

```sh
speclynx overlay apply overlay.json openapi.json --strict
```

Show detailed trace of each action:

```sh
speclynx overlay apply overlay.json openapi.json --verbose
```

```
Overlay: overlay.json -> openapi.json
  [ok] update $.info (1 matches)
  Overlay was successfully applied

{ ... }
```

---

### `overlay diff`

Generate an [Overlay 1.x](https://spec.openapis.org/overlay/v1.1.0.html) document from the diff of two API documents. The produced overlay, when applied to `<before>`, yields `<after>`.

```
speclynx overlay diff [options] <before> <after>
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<before>` | Path to the "before" API document (JSON or YAML) |
| `<after>` | Path to the "after" API document (JSON or YAML) |

**Options:**

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Write result to file instead of stdout |
| `-f, --format <format>` | Output format: `json` or `yaml` (auto-detected from `<before>` extension) |
| `--fail-on-empty` | Exit with code 1 if the documents are identical |

#### Examples

Generate an overlay from two OpenAPI documents:

```sh
speclynx overlay diff openapi-v1.json openapi-v2.json
```

Write the generated overlay to a file:

```sh
speclynx overlay diff openapi-v1.yaml openapi-v2.yaml -o migration.yaml
```

Force JSON output regardless of input format:

```sh
speclynx overlay diff openapi-v1.yaml openapi-v2.yaml -f json
```

Fail when the two documents are identical (useful in CI):

```sh
speclynx overlay diff openapi-v1.json openapi-v2.json --fail-on-empty
```

---

### `validate`

Validate and lint an API definition, powered by the [ApiDOM Language Service](https://www.npmjs.com/package/@speclynx/apidom-ls). The document type and version are auto-detected from its content.

**Supported specifications:**

- OpenAPI 2.0 (Swagger), 3.0.x, 3.1.x
- AsyncAPI 2.x
- Arazzo 1.x
- Overlay 1.x

By default, `validate` runs three kinds of checks:

- **Semantic validation** — checks the document against the *meaning* of its specification, not just its JSON/YAML syntax: required fields are present, values have the correct types, and objects are shaped as the spec requires.
- **Reference validation** — checks that every `$ref` resolves to something that actually exists.
- **Semantic linting** — applies style and best-practice rules on top of validation (for example, flagging an empty `enum`).

JSON Schema (AJV) validation is an additional opt-in layer, enabled with `--json-schema-validation`. It validates the document against the official JSON Schema for its specification and covers OpenAPI 2/3.0/3.1, AsyncAPI 2.x, Arazzo, and Overlay.

```
speclynx validate [options] <file>
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<file>` | Path to the API document (JSON or YAML) |

**Options:**

| Option | Description |
|--------|-------------|
| `-f, --format <format>` | Output format for diagnostics: `stylish` (default) or `json` |
| `--json-schema-validation` | Enable JSON Schema (AJV) validation (with friendlier error messages) |
| `--max-problems <n>` | Maximum number of problems to report |
| `--fail-severity <severity>` | Minimum diagnostic severity that fails the run: `error` (default), `warning`, `info`, or `hint` |

Diagnostics are written to stdout. The default `stylish` formatter prints a color-coded, human-readable report — a file header, one aligned `location  severity  code  message` row per problem, and a severity-count summary (colors are disabled automatically when the output is not a TTY, or when `NO_COLOR` is set). `--format json` writes the raw diagnostics array for machine consumption. stderr is reserved for hard errors (e.g. a missing file). The command exits with code `1` when a diagnostic at or above `--fail-severity` is found, and `0` otherwise — suitable for CI gating.

> **Note:** The `code` value of reference-validation diagnostics is not stable across runs, so consumers that snapshot or diff the `--format json` output should not rely on it for reference errors.

#### Examples

Validate an OpenAPI document:

```sh
speclynx validate openapi.json
```

Emit machine-readable diagnostics for further processing:

```sh
speclynx validate openapi.yaml --format json
```

Enable JSON Schema (AJV) validation on top of the default checks:

```sh
speclynx validate openapi.json --json-schema-validation
```

Treat lint warnings as failures in CI:

```sh
speclynx validate openapi.json --fail-severity warning
```

## License

SpecLynx CLI is licensed under [Apache 2.0 license](https://github.com/speclynx/speclynx-cli/blob/main/LICENSE).
SpecLynx CLI comes with an explicit [NOTICE](https://github.com/speclynx/speclynx-cli/blob/main/NOTICE) file
containing additional legal notices and information.
