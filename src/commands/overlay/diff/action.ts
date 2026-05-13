import path from 'node:path';
import fs from 'node:fs';
import { toJSON, toYAML, toValue } from '@speclynx/apidom-core';
import { diffOverlay } from '@speclynx/apidom-overlay';

export interface DiffActionOptions {
  output?: string;
  format?: string;
  failOnEmpty?: boolean;
}

const action = async (
  beforePath: string,
  afterPath: string,
  opts: DiffActionOptions,
): Promise<void> => {
  try {
    const overlay = await diffOverlay(path.resolve(beforePath), path.resolve(afterPath));

    const overlayValue = toValue(overlay) as Record<string, unknown>;
    if (
      opts.failOnEmpty &&
      Array.isArray(overlayValue.actions) &&
      overlayValue.actions.length === 0
    ) {
      process.stderr.write(`Error: documents are identical — no overlay actions were generated\n`);
      process.exit(1);
    }

    const format = opts.format ?? (beforePath.match(/\.ya?ml$/i) ? 'yaml' : 'json');
    const output =
      format === 'yaml'
        ? toYAML(overlay, { preserveStyle: true })
        : toJSON(overlay, undefined, 2, { preserveStyle: true });

    if (opts.output) {
      fs.writeFileSync(path.resolve(opts.output), output, 'utf-8');
    } else {
      process.stdout.write(output);
      process.stdout.write('\n');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }
};

export default action;
