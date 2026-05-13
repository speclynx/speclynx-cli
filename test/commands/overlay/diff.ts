import { expect } from 'chai';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bin = path.resolve(__dirname, '..', '..', '..', 'bin', 'speclynx.mjs');
const fixtures = path.resolve(__dirname, '..', '..', 'fixtures');

const run = (args: string[]): Promise<{ stdout: string; stderr: string }> => {
  return execFileAsync('node', [bin, 'overlay', 'diff', ...args]);
};

const runExpectFailure = async (
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> => {
  try {
    await execFileAsync('node', [bin, 'overlay', 'diff', ...args]);
    throw new Error('Expected command to fail');
  } catch (error: unknown) {
    const e = error as { stdout: string; stderr: string; code: number | null };
    return { stdout: e.stdout, stderr: e.stderr, code: e.code };
  }
};

describe('speclynx overlay diff', function () {
  describe('JSON input', function () {
    it('should produce a valid JSON overlay', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'openapi.json'),
        path.join(fixtures, 'openapi-after.json'),
      ]);
      const result = JSON.parse(stdout);
      expect(result).to.have.property('overlay');
      expect(result).to.have.property('actions').that.is.an('array').with.length.greaterThan(0);
    });

    it('should output valid JSON by default for JSON input', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'openapi.json'),
        path.join(fixtures, 'openapi-after.json'),
      ]);
      expect(() => JSON.parse(stdout)).to.not.throw();
    });
  });

  describe('YAML input', function () {
    it('should produce a YAML overlay for YAML input', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'openapi.yaml'),
        path.join(fixtures, 'openapi-after.yaml'),
      ]);
      expect(stdout.trimStart()).to.not.match(/^\{/);
      expect(stdout).to.include('overlay:');
      expect(stdout).to.include('actions:');
    });

    it('should auto-detect YAML output format from before extension', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'openapi.yaml'),
        path.join(fixtures, 'openapi-after.yaml'),
      ]);
      expect(stdout.trimStart()).to.not.match(/^\{/);
    });
  });

  describe('--format option', function () {
    it('should force JSON output with -f json for YAML input', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'openapi.yaml'),
        path.join(fixtures, 'openapi-after.yaml'),
        '-f',
        'json',
      ]);
      expect(() => JSON.parse(stdout)).to.not.throw();
    });

    it('should force YAML output with -f yaml for JSON input', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'openapi.json'),
        path.join(fixtures, 'openapi-after.json'),
        '-f',
        'yaml',
      ]);
      expect(stdout.trimStart()).to.not.match(/^\{/);
      expect(stdout).to.include('overlay:');
    });

    it('should reject invalid format values', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'openapi.json'),
        path.join(fixtures, 'openapi-after.json'),
        '-f',
        'xml',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Allowed choices are json, yaml');
    });
  });

  describe('--output option', function () {
    it('should write result to file', async function () {
      const tmpFile = path.join(os.tmpdir(), `speclynx-test-${Date.now()}.json`);
      try {
        const { stdout } = await run([
          path.join(fixtures, 'openapi.json'),
          path.join(fixtures, 'openapi-after.json'),
          '-o',
          tmpFile,
        ]);
        expect(stdout).to.equal('');
        const content = fs.readFileSync(tmpFile, 'utf-8');
        const result = JSON.parse(content);
        expect(result).to.have.property('overlay');
        expect(result).to.have.property('actions').that.is.an('array');
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    });
  });

  describe('--fail-on-empty option', function () {
    it('should succeed when docs differ', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'openapi.json'),
        path.join(fixtures, 'openapi-after.json'),
        '--fail-on-empty',
      ]);
      expect(() => JSON.parse(stdout)).to.not.throw();
    });

    it('should fail with a descriptive message when docs are identical', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'openapi.json'),
        path.join(fixtures, 'openapi.json'),
        '--fail-on-empty',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('documents are identical');
    });

    it('should produce an empty actions overlay when docs are identical without --fail-on-empty', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'openapi.json'),
        path.join(fixtures, 'openapi.json'),
      ]);
      const result = JSON.parse(stdout);
      expect(result).to.have.property('actions').that.is.an('array').with.length(0);
    });
  });

  describe('error handling', function () {
    it('should fail with non-existent before file', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'nonexistent.json'),
        path.join(fixtures, 'openapi-after.json'),
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Error:');
    });

    it('should fail with non-existent after file', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'openapi.json'),
        path.join(fixtures, 'nonexistent.json'),
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Error:');
    });
  });
});
