import { expect } from 'chai';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bin = path.resolve(__dirname, '..', '..', '..', 'bin', 'speclynx.mjs');
const fixtures = path.resolve(__dirname, '..', '..', 'fixtures', 'commands', 'validate');
// openapi.json / openapi.yaml are valid documents shared with the overlay tests.
const sharedFixtures = path.resolve(__dirname, '..', '..', 'fixtures');

// Force NO_COLOR so the stylish formatter's chalk output is deterministic
// regardless of the runner's TTY/FORCE_COLOR environment.
const env = { ...process.env, NO_COLOR: '1' };

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> => {
  return execFileAsync('node', [bin, 'validate', ...args], { env });
};

const runExpectFailure = async (
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> => {
  try {
    await execFileAsync('node', [bin, 'validate', ...args], { env });
    throw new Error('Expected command to fail');
  } catch (error: unknown) {
    const e = error as { stdout: string; stderr: string; code: number | null };
    return { stdout: e.stdout, stderr: e.stderr, code: e.code };
  }
};

describe('speclynx validate', function () {
  describe('valid documents', function () {
    it('should report no problems for a valid JSON document', async function () {
      const { stdout } = await run([path.join(sharedFixtures, 'openapi.json')]);
      expect(stdout).to.include('No problems found');
    });

    it('should report no problems for a valid YAML document', async function () {
      const { stdout } = await run([path.join(sharedFixtures, 'openapi.yaml')]);
      expect(stdout).to.include('No problems found');
    });

    it('should write nothing to stderr for a valid document', async function () {
      const { stderr } = await run([path.join(sharedFixtures, 'openapi.json')]);
      expect(stderr).to.equal('');
    });
  });

  describe('invalid documents', function () {
    it('should fail with diagnostics for an invalid JSON document', async function () {
      const { stdout, code } = await runExpectFailure([
        path.join(fixtures, 'openapi-invalid.json'),
      ]);
      expect(code).to.not.equal(0);
      expect(stdout).to.include('error');
      expect(stdout).to.include("should always have a 'title'");
    });

    it('should fail with diagnostics for an invalid YAML document', async function () {
      const { stdout, code } = await runExpectFailure([
        path.join(fixtures, 'openapi-invalid.yaml'),
      ]);
      expect(code).to.not.equal(0);
      expect(stdout).to.include('error');
    });

    it('should report the file and a 1-based line:column location', async function () {
      const { stdout } = await runExpectFailure([path.join(fixtures, 'openapi-invalid.json')]);
      // stylish output: a file header followed by indented `line:column` rows.
      expect(stdout).to.include('openapi-invalid.json');
      expect(stdout).to.match(/^\s+\d+:\d+.*\berror\b/m);
    });
  });

  describe('--format option', function () {
    it('should default to the stylish formatter', async function () {
      const { stdout } = await runExpectFailure([path.join(fixtures, 'openapi-invalid.json')]);
      expect(stdout).to.include('openapi-invalid.json');
      expect(stdout).to.match(/✖ \d+ problem/);
    });

    it('should render diagnostics as JSON with --format json', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-invalid.json'),
        '--format',
        'json',
      ]);
      const diagnostics = JSON.parse(stdout);
      expect(diagnostics).to.be.an('array').that.is.not.empty;
      expect(diagnostics[0]).to.have.property('message');
      expect(diagnostics[0]).to.have.property('range');
      expect(diagnostics[0]).to.have.property('severity');
    });

    it('should emit an empty JSON array for a valid document', async function () {
      const { stdout } = await run([path.join(sharedFixtures, 'openapi.json'), '--format', 'json']);
      const diagnostics = JSON.parse(stdout);
      expect(diagnostics).to.be.an('array').that.is.empty;
    });

    it('should treat --json as shorthand for --format json', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-invalid.json'),
        '--json',
      ]);
      const diagnostics = JSON.parse(stdout);
      expect(diagnostics).to.be.an('array').that.is.not.empty;
      expect(diagnostics[0]).to.have.property('range');
    });

    it('should let --json win over --format', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-invalid.json'),
        '--format',
        'stylish',
        '--json',
      ]);
      expect(() => JSON.parse(stdout)).to.not.throw();
    });

    it('should reject an unknown format', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(sharedFixtures, 'openapi.json'),
        '--format',
        'bogus',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Allowed choices are stylish, json');
    });
  });

  describe('--json-schema-validation option', function () {
    it('should not run AJV validation by default', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-schema-invalid.json'),
        '--format',
        'json',
      ]);
      const diagnostics = JSON.parse(stdout);
      const sources = diagnostics.map((diagnostic: { source?: string }) => diagnostic.source);
      expect(sources).to.not.include('OpenAPI 3.1 Schema');
    });

    it('should run AJV validation when enabled', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-schema-invalid.json'),
        '--json-schema-validation',
        '--format',
        'json',
      ]);
      const diagnostics = JSON.parse(stdout);
      const sources = diagnostics.map((diagnostic: { source?: string }) => diagnostic.source);
      expect(sources).to.include('OpenAPI 3.1 Schema');
    });
  });

  describe('--max-problems option', function () {
    it('should cap the number of reported diagnostics', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-many-problems.json'),
        '--max-problems',
        '1',
        '--format',
        'json',
      ]);
      const diagnostics = JSON.parse(stdout);
      expect(diagnostics).to.have.lengthOf(1);
    });

    it('should still exit non-zero when the cap hides errors', async function () {
      const { code } = await runExpectFailure([
        path.join(fixtures, 'openapi-many-problems.json'),
        '--max-problems',
        '1',
      ]);
      expect(code).to.not.equal(0);
    });

    it('should reject a non-numeric value', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(sharedFixtures, 'openapi.json'),
        '--max-problems',
        'abc',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('must be a positive integer');
    });
  });

  describe('--fail-severity option', function () {
    it('should exit 0 for a document with only warnings by default', async function () {
      const { stdout } = await run([path.join(fixtures, 'openapi-warnings.yaml')]);
      expect(stdout).to.include('warning');
    });

    it('should exit non-zero for warnings with --fail-severity warning', async function () {
      const { stdout, code } = await runExpectFailure([
        path.join(fixtures, 'openapi-warnings.yaml'),
        '--fail-severity',
        'warning',
      ]);
      expect(code).to.not.equal(0);
      expect(stdout).to.include('warning');
    });

    it('should reject an unknown severity', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(sharedFixtures, 'openapi.json'),
        '--fail-severity',
        'bogus',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Allowed choices are error, warning, info, hint');
    });
  });

  describe('JSON Schema validation', function () {
    it('should produce descriptive AJV messages with --json-schema-validation', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-schema-invalid.json'),
        '--json-schema-validation',
        '--format',
        'json',
      ]);
      const diagnostics = JSON.parse(stdout);
      const messages = diagnostics.map((diagnostic: { message?: string }) => diagnostic.message);
      expect(messages).to.include('"get" property type must be object');
    });

    it('should not run AJV validation without the flag', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'asyncapi-invalid.yaml'),
        '--format',
        'json',
      ]);
      const diagnostics = JSON.parse(stdout);
      const sources = diagnostics.map((diagnostic: { source?: string }) => diagnostic.source);
      expect(sources).to.not.include('asyncapi schema');
    });

    it('should run AJV validation for AsyncAPI with --json-schema-validation', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'asyncapi-invalid.yaml'),
        '--json-schema-validation',
        '--format',
        'json',
      ]);
      const diagnostics = JSON.parse(stdout);
      const sources = diagnostics.map((diagnostic: { source?: string }) => diagnostic.source);
      expect(sources).to.include('asyncapi schema');
    });
  });

  describe('reference validation', function () {
    it('should flag an unresolvable $ref by default', async function () {
      // reference validation runs without any opt-in flag
      const { stdout, code } = await runExpectFailure([
        path.join(fixtures, 'openapi-broken-ref.json'),
      ]);
      expect(code).to.not.equal(0);
      expect(stdout).to.include('local reference not found');
    });
  });

  describe('large output', function () {
    it('should emit complete, parseable JSON well beyond the pipe buffer size', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-many-problems.json'),
        '--format',
        'json',
      ]);
      expect(stdout.length).to.be.greaterThan(65536);
      const diagnostics = JSON.parse(stdout);
      expect(diagnostics).to.be.an('array').that.has.length.greaterThan(1);
    });
  });

  describe('supported specifications', function () {
    it('should validate an invalid AsyncAPI 2.x document', async function () {
      const { stdout, code } = await runExpectFailure([
        path.join(fixtures, 'asyncapi-invalid.yaml'),
      ]);
      expect(code).to.not.equal(0);
      expect(stdout).to.include('error');
    });

    it('should validate an invalid Arazzo 1.x document', async function () {
      const { stdout, code } = await runExpectFailure([path.join(fixtures, 'arazzo-invalid.yaml')]);
      expect(code).to.not.equal(0);
      expect(stdout).to.include('error');
    });

    it('should validate an invalid Overlay 1.x document', async function () {
      const { stdout, code } = await runExpectFailure([
        path.join(fixtures, 'overlay-invalid.yaml'),
      ]);
      expect(code).to.not.equal(0);
      expect(stdout).to.include('error');
    });
  });

  describe('error handling', function () {
    it('should fail for a non-existent file', async function () {
      const { stderr, code } = await runExpectFailure([path.join(fixtures, 'nonexistent.json')]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Error:');
    });

    it('should reject an unknown option', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(sharedFixtures, 'openapi.json'),
        '--no-semantic-validation',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('unknown option');
    });
  });
});
