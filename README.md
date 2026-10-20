<div align="center">

<a href="https://speclynx.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/speclynx/.github/main/profile/assets/logos/speclynx-logo-dark.png" />
    <img width="280" alt="SpecLynx" src="https://raw.githubusercontent.com/speclynx/.github/main/profile/assets/logos/speclynx-logo-light.png" />
  </picture>
</a>

# @speclynx/cli

**Validate, overlay, and reshape your API specs from the command line.**

**OpenAPI**, **AsyncAPI**, **Arazzo**, and **Overlay**, in JSON or YAML, through one consistent toolchain.<br/>
Local-first: no accounts, no telemetry, works offline.

[![Build Status](https://github.com/speclynx/speclynx-cli/actions/workflows/build.yml/badge.svg)](https://github.com/speclynx/speclynx-cli/actions)
[![npmversion](https://badge.fury.io/js/@speclynx%2Fcli.svg)](https://www.npmjs.com/package/@speclynx/cli)
[![Dependabot enabled](https://badgen.net/badge/icon/dependabot?icon=dependabot&label)](https://docs.github.com/en/code-security/supply-chain-security/keeping-your-dependencies-updated-automatically)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-3.0-40c463.svg)](https://github.com/speclynx/speclynx-cli/blob/HEAD/CODE_OF_CONDUCT.md)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/speclynx/speclynx-cli/blob/HEAD/LICENSE)

**[Documentation](https://speclynx.com/cli/)** · **[npm](https://www.npmjs.com/package/@speclynx/cli)** · **[Discussions](https://github.com/orgs/speclynx/discussions)** · **[Issues](https://github.com/speclynx/speclynx-cli/issues)**

</div>

## Get started

Validate any spec. Nothing to install, no account:

```sh
npx @speclynx/cli validate openapi.yaml
npx @speclynx/cli validate asyncapi.yaml
npx @speclynx/cli validate arazzo.yaml
npx @speclynx/cli validate overlay.yaml
```

<a href="https://speclynx.com/cli/#validate-command"><img alt="speclynx validate reporting problems with line ranges and rule codes in OpenAPI, AsyncAPI, Arazzo, and Overlay documents" src="https://raw.githubusercontent.com/speclynx/.github/main/profile/assets/validate-demo.svg" /></a>

Apply or generate overlays:

```sh
npx @speclynx/cli overlay apply add-contact.yaml museum.yaml
npx @speclynx/cli overlay diff openapi-v1.yaml openapi-v2.yaml
```

<a href="https://speclynx.com/cli/#overlay-apply-command"><img alt="speclynx overlay apply adding a contact to an OpenAPI document, and overlay diff generating an Overlay document from two OpenAPI versions" src="https://raw.githubusercontent.com/speclynx/.github/main/profile/assets/overlay-demo.svg" /></a>

Prefer a global install?

```sh
npm install -g @speclynx/cli
speclynx --help
```

## Commands

| Command | What it does |
| :------ | :----------- |
| [`validate`](https://speclynx.com/cli/#validate-command) | Validate and lint OpenAPI 2.0/3.0/3.1, AsyncAPI 2.x, Arazzo 1.x, and Overlay 1.x documents, from a file or a URL. |
| [`overlay apply`](https://speclynx.com/cli/#overlay-apply-command) | Apply one or more Overlay 1.0/1.1/1.2 documents to any JSON or YAML document. |
| [`overlay diff`](https://speclynx.com/cli/#overlay-diff-command) | Generate an Overlay document that turns one API document into another. |

Built for CI: exit codes gate on a severity you choose (`--fail-severity`), and diagnostics are available as JSON (`--format json`).

`dereference`, `bundle`, and `convert` are on the [roadmap](https://speclynx.com/cli/#roadmap).

Every option is documented in the [CLI reference](https://speclynx.com/cli/) and in `speclynx <command> --help`.

## Part of SpecLynx

`@speclynx/cli` is one piece of [SpecLynx](https://speclynx.com/), an open source toolchain for API specs. The same engine powers every tool.

| Tool | What it does | Type |
| :--- | :----------- | :--- |
| [**Editor**](https://speclynx.com/editor/) | Write and validate specs in the browser, nothing to install. | Browser editor |
| [**OpenAPI Toolkit**](https://speclynx.com/openapi-toolkit/) | Validation, completion, and preview while you author specs. | VS Code extension |
| [**Language Service**](https://speclynx.com/language-service/) | LSP intelligence for API specs; the validation layer behind `speclynx validate`. | Integration library |
| [**ApiDOM**](https://speclynx.com/apidom/) | Parse, dereference, and bundle any API spec through one lossless semantic structure. | Core library |
| [**UseArazzo**](https://usearazzo.com) | Validate, run, and trace Arazzo API workflows. Built on SpecLynx. | Workflow toolkit |

## Get help

Ask in [GitHub Discussions](https://github.com/orgs/speclynx/discussions), or [open an issue](https://github.com/speclynx/speclynx-cli/issues) if something is broken. Contributions are welcome, see [CONTRIBUTING.md](https://github.com/speclynx/speclynx-cli/blob/main/CONTRIBUTING.md).

## License

SpecLynx CLI is licensed under [Apache 2.0 license](https://github.com/speclynx/speclynx-cli/blob/main/LICENSE).
SpecLynx CLI comes with an explicit [NOTICE](https://github.com/speclynx/speclynx-cli/blob/main/NOTICE) file
containing additional legal notices and information.
