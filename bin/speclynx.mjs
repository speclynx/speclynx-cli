#!/usr/bin/env node

import { program } from '../src/cli.mjs';

// exit quietly when stdout is closed early (e.g. piped to `head`)
process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') {
    process.exit(0);
  }
  throw error;
});

program.parse();
