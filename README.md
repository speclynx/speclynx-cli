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

> **Note:** Currently only the `overlay` command is implemented. More commands are coming soon.

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

## License

SpecLynx CLI is licensed under [Apache 2.0 license](https://github.com/speclynx/speclynx-cli/blob/main/LICENSE).
SpecLynx CLI comes with an explicit [NOTICE](https://github.com/speclynx/speclynx-cli/blob/main/NOTICE) file
containing additional legal notices and information.
