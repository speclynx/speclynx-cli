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
  // 1.0.0 is not offered: the generated actions update primitive nodes and concatenate
  // arrays, which Overlay 1.0.0 does not allow (introduced in 1.1.0)
  .addOption(
    new Option('--overlay-version <version>', 'Overlay version of the generated document')
      .choices(['1.1.0', '1.2.0'])
      .default('1.2.0'),
  )
  .option('--fail-on-empty', 'exit with code 1 if the documents are identical')
  .action(action);

export default command;
