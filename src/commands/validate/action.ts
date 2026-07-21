import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver-types';
import type { ValidationContext } from '@speclynx/apidom-ls';

import { formatters, defaultFormat } from './formatters/index.ts';
import stripAnsi from './strip-ansi.ts';

export interface ValidateActionOptions {
  format?: string;
  json?: boolean;
  output?: string;
  jsonSchemaValidation?: boolean;
  maxProblems?: number;
  failSeverity?: string;
}

// --fail-severity choices, mapped to their LSP severity. Error is the most
// severe (smallest numeric value).
const failSeverities: Record<string, DiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
  hint: DiagnosticSeverity.Hint,
};

export const failSeverityChoices = Object.keys(failSeverities);

export const defaultFailSeverity = 'error';

// Build a fresh ValidationContext from CLI options. apidom-ls mutates the
// context object it receives (e.g. betterAjvErrors), so this must not be shared.
// This first cut is intentionally opinionated: semantic validation, reference
// validation, and semantic linting are always on and not exposed as toggles.
const buildValidationContext = (
  opts: ValidateActionOptions,
  fileURI: string,
): ValidationContext => {
  const context: ValidationContext = {
    semanticValidation: true,
    referenceValidation: true,
    semanticLinting: true,
  };

  // JSON Schema (AJV) validation is opt-in; when enabled, always use the
  // friendlier AJV error messages.
  if (opts.jsonSchemaValidation) {
    context.jsonSchemaValidation = true;
    context.betterAjvErrors = true;
  }

  // Anchor reference resolution to the input file so relative external $refs
  // (e.g. ./components.yaml#/...) resolve from the file's location.
  context.baseURI = fileURI;

  return context;
};

// A diagnostic fails the run when its severity is at least as severe as the
// --fail-severity threshold (Error is most severe = smallest numeric value).
const isFailure = (diagnostic: Diagnostic, threshold: DiagnosticSeverity): boolean =>
  (diagnostic.severity ?? DiagnosticSeverity.Error) <= threshold;

