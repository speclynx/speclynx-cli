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

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> => {
  return execFileAsync('node', [bin, 'validate', ...args]);
};

const runExpectFailure = async (
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> => {
  try {
    await execFileAsync('node', [bin, 'validate', ...args]);
    throw new Error('Expected command to fail');
  } catch (error: unknown) {
    const e = error as { stdout: string; stderr: string; code: number | null };
    return { stdout: e.stdout, stderr: e.stderr, code: e.code };
  }
};

describe('speclynx validate', function () {
  describe('valid documents', function () {
    it('should report no problems for a valid JSON document', async function () {
      const { stderr } = await run([path.join(sharedFixtures, 'openapi.json')]);
      expect(stderr).to.include('No problems found');
    });

    it('should report no problems for a valid YAML document', async function () {
      const { stderr } = await run([path.join(sharedFixtures, 'openapi.yaml')]);
      expect(stderr).to.include('No problems found');
    });

    it('should exit 0 and write nothing to stdout for a valid document', async function () {
      const { stdout } = await run([path.join(sharedFixtures, 'openapi.json')]);
      expect(stdout).to.equal('');
    });
  });

  describe('invalid documents', function () {
    it('should fail with diagnostics for an invalid JSON document', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'openapi-invalid.json'),
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('error');
      expect(stderr).to.include("should always have a 'title'");
    });

    it('should fail with diagnostics for an invalid YAML document', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'openapi-invalid.yaml'),
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('error');
    });

    it('should report a 1-based line:column location', async function () {
      const { stderr } = await runExpectFailure([path.join(fixtures, 'openapi-invalid.json')]);
      expect(stderr).to.match(/openapi-invalid\.json:\d+:\d+/);
    });
  });

  describe('--json option', function () {
    it('should emit an empty diagnostics array for a valid document', async function () {
      const { stdout } = await run([path.join(sharedFixtures, 'openapi.json'), '--json']);
      const diagnostics = JSON.parse(stdout);
      expect(diagnostics).to.be.an('array').that.is.empty;
    });

    it('should emit a non-empty diagnostics array for an invalid document', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-invalid.json'),
        '--json',
      ]);
      const diagnostics = JSON.parse(stdout);
      expect(diagnostics).to.be.an('array').that.is.not.empty;
      expect(diagnostics[0]).to.have.property('message');
      expect(diagnostics[0]).to.have.property('range');
      expect(diagnostics[0]).to.have.property('severity');
    });
  });

  describe('--json-schema-validation option', function () {
    it('should not run AJV validation by default', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-schema-invalid.json'),
        '--json',
      ]);
      const diagnostics = JSON.parse(stdout);
      const sources = diagnostics.map((diagnostic: { source?: string }) => diagnostic.source);
      expect(sources).to.not.include('OpenAPI 3.1 Schema');
    });

    it('should run AJV validation when enabled', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-schema-invalid.json'),
        '--json-schema-validation',
        '--json',
      ]);
      const diagnostics = JSON.parse(stdout);
      const sources = diagnostics.map((diagnostic: { source?: string }) => diagnostic.source);
      expect(sources).to.include('OpenAPI 3.1 Schema');
    });
  });

  describe('--no-* options', function () {
    it('should not report lint problems when semantic linting is disabled', async function () {
      const { stderr } = await run([
        path.join(fixtures, 'openapi-invalid.json'),
        '--no-semantic-validation',
        '--no-semantic-linting',
        '--no-reference-validation',
      ]);
      expect(stderr).to.include('No problems found');
    });
  });

  describe('--max-problems option', function () {
    it('should cap the number of reported diagnostics', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-many-problems.json'),
        '--max-problems',
        '1',
        '--json',
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

  describe('--strict option', function () {
    it('should exit 0 for a document with only warnings by default', async function () {
      const { stderr } = await run([path.join(fixtures, 'openapi-warnings.yaml')]);
      expect(stderr).to.include('warning');
    });

    it('should exit non-zero for warnings under --strict', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'openapi-warnings.yaml'),
        '--strict',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('warning');
    });
  });

  describe('--better-ajv-errors option', function () {
    it('should produce more descriptive AJV messages', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-schema-invalid.json'),
        '--json-schema-validation',
        '--better-ajv-errors',
        '--json',
      ]);
      const diagnostics = JSON.parse(stdout);
      const messages = diagnostics.map((diagnostic: { message?: string }) => diagnostic.message);
      expect(messages).to.include('"get" property type must be object');
    });
  });

  describe('large output', function () {
    it('should emit complete, parseable JSON well beyond the pipe buffer size', async function () {
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-many-problems.json'),
        '--json',
      ]);
      expect(stdout.length).to.be.greaterThan(65536);
      const diagnostics = JSON.parse(stdout);
      expect(diagnostics).to.be.an('array').that.has.length.greaterThan(1);
    });
  });

  describe('supported specifications', function () {
    it('should validate an invalid AsyncAPI 2.x document', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'asyncapi-invalid.yaml'),
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('error');
    });

    it('should validate an invalid Arazzo 1.x document', async function () {
      const { stderr, code } = await runExpectFailure([path.join(fixtures, 'arazzo-invalid.yaml')]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('error');
    });

    it('should validate an invalid Overlay 1.x document', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'overlay-invalid.yaml'),
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('error');
    });
  });

  describe('reference resolution base URI', function () {
    it('should resolve relative external refs against the input file by default', async function () {
      // Without a file-anchored base URI, a relative external $ref resolves over
      // HTTP; the diagnostic must instead reference the sibling file's file:// URI.
      const { stdout } = await runExpectFailure([
        path.join(fixtures, 'openapi-external-ref.yaml'),
        '--reference-validation-mode',
        'indirect-external',
        '--json',
      ]);
      const diagnostics = JSON.parse(stdout);
      const messages = diagnostics
        .map((diagnostic: { message?: string }) => diagnostic.message ?? '')
        .join('\n');
      expect(messages).to.include('openapi-external-ref-thing.yaml');
      expect(messages).to.include('file://');
      expect(messages).to.not.include('http');
    });
  });

  describe('error handling', function () {
    it('should fail for a non-existent file', async function () {
      const { stderr, code } = await runExpectFailure([path.join(fixtures, 'nonexistent.json')]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Error:');
    });

    it('should reject an invalid reference validation mode', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(sharedFixtures, 'openapi.json'),
        '--reference-validation-mode',
        'bogus',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Allowed choices are legacy, indirect, indirect-external');
    });
  });
});
