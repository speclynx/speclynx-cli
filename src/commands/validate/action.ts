import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver-types';
import type { ValidationContext } from '@speclynx/apidom-ls';

import { formatters, defaultFormat } from './formatters/index.ts';

export interface ValidateActionOptions {
  format?: string;
  json?: boolean;
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

const action = async (filePath: string, opts: ValidateActionOptions): Promise<void> => {
  // Read the input up front so a bad path fails fast, before paying the
  // multi-second apidom-ls import below.
  let resolvedPath: string;
  let content: string;
  try {
    resolvedPath = path.resolve(filePath);
    content = fs.readFileSync(resolvedPath, 'utf-8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
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
    const languageId = /\.ya?ml$/i.test(resolvedPath) ? 'yaml' : 'json';
    const fileURI = pathToFileURL(resolvedPath).href;
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

    // Render via the selected formatter. All formatted output goes to stdout
    // (stderr is reserved for hard errors), so `--format` is stream-consistent.
    // --json is shorthand for --format json and wins if both are given.
    const format = opts.json ? 'json' : (opts.format ?? defaultFormat);
    const formatter = formatters[format] ?? formatters[defaultFormat];
    process.stdout.write(`${formatter(reported, { path: filePath, total: diagnostics.length })}\n`);

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
