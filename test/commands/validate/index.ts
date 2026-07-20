import { expect } from 'chai';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bin = path.resolve(__dirname, '..', '..', '..', 'bin', 'speclynx.mjs');
const fixtures = path.resolve(__dirname, '..', '..', 'fixtures', 'commands', 'validate');
// openapi.json / openapi.yaml are valid documents shared with the overlay tests.
const sharedFixtures = path.resolve(__dirname, '..', '..', 'fixtures');

// Force NO_COLOR so the stylish formatter's chalk output is deterministic
// regardless of the runner's TTY/FORCE_COLOR environment.
const env = { ...process.env, NO_COLOR: '1' };

const run = (args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> => {
  return execFileAsync('node', [bin, 'validate', ...args], { env, cwd });
};

const runExpectFailure = async (
  args: string[],
  cwd?: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> => {
  try {
    await execFileAsync('node', [bin, 'validate', ...args], { env, cwd });
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

  describe('--output option', function () {
    it('should write the report to a file instead of stdout', async function () {
      const tmpFile = path.join(os.tmpdir(), `speclynx-validate-test-${Date.now()}.txt`);
      try {
        const { stdout } = await run([path.join(sharedFixtures, 'openapi.json'), '-o', tmpFile]);
        expect(stdout).to.equal('');
        const content = fs.readFileSync(tmpFile, 'utf-8');
        expect(content).to.include('No problems found');
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    });

    it('should write JSON diagnostics to a file without affecting the exit code', async function () {
      const tmpFile = path.join(os.tmpdir(), `speclynx-validate-test-${Date.now()}.json`);
      try {
        const { stdout, code } = await runExpectFailure([
          path.join(fixtures, 'openapi-invalid.json'),
          '--format',
          'json',
          '--output',
          tmpFile,
        ]);
        expect(code).to.not.equal(0);
        expect(stdout).to.equal('');
        const diagnostics = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
        expect(diagnostics).to.be.an('array').that.is.not.empty;
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    });

    it('should fail when the output file cannot be written', async function () {
      const badPath = path.join(os.tmpdir(), `speclynx-validate-missing-${Date.now()}`, 'out.json');
      const { stderr, code } = await runExpectFailure([
        path.join(sharedFixtures, 'openapi.json'),
        '-o',
        badPath,
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Error:');
    });

    it('should refuse to overwrite the input document and leave it untouched', async function () {
      const specFile = path.join(os.tmpdir(), `speclynx-validate-input-${Date.now()}.json`);
      const original = fs.readFileSync(path.join(sharedFixtures, 'openapi.json'), 'utf-8');
      fs.writeFileSync(specFile, original, 'utf-8');
      try {
        const { stderr, code } = await runExpectFailure([specFile, '-o', specFile]);
        expect(code).to.not.equal(0);
        expect(stderr).to.include('must differ from the input file');
        // The input document must be preserved byte-for-byte.
        expect(fs.readFileSync(specFile, 'utf-8')).to.equal(original);
      } finally {
        if (fs.existsSync(specFile)) {
          fs.unlinkSync(specFile);
        }
      }
    });

    it('should never write ANSI color codes to a file, even under FORCE_COLOR', async function () {
      const tmpFile = path.join(os.tmpdir(), `speclynx-validate-color-${Date.now()}.txt`);
      try {
        // FORCE_COLOR would make chalk emit ANSI on stdout; the file must stay plain.
        await execFileAsync(
          'node',
          [bin, 'validate', path.join(fixtures, 'openapi-invalid.json'), '-o', tmpFile],
          { env: { ...process.env, FORCE_COLOR: '1', NO_COLOR: undefined } },
        ).catch((error: unknown) => error); // non-zero exit expected (diagnostics fail the run)
        const content = fs.readFileSync(tmpFile, 'utf-8');
        // No ANSI escape sequences (ESC, U+001B) may reach a file.
        expect(content).to.not.include(String.fromCharCode(27));
        expect(content).to.include("should always have a 'title'");
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
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

  describe('input URIs', function () {
    // Serve `handler` on an ephemeral loopback port for the duration of `body`,
    // always closing the server afterward (even if the assertion throws).
    const withServer = async (
      handler: http.RequestListener,
      body: (baseUrl: string) => Promise<void>,
    ): Promise<void> => {
      const server = http.createServer(handler);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      try {
        const { port } = server.address() as AddressInfo;
        await body(`http://127.0.0.1:${port}`);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    };

    it('should accept a file:// URL to a JSON document', async function () {
      const { stdout } = await run([pathToFileURL(path.join(sharedFixtures, 'openapi.json')).href]);
      expect(stdout).to.include('No problems found');
    });

    it('should accept a file:// URL to a YAML document', async function () {
      // Exercises extension-based languageId detection for the file scheme.
      const { stdout } = await run([pathToFileURL(path.join(sharedFixtures, 'openapi.yaml')).href]);
      expect(stdout).to.include('No problems found');
    });

    it('should accept a single-slash file: URL', async function () {
      // file:/path (one slash) is a legal but uncommon form; it must normalize to
      // the same document as the triple-slash form.
      const triple = pathToFileURL(path.join(sharedFixtures, 'openapi.json')).href;
      const single = triple.replace(/^file:\/\//, 'file:');
      const { stdout } = await run([single]);
      expect(stdout).to.include('No problems found');
    });

    it('should accept a dotfile basename', async function () {
      // A leading-dot basename (.openapi.json) is a valid local path that the file
      // resolver's allow-list must still match — a plain '*' glob would not.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speclynx-'));
      const dotfile = path.join(dir, '.openapi.json');
      fs.copyFileSync(path.join(sharedFixtures, 'openapi.json'), dotfile);
      try {
        const { stdout } = await run([dotfile]);
        expect(stdout).to.include('No problems found');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('should resolve a relative path against the cwd, not the document', async function () {
      // Run from a directory unrelated to the fixture and pass a relative path to
      // an INVALID document: the non-empty diagnostics prove the bytes at the
      // relative location were actually read and parsed (a missing or unrelated
      // file would not produce this document's errors), guarding the bare-path →
      // absolute file:// URL branch that no absolute-path test hits.
      const cwd = path.dirname(fixtures);
      const relative = path.relative(cwd, path.join(fixtures, 'openapi-invalid.yaml'));
      const { stdout, code } = await runExpectFailure([relative, '--format', 'json'], cwd);
      expect(code).to.not.equal(0);
      expect(JSON.parse(stdout)).to.be.an('array').that.is.not.empty;
    });

    it('should fetch and validate a document over http', async function () {
      const body = fs.readFileSync(path.join(sharedFixtures, 'openapi.yaml'));
      await withServer(
        (_req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/yaml' });
          res.end(body);
        },
        async (baseUrl) => {
          const { stdout } = await run([`${baseUrl}/openapi.yaml`]);
          expect(stdout).to.include('No problems found');
        },
      );
    });

    it('should detect YAML from an http URL carrying a query string', async function () {
      // The languageId regex has a dedicated branch for a query/fragment suffix;
      // the URL extension (not the Content-Type) decides how the body is parsed.
      const body = fs.readFileSync(path.join(sharedFixtures, 'openapi.yaml'));
      await withServer(
        (_req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(body);
        },
        async (baseUrl) => {
          const { stdout } = await run([`${baseUrl}/openapi.yaml?v=1`]);
          expect(stdout).to.include('No problems found');
        },
      );
    });

    it('should fail with a clean error when an http URL 404s', async function () {
      await withServer(
        (_req, res) => {
          res.writeHead(404);
          res.end('not found');
        },
        async (baseUrl) => {
          const { stderr, code } = await runExpectFailure([`${baseUrl}/missing.yaml`]);
          expect(code).to.not.equal(0);
          expect(stderr).to.include('Error:');
        },
      );
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