const action = async (source: string, opts: ValidateActionOptions): Promise<void> => {
  // Lazily imported (like apidom-ls below) so other commands don't pay the cost.
  const [{ url, readFile }, { default: FileResolver }, { default: HTTPResolverAxios }] =
    await Promise.all([
      import('@speclynx/apidom-reference'),
      import('@speclynx/apidom-reference/resolve/resolvers/file'),
      import('@speclynx/apidom-reference/resolve/resolvers/http-axios'),
    ]);

  // Resolve the input to a canonical URI. http(s) URLs pass through untouched. A
  // file: URL is round-tripped through fileURLToPath so every legal form — single-
  // slash (file:/x), triple-slash, and //localhost/ — normalizes to the same
  // file:///x. Anything else is a filesystem path, made absolute. Only these three
  // schemes are treated as URIs, so a relative filename that happens to contain a
  // colon (draft:v1.json) is read as a path rather than mistaken for a scheme.
  //
  // This canonicalization is not for readFile (it sanitizes its own argument) but
  // for fileURI's second role as the baseURI apidom-ls uses verbatim to resolve
  // relative external $refs — where a raw Windows path throws ERR_INVALID_URL and a
  // relative path resolves against the filesystem root instead of the document.
  const scheme = url.getProtocol(source);
  let fileURI: string;
  if (scheme === 'http' || scheme === 'https') {
    fileURI = source;
  } else if (scheme === 'file') {
    fileURI = pathToFileURL(fileURLToPath(source)).href;
  } else {
    fileURI = pathToFileURL(path.resolve(source)).href;
  }

  // Read up front so a bad path/URL fails before the multi-second apidom-ls import.
  // Resolvers are passed explicitly rather than inherited from apidom-reference's
  // mutable global options, so the CLI's file access and network egress policy live
  // here. The /.*/ allow-list lifts the file resolver's deny-all for any local path
  // — a glob like '*' would miss dotfile basenames (.openapi.yaml), since picomatch
  // does not match a leading dot without dot:true. The HTTP resolver has no
  // allow-list and always accepts URLs.
  let content: string;
  try {
    const data = await readFile(fileURI, {
      resolve: {
        resolvers: [
          new FileResolver({ fileAllowList: [/.*/] }),
          new HTTPResolverAxios({ timeout: 5000, redirects: 5, withCredentials: false }),
        ],
      },
    });
    content = data.toString('utf-8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
    return;
  }

  // Refuse to overwrite the input document with the diagnostics report — that
  // would silently destroy the user's API definition. Checked up front, before
  // the heavy apidom-ls import, so it fails fast.
  if (
    opts.output &&
    scheme !== 'http' &&
    scheme !== 'https' &&
    path.resolve(opts.output) === fileURLToPath(fileURI)
  ) {
    process.stderr.write('Error: --output path must differ from the input file\n');
    process.exitCode = 1;
    return;
  }

  // apidom-ls is a heavy dependency (~seconds to import), so it is loaded lazily
  // here rather than at module top level — otherwise every `speclynx` command
  // (overlay, --help, …) would pay the cost even when validation never runs.
  // Providers come from the apidom-ls barrel where it exports them (typed public
  // API). AsyncAPI is the exception: the barrel omits its providers, so they are
  // pulled from subpaths (untyped — see apidom-ls-asyncapi.d.ts) to let
  // --json-schema-validation cover AsyncAPI 2.0–2.6. This adds ~50ms on top of
  // the multi-second barrel import. Note OpenAPI 2.0/3.0 have no subpath at all,
  // so uniform subpath loading is not possible anyway.
  const [
    {
      getLanguageService,
      OpenAPi20JsonSchemaValidationProvider,
      OpenAPi30JsonSchemaValidationProvider,
      OpenAPi31JsonSchemaValidationProvider,
      Arazzo1JsonSchemaValidationProvider,
      Overlay1JsonSchemaValidationProvider,
    },
    { Asyncapi20JsonSchemaValidationProvider },
    { Asyncapi21JsonSchemaValidationProvider },
    { Asyncapi22JsonSchemaValidationProvider },
    { Asyncapi23JsonSchemaValidationProvider },
    { Asyncapi24JsonSchemaValidationProvider },
    { Asyncapi25JsonSchemaValidationProvider },
    { Asyncapi26JsonSchemaValidationProvider },
  ] = await Promise.all([
    import('@speclynx/apidom-ls'),
    import('@speclynx/apidom-ls/services/validation/providers/asyncapi-20-json-schema'),
    import('@speclynx/apidom-ls/services/validation/providers/asyncapi-21-json-schema'),
    import('@speclynx/apidom-ls/services/validation/providers/asyncapi-22-json-schema'),
    import('@speclynx/apidom-ls/services/validation/providers/asyncapi-23-json-schema'),
    import('@speclynx/apidom-ls/services/validation/providers/asyncapi-24-json-schema'),
    import('@speclynx/apidom-ls/services/validation/providers/asyncapi-25-json-schema'),
    import('@speclynx/apidom-ls/services/validation/providers/asyncapi-26-json-schema'),
  ]);

  const service = getLanguageService({
    validatorProviders: [
      new OpenAPi20JsonSchemaValidationProvider(),
      new OpenAPi30JsonSchemaValidationProvider(),
      new OpenAPi31JsonSchemaValidationProvider(),
      new Arazzo1JsonSchemaValidationProvider(),
      new Overlay1JsonSchemaValidationProvider(),
      new Asyncapi20JsonSchemaValidationProvider(),
      new Asyncapi21JsonSchemaValidationProvider(),
      new Asyncapi22JsonSchemaValidationProvider(),
      new Asyncapi23JsonSchemaValidationProvider(),
      new Asyncapi24JsonSchemaValidationProvider(),
      new Asyncapi25JsonSchemaValidationProvider(),
      new Asyncapi26JsonSchemaValidationProvider(),
    ],
  });

  try {
    // Detect YAML by extension, tolerating a URL query string or fragment
    // (e.g. https://host/spec.yaml?v=1). Everything else is treated as JSON.
    const languageId = /\.ya?ml(?:[?#]|$)/i.test(fileURI) ? 'yaml' : 'json';
    const document = TextDocument.create(fileURI, languageId, 0, content);

    const validationContext = buildValidationContext(opts, fileURI);
    const diagnostics = await service.doValidation(document, validationContext);

    // A diagnostic at or above the --fail-severity threshold fails the run.
    const threshold = failSeverities[opts.failSeverity ?? defaultFailSeverity];
    const failed = diagnostics.some((diagnostic) => isFailure(diagnostic, threshold));

    // Sort once, then cap once, so the JSON and human outputs report the same
    // diagnostics in the same (line:column:severity) order. The exit code above
    // is computed from the full set, so --max-problems never masks a failure.
    const sorted = [...diagnostics].sort(
      (a, b) =>
        a.range.start.line - b.range.start.line ||
        a.range.start.character - b.range.start.character ||
        (a.severity ?? 0) - (b.severity ?? 0),
    );
    const reported =
      typeof opts.maxProblems === 'number' && opts.maxProblems > 0
        ? sorted.slice(0, opts.maxProblems)
        : sorted;

    // Render via the selected formatter. Formatted output goes to stdout by
    // default (stderr is reserved for hard errors), so `--format` is
    // stream-consistent; -o/--output redirects it to a file instead.
    // --json is shorthand for --format json and wins if both are given.
    const format = opts.json ? 'json' : (opts.format ?? defaultFormat);
    const formatter = formatters[format] ?? formatters[defaultFormat];
    const rendered = `${formatter(reported, { path: source, total: diagnostics.length })}\n`;

    if (opts.output) {
      // Only the stylish formatter emits chalk colors, and it keys them on
      // process.stdout's TTY state — unaware the bytes are being written to a
      // file. Strip ANSI so those reports are plain text on disk; json is left
      // exactly as emitted. Formatters stay oblivious to their destination.
      const payload = format === 'json' ? rendered : stripAnsi(rendered);
      const outputPath = path.resolve(opts.output);
      try {
        fs.writeFileSync(outputPath, payload, 'utf-8');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`failed to write ${outputPath}: ${message}`);
      }
    } else {
      process.stdout.write(rendered);
    }

    // Set the exit code and let the process exit naturally. Calling process.exit()
    // here would terminate before an async (piped) stdout write drains, truncating
    // large output at the ~64KB pipe buffer.
    process.exitCode = failed ? 1 : 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  } finally {
    // Disposes the document-cache setInterval so the event loop can drain and
    // the process exits on its own.
    service.terminate();
  }
};

export default action;
