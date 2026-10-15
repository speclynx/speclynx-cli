import path from 'node:path';
import type { OverlayTrace } from '@speclynx/apidom-overlay';

const printTrace = (overlayFile: string, targetFile: string, trace: OverlayTrace): void => {
  const stderr = process.stderr;
  const overlay = path.basename(overlayFile);
  const target = targetFile.startsWith('(') ? targetFile : path.basename(targetFile);
  stderr.write(`Overlay: ${overlay} -> ${target}\n`);

  for (const action of trace.actions) {
    const status = action.success ? 'ok' : 'FAIL';
    stderr.write(`  [${status}] ${action.type} ${action.target} (${action.matchCount} matches)\n`);
    if (!action.success && action.error) {
      stderr.write(`         ${action.error.message}\n`);
    }
  }

  // on failure the message repeats the failed action's error, which is already printed above
  if (!trace.failed) {
    stderr.write(`  ${trace.message}\n`);
  }
  stderr.write('\n');
};

export default printTrace;
