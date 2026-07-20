import { Command, Option, InvalidArgumentError } from 'commander';

import action from './action.ts';
import { defaultFormat, formatChoices } from './formatters/index.ts';
import { defaultFailSeverity, failSeverityChoices } from './action.ts';

const parseMaxProblems = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new InvalidArgumentError('must be a positive integer.');
  }
  return parsed;
};

const command = new Command('validate');

command
  .description('Validate and lint an API definition (OpenAPI, AsyncAPI, Arazzo, Overlay)')
  .argument('<uri>', 'path or URL to the API document (JSON or YAML)')
  .addOption(
    new Option('-f, --format <format>', 'output format for diagnostics')
      .choices(formatChoices)
      .default(defaultFormat),
  )
  .option('--json', 'shorthand for --format json')
  .option('--json-schema-validation', 'enable JSON Schema (AJV) validation')
  .option('--max-problems <n>', 'maximum number of problems to report', parseMaxProblems)
  .addOption(
    new Option('--fail-severity <severity>', 'minimum diagnostic severity that fails the run')
      .choices(failSeverityChoices)
      .default(defaultFailSeverity),
  )
  .action(action);

export default command;
