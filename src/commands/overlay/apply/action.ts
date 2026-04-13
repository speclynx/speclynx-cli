import path from 'node:path';
import fs from 'node:fs';
import { toJSON, toYAML } from '@speclynx/apidom-core';
import { parse } from '@speclynx/apidom-reference';
import {
  applyOverlay,
  applyOverlayApiDOM,
  type OverlayTrace,
  defaultApplyOverlayOptions,
} from '@speclynx/apidom-overlay';

import printTrace from './trace.ts';

export interface ApplyActionOptions {
  overlay?: string[];
  output?: string;
  format?: string;
  strict?: boolean;
  verbose?: boolean;
}

const action = async (
  overlayPath: string,
  targetPath: string | undefined,
  opts: ApplyActionOptions,
): Promise<void> => {
  try {
    const trace = {} as OverlayTrace;
    const applyOpts = {
      immutable: false,
      ...(opts.strict ? { strict: true } : {}),
      ...(opts.verbose ? { trace } : {}),
    };

    // apply first overlay — resolves target from arg or extends field
    const parseResult = await applyOverlay(
      path.resolve(overlayPath),
      targetPath ? path.resolve(targetPath) : undefined,
      applyOpts,
    );

    if (opts.verbose) {
      printTrace(overlayPath, targetPath ?? '(extends)', trace);
    }

    // apply additional overlays sequentially (in-memory, since target is already parsed)
    if (opts.overlay && opts.overlay.length > 0) {
      for (const additionalOverlay of opts.overlay) {
        const additionalTrace = {} as OverlayTrace;
        const additionalApplyOpts = {
          immutable: false,
          ...(opts.strict ? { strict: true } : {}),
          ...(opts.verbose ? { trace: additionalTrace } : {}),
        };
        const overlayParseResult = await parse(
          path.resolve(additionalOverlay),
          defaultApplyOverlayOptions.reference,
        );
        applyOverlayApiDOM(overlayParseResult, parseResult, additionalApplyOpts);

        if (opts.verbose) {
          printTrace(additionalOverlay, '(previous result)', additionalTrace);
        }
      }
    }

    const resultElement = parseResult.result!;

    // determine output format from target extension or explicit flag
    const format = opts.format ?? (targetPath?.match(/\.ya?ml$/i) ? 'yaml' : 'json');

    let output: string;
    if (format === 'yaml') {
      output = toYAML(resultElement, { preserveStyle: true });
    } else {
      output = toJSON(resultElement, undefined, 2, { preserveStyle: true });
    }

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
