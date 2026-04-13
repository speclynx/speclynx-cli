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
  return execFileAsync('node', [bin, 'overlay', 'apply', ...args]);
};

const runExpectFailure = async (
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> => {
  try {
    await execFileAsync('node', [bin, 'overlay', 'apply', ...args]);
    throw new Error('Expected command to fail');
  } catch (error: unknown) {
    const e = error as { stdout: string; stderr: string; code: number | null };
    return { stdout: e.stdout, stderr: e.stderr, code: e.code };
  }
};

describe('speclynx overlay apply', function () {
  describe('JSON input', function () {
    it('should apply overlay to JSON target', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'openapi.json'),
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.description).to.equal('Added by overlay');
      expect(result.info.title).to.equal('My API');
    });

    it('should output valid JSON by default for JSON target', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'openapi.json'),
      ]);
      expect(() => JSON.parse(stdout)).to.not.throw();
    });
  });

  describe('YAML input', function () {
    it('should apply overlay to YAML target', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.yaml'),
        path.join(fixtures, 'openapi.yaml'),
      ]);
      expect(stdout).to.include('description: Added by overlay');
    });

    it('should auto-detect YAML output format from target extension', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.yaml'),
        path.join(fixtures, 'openapi.yaml'),
      ]);
      // YAML output should not start with {
      expect(stdout.trimStart()).to.not.match(/^\{/);
      expect(stdout).to.include('openapi:');
    });
  });

  describe('extends field', function () {
    it('should resolve target from overlay extends field', async function () {
      const { stdout } = await run([path.join(fixtures, 'overlay-extends.json')]);
      const result = JSON.parse(stdout);
      expect(result.info.description).to.equal('Added via extends');
    });

    it('should auto-detect YAML format when extends resolves to YAML target', async function () {
      const { stdout } = await run([path.join(fixtures, 'overlay-extends.yaml')]);
      expect(stdout.trimStart()).to.not.match(/^\{/);
      expect(stdout).to.include('openapi:');
      expect(stdout).to.include('description: Added via extends');
    });
  });

  describe('--format option', function () {
    it('should force JSON output with -f json', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.yaml'),
        path.join(fixtures, 'openapi.yaml'),
        '-f',
        'json',
      ]);
      expect(() => JSON.parse(stdout)).to.not.throw();
    });

    it('should force YAML output with -f yaml', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'openapi.json'),
        '-f',
        'yaml',
      ]);
      expect(stdout.trimStart()).to.not.match(/^\{/);
      expect(stdout).to.include('openapi:');
    });

    it('should reject invalid format values', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'openapi.json'),
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
          path.join(fixtures, 'overlay.json'),
          path.join(fixtures, 'openapi.json'),
          '-o',
          tmpFile,
        ]);
        expect(stdout).to.equal('');
        const content = fs.readFileSync(tmpFile, 'utf-8');
        const result = JSON.parse(content);
        expect(result.info.description).to.equal('Added by overlay');
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    });
  });

  describe('--overlay option (sequential overlays)', function () {
    it('should apply multiple overlays sequentially', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'openapi.json'),
        '--overlay',
        path.join(fixtures, 'overlay-title.json'),
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.description).to.equal('Added by overlay');
      expect(result.info.title).to.equal('Updated Title');
    });
  });

  describe('--strict option', function () {
    it('should succeed when all targets match', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'openapi.json'),
        '--strict',
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.description).to.equal('Added by overlay');
    });

    it('should fail when a target matches zero nodes', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'overlay-nomatch.json'),
        path.join(fixtures, 'openapi.json'),
        '--strict',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Error:');
    });

    it('should silently skip zero-match targets without --strict', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay-nomatch.json'),
        path.join(fixtures, 'openapi.json'),
      ]);
      const result = JSON.parse(stdout);
      // original document unchanged
      expect(result.info.title).to.equal('My API');
      expect(result.info).to.not.have.property('contact');
    });
  });

  describe('--verbose option', function () {
    it('should print trace to stderr', async function () {
      const { stderr } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'openapi.json'),
        '--verbose',
      ]);
      expect(stderr).to.include('Overlay:');
      expect(stderr).to.include('[ok]');
      expect(stderr).to.include('update');
      expect(stderr).to.include('$.info');
      expect(stderr).to.include('Overlay was successfully applied');
    });

    it('should not print trace without --verbose', async function () {
      const { stderr } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'openapi.json'),
      ]);
      expect(stderr).to.equal('');
    });

    it('should still output result to stdout when verbose', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'openapi.json'),
        '--verbose',
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.description).to.equal('Added by overlay');
    });
  });

  describe('error handling', function () {
    it('should fail with non-existent overlay file', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'nonexistent.json'),
        path.join(fixtures, 'openapi.json'),
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Error:');
    });

    it('should fail with non-existent target file', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'overlay.json'),
        path.join(fixtures, 'nonexistent.json'),
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Error:');
    });
  });
});
