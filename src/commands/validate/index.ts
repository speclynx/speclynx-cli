import { Command, Option, InvalidArgumentError } from 'commander';

import action from './action.ts';

const parseMaxProblems = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new InvalidArgumentError('must be a positive integer.');
  }
  return parsed;
};

const command = new Command('validate');

command
  .description(
    'Validate and lint an API definition (OpenAPI, AsyncAPI, Arazzo, Overlay, JSON Schema)',
  )
  .argument('<file>', 'path to the API document (JSON or YAML)')
  .option('--json', 'output raw diagnostics as JSON to stdout')
  .option('--no-semantic-validation', 'disable semantic validation')
  .option('--no-reference-validation', 'disable reference validation')
  .option('--no-semantic-linting', 'disable semantic linting')
  .option('--json-schema-validation', 'enable JSON Schema (AJV) validation')
  .option('--better-ajv-errors', 'use better AJV error messages (with --json-schema-validation)')
  .option('--max-problems <n>', 'maximum number of problems to report', parseMaxProblems)
  .option('--base-uri <uri>', 'base URI used to resolve references')
  .addOption(
    new Option('--reference-validation-mode <mode>', 'reference validation mode').choices([
      'legacy',
      'indirect',
      'indirect-external',
    ]),
  )
  .option('--related-information', 'include related information in diagnostics')
  .option('--strict', 'treat warnings as failures (exit with code 1)')
  .action(action);

export default command;
