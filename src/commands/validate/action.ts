import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver-types';
import type { ValidationContext } from '@speclynx/apidom-ls';

export interface ValidateActionOptions {
  json?: boolean;
  semanticValidation?: boolean;
  referenceValidation?: boolean;
  semanticLinting?: boolean;
  jsonSchemaValidation?: boolean;
  betterAjvErrors?: boolean;
  maxProblems?: number;
  baseUri?: string;
  referenceValidationMode?: string;
  relatedInformation?: boolean;
  strict?: boolean;
}

const severityLabels: Record<number, string> = {
  [DiagnosticSeverity.Error]: 'error',
  [DiagnosticSeverity.Warning]: 'warning',
  [DiagnosticSeverity.Information]: 'info',
  [DiagnosticSeverity.Hint]: 'hint',
};

// Build a fresh ValidationContext from CLI options. apidom-ls mutates the
// context object it receives (e.g. betterAjvErrors), so this must not be shared.
// referenceValidationModes maps the CLI choice strings to the (dynamically
// imported) ReferenceValidationMode enum.
const buildValidationContext = (
  opts: ValidateActionOptions,
  referenceValidationModes: Record<string, number>,
  fileURI: string,
): ValidationContext => {
  const context: ValidationContext = {};

  // default-on booleans exposed via commander `--no-*` negations
  if (opts.semanticValidation === false) context.semanticValidation = false;
  if (opts.referenceValidation === false) context.referenceValidation = false;
  if (opts.semanticLinting === false) context.semanticLinting = false;

  // default-off booleans
  if (opts.jsonSchemaValidation) context.jsonSchemaValidation = true;
  if (opts.betterAjvErrors) context.betterAjvErrors = true;
  if (opts.relatedInformation) context.relatedInformation = true;

  // Default the reference-resolution base to the input file so relative external
  // $refs (e.g. ./components.yaml#/...) resolve from the file's location out of
  // the box; an explicit --base-uri overrides it.
  context.baseURI = opts.baseUri ?? fileURI;
  if (opts.referenceValidationMode) {
    context.referenceValidationMode = referenceValidationModes[opts.referenceValidationMode];
  }

  // Note: --max-problems is NOT forwarded as maxNumberOfProblems here on purpose.
  // The cap is applied CLI-side to the returned diagnostics (for reporting only),
  // so the failure/exit-code decision always sees the complete diagnostic set.
  return context;
};

// A diagnostic fails the run when it is an error, or a warning under --strict.
const isFailure = (diagnostic: Diagnostic, strict: boolean): boolean =>
  diagnostic.severity === DiagnosticSeverity.Error ||
  (strict && diagnostic.severity === DiagnosticSeverity.Warning);

const formatDiagnostic = (displayPath: string, diagnostic: Diagnostic): string => {
  const { line, character } = diagnostic.range.start;
  const location = `${displayPath}:${line + 1}:${character + 1}`;
  const severity = severityLabels[diagnostic.severity ?? DiagnosticSeverity.Error] ?? 'error';
  const suffixParts = [diagnostic.code, diagnostic.source].filter(
    (part) => part !== undefined && part !== '',
  );
  const suffix = suffixParts.length > 0 ? `  [${suffixParts.join(' ')}]` : '';
  return `${location}  ${severity}  ${diagnostic.message}${suffix}`;
};

const action = async (filePath: string, opts: ValidateActionOptions): Promise<void> => {
  // --better-ajv-errors only tweaks AJV output, so it is a no-op unless JSON
  // Schema validation is also enabled. Warn rather than silently ignore it.
  if (opts.betterAjvErrors && !opts.jsonSchemaValidation) {
    process.stderr.write(
      'Warning: --better-ajv-errors has no effect without --json-schema-validation\n',
    );
  }

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
  const {
    getLanguageService,
    ReferenceValidationMode,
    OpenAPi20JsonSchemaValidationProvider,
    OpenAPi30JsonSchemaValidationProvider,
    OpenAPi31JsonSchemaValidationProvider,
    Arazzo1JsonSchemaValidationProvider,
    Overlay1JsonSchemaValidationProvider,
  } = await import('@speclynx/apidom-ls');

  const referenceValidationModes: Record<string, number> = {
    legacy: ReferenceValidationMode.LEGACY,
    indirect: ReferenceValidationMode.APIDOM_INDIRECT,
    'indirect-external': ReferenceValidationMode.APIDOM_INDIRECT_EXTERNAL,
  };

  const service = getLanguageService({
    validatorProviders: [
      new OpenAPi20JsonSchemaValidationProvider(),
      new OpenAPi30JsonSchemaValidationProvider(),
      new OpenAPi31JsonSchemaValidationProvider(),
      new Arazzo1JsonSchemaValidationProvider(),
      new Overlay1JsonSchemaValidationProvider(),
    ],
  });

  try {
    const languageId = /\.ya?ml$/i.test(resolvedPath) ? 'yaml' : 'json';
    const fileURI = pathToFileURL(resolvedPath).href;
    const document = TextDocument.create(fileURI, languageId, 0, content);

    const validationContext = buildValidationContext(opts, referenceValidationModes, fileURI);
    const diagnostics = await service.doValidation(document, validationContext);

    // The exit code reflects ALL detected problems; --max-problems only bounds
    // what is reported, never what fails the run.
    const failed = diagnostics.some((diagnostic) => isFailure(diagnostic, !!opts.strict));

    // Sort once, then cap once, so the JSON and human outputs always report the
    // same diagnostics in the same (line:column:severity) order.
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

    if (opts.json) {
      process.stdout.write(`${JSON.stringify(reported, null, 2)}\n`);
    } else if (diagnostics.length === 0) {
      process.stderr.write('No problems found\n');
    } else {
      for (const diagnostic of reported) {
        process.stderr.write(`${formatDiagnostic(filePath, diagnostic)}\n`);
      }
    }

    // Set the exit code and let the process exit naturally. Calling process.exit()
    // here would terminate before an async (piped) stdout write drains, truncating
    // large --json output at the ~64KB pipe buffer.
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
