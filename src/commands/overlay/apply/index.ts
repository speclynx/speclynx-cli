import { Command } from 'commander';

import action from './action.ts';

const command = new Command('apply');

command
  .description('Apply Overlay 1.x.y documents to API definitions')
  .argument('<overlay>', 'path to the overlay document (JSON or YAML)')
  .argument('[target]', 'path to the target document; if omitted, uses the overlay extends field')
  .option(
    '--overlay <path>',
    'additional overlay document to apply sequentially (repeatable)',
    (value: string, previous: string[]) => previous.concat(value),
    [] as string[],
  )
  .option('-o, --output <file>', 'write result to file instead of stdout')
  .option(
    '-f, --format <format>',
    'output format: json or yaml (auto-detected from target extension)',
  )
  .option('--strict', 'fail if any action target matches zero nodes')
  .option('--verbose', 'print trace information about overlay application')
  .action(action);

export default command;
