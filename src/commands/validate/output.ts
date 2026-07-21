import path from 'node:path';
import fs from 'node:fs';

import stripAnsi from './strip-ansi.ts';

// Write the formatted diagnostics report to its destination. stdout is the
// default (stderr stays reserved for hard errors); a path from -o/--output
// redirects it to a file instead.
//
// Only the stylish formatter emits chalk colors, and it keys them on
// process.stdout's TTY state — unaware the bytes are being written to a file.
// So ANSI is stripped for file output only; the json formatter emits none and
// is written exactly as rendered, and stdout keeps its colors for the terminal.
const writeReport = (rendered: string, format: string, outputPath?: string): void => {
  if (!outputPath) {
    process.stdout.write(rendered);
    return;
  }

  const absPath = path.resolve(outputPath);
  const payload = format === 'json' ? rendered : stripAnsi(rendered);
  try {
    fs.writeFileSync(absPath, payload, 'utf-8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to write ${absPath}: ${message}`);
  }
};

export default writeReport;
