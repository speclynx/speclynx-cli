import { Command, Option } from 'commander';

import action from './action.ts';

const command = new Command('diff');

command
  .description('Generate an Overlay 1.x.y document from the diff of two API documents')
  .argument('<before>', 'path to the before document (JSON or YAML)')
  .argument('<after>', 'path to the after document (JSON or YAML)')
  .option('-o, --output <file>', 'write result to file instead of stdout')
  .addOption(
    new Option(
      '-f, --format <format>',
      'output format (auto-detected from before extension)',
    ).choices(['json', 'yaml']),
  )
  .option('--fail-on-empty', 'exit with code 1 if the documents are identical')
  .action(action);

export default command;
