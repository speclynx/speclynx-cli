import { Chalk } from 'chalk';
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver-types';

import type { Formatter, FormatterContext } from './types.ts';

// chalk detects TTYs and honors FORCE_COLOR, but ignores NO_COLOR. Follow
// Node.js's own rules on top of it: a non-empty NO_COLOR or NODE_DISABLE_COLORS
// disables colors, unless FORCE_COLOR is set (to any value), which wins.
const colorsDisabled =
  !('FORCE_COLOR' in process.env) &&
  Boolean(process.env.NO_COLOR || process.env.NODE_DISABLE_COLORS);
const chalk = colorsDisabled ? new Chalk({ level: 0 }) : new Chalk();

const severityToString = (severity: DiagnosticSeverity | undefined): string => {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return chalk.red('error');
    case DiagnosticSeverity.Warning:
      return chalk.yellow('warning');
    case DiagnosticSeverity.Information:
      return chalk.blue('info');
    case DiagnosticSeverity.Hint:
      return chalk.cyan('hint');
    default:
      return 'unknown';
  }
};

// A single `line:column` position, or `line:col-line:col` when the diagnostic
// spans a range.
const formatLocation = (diagnostic: Diagnostic): string => {
  const startLine = diagnostic.range.start.line + 1;
  const startCol = diagnostic.range.start.character + 1;
  const endLine = diagnostic.range.end.line + 1;
  const endCol = diagnostic.range.end.character + 1;

  if (startLine === endLine && startCol === endCol) {
    return `${startLine}:${startCol}`;
  }
  return `${startLine}:${startCol}-${endLine}:${endCol}`;
};

const pluralize = (word: string, count: number): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

// eslint/spectral-style "stylish" output: a file header, one aligned row per
// diagnostic (`location  severity  code  message`), and a severity-count
// summary. Colors are applied via chalk, which auto-disables on non-TTY output
// and when NO_COLOR or NODE_DISABLE_COLORS is set.
const stylish: Formatter = (diagnostics, context: FormatterContext): string => {
  if (diagnostics.length === 0) {
    return 'No problems found';
  }

  // Column widths for alignment (measured on the uncolored strings).
  const maxLocationLength = Math.max(...diagnostics.map((d) => formatLocation(d).length));
  const maxCodeLength = Math.max(...diagnostics.map((d) => (d.code ? String(d.code).length : 0)));

  const lines: string[] = [chalk.bold(context.path)];

  for (const diagnostic of diagnostics) {
    const location = chalk.dim(formatLocation(diagnostic).padEnd(maxLocationLength));
    const severity = severityToString(diagnostic.severity);
    const codeStr = diagnostic.code ? String(diagnostic.code) : '';
    const code = codeStr ? chalk.cyan(codeStr.padEnd(maxCodeLength)) : ' '.repeat(maxCodeLength);
    lines.push(`  ${location}  ${severity}  ${code}  ${diagnostic.message}`);
  }

  const counts = {
    error: diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error).length,
    warning: diagnostics.filter((d) => d.severity === DiagnosticSeverity.Warning).length,
    info: diagnostics.filter((d) => d.severity === DiagnosticSeverity.Information).length,
    hint: diagnostics.filter((d) => d.severity === DiagnosticSeverity.Hint).length,
  };
  const parts: string[] = [];
  if (counts.error > 0) parts.push(pluralize('error', counts.error));
  if (counts.warning > 0) parts.push(pluralize('warning', counts.warning));
  if (counts.info > 0) parts.push(pluralize('info', counts.info));
  if (counts.hint > 0) parts.push(pluralize('hint', counts.hint));

  const symbol = counts.error > 0 ? chalk.red('✖') : chalk.yellow('⚠');
  const breakdown = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  lines.push('');
  lines.push(`${symbol} ${pluralize('problem', diagnostics.length)}${breakdown}`);

  // The action caps diagnostics before formatting; note when a cap is in effect.
  if (context.total > diagnostics.length) {
    lines.push(chalk.dim(`(showing ${diagnostics.length} of ${context.total} problems)`));
  }

  return lines.join('\n');
};

export default stylish;
