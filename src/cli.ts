import { createRequire } from 'node:module';
import { Command } from 'commander';

import overlay from './commands/overlay/index.ts';
import validate from './commands/validate/index.ts';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export const program = new Command();

program
  .name('speclynx')
  .description(
    'Validate, overlay, and reshape your API specs with one consistent toolchain, from the command line.',
  )
  .version(version);

program.addCommand(overlay);
program.addCommand(validate);
