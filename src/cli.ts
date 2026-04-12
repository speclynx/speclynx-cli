import { createRequire } from 'node:module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export const program = new Command();

program.name('speclynx').description('SpecLynx CLI for API specification tooling').version(version);

program.parse();
