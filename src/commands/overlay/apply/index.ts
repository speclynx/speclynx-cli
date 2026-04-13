import { Command, Option } from 'commander';

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
  .addOption(
    new Option(
      '-f, --format <format>',
      'output format (auto-detected from target extension)',
    ).choices(['json', 'yaml']),
  )
  .option('--strict', 'fail if any action target matches zero nodes')
  .option('--verbose', 'print trace information about overlay application')
  .action(action);

export default command;
