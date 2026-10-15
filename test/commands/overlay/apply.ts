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
const fixtures = path.resolve(__dirname, '..', '..', 'fixtures', 'commands', 'overlay');
// openapi.json / openapi.yaml are valid documents shared with the validate tests.
const sharedFixtures = path.resolve(__dirname, '..', '..', 'fixtures');

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
        path.join(sharedFixtures, 'openapi.json'),
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.description).to.equal('Added by overlay');
      expect(result.info.title).to.equal('My API');
    });

    it('should output valid JSON by default for JSON target', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(sharedFixtures, 'openapi.json'),
      ]);
      expect(() => JSON.parse(stdout)).to.not.throw();
    });
  });

  describe('YAML input', function () {
    it('should apply overlay to YAML target', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.yaml'),
        path.join(sharedFixtures, 'openapi.yaml'),
      ]);
      expect(stdout).to.include('description: Added by overlay');
    });

    it('should auto-detect YAML output format from target extension', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.yaml'),
        path.join(sharedFixtures, 'openapi.yaml'),
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
        path.join(sharedFixtures, 'openapi.yaml'),
        '-f',
        'json',
      ]);
      expect(() => JSON.parse(stdout)).to.not.throw();
    });

    it('should force YAML output with -f yaml', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(sharedFixtures, 'openapi.json'),
        '-f',
        'yaml',
      ]);
      expect(stdout.trimStart()).to.not.match(/^\{/);
      expect(stdout).to.include('openapi:');
    });

    it('should reject invalid format values', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'overlay.json'),
        path.join(sharedFixtures, 'openapi.json'),
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
          path.join(sharedFixtures, 'openapi.json'),
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
        path.join(sharedFixtures, 'openapi.json'),
        '--overlay',
        path.join(fixtures, 'overlay-title.json'),
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.description).to.equal('Added by overlay');
      expect(result.info.title).to.equal('Updated Title');
    });
  });

  describe('Overlay 1.2.0 reusable actions', function () {
    it('should apply reusable action references alongside inline actions', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay-reusable.yaml'),
        path.join(sharedFixtures, 'openapi.json'),
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.description).to.equal('Added by reusable action');
      expect(result.info['x-reviewed']).to.equal(true);
      expect(result.info['x-inline']).to.equal(true);
    });

    it('should apply reusable action references in additional overlays', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay-title.json'),
        path.join(sharedFixtures, 'openapi.json'),
        '--overlay',
        path.join(fixtures, 'overlay-reusable.yaml'),
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.title).to.equal('Updated Title');
      expect(result.info.description).to.equal('Added by reusable action');
      expect(result.info['x-reviewed']).to.equal(true);
    });

    for (const position of ['first', 'additional']) {
      it(`should fail on an unresolvable reference in the ${position} overlay`, async function () {
        const unresolved = path.join(fixtures, 'overlay-reusable-unresolved.yaml');
        const args =
          position === 'first'
            ? [unresolved, path.join(sharedFixtures, 'openapi.json')]
            : [
                path.join(fixtures, 'overlay.json'),
                path.join(sharedFixtures, 'openapi.json'),
                '--overlay',
                unresolved,
              ];
        const { stdout, stderr, code } = await runExpectFailure(args);
        expect(code).to.not.equal(0);
        expect(stdout).to.equal('');
        expect(stderr).to.include('"#/components/actions/missing" cannot be resolved');
      });
    }

    it('should fail in strict mode when a referenced action matches zero nodes', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'overlay-reusable-nomatch.yaml'),
        path.join(sharedFixtures, 'openapi.json'),
        '--strict',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Action target "$.info.contact" matched zero nodes');
    });
  });

  describe('Overlay 1.1.0 copy action', function () {
    it('should copy a value to the target', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay-copy.yaml'),
        path.join(sharedFixtures, 'openapi.json'),
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.summary).to.equal('My API');
    });
  });

  describe('--strict option', function () {
    it('should succeed when all targets match', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(sharedFixtures, 'openapi.json'),
        '--strict',
      ]);
      const result = JSON.parse(stdout);
      expect(result.info.description).to.equal('Added by overlay');
    });

    it('should fail when a target matches zero nodes', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'overlay-nomatch.json'),
        path.join(sharedFixtures, 'openapi.json'),
        '--strict',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Error:');
    });

    it('should silently skip zero-match targets without --strict', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay-nomatch.json'),
        path.join(sharedFixtures, 'openapi.json'),
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
        path.join(sharedFixtures, 'openapi.json'),
        '--verbose',
      ]);
      expect(stderr).to.include('Overlay:');
      expect(stderr).to.include('[ok]');
      expect(stderr).to.include('update');
      expect(stderr).to.include('$.info');
      expect(stderr).to.include('Overlay was successfully applied');
    });

    it('should trace every action of a reusable actions overlay', async function () {
      const { stderr } = await run([
        path.join(fixtures, 'overlay-reusable.yaml'),
        path.join(sharedFixtures, 'openapi.json'),
        '--verbose',
      ]);
      expect(stderr.match(/\[ok\] update \$\.info \(1 matches\)/g)).to.have.length(3);
    });

    it('should trace copy actions', async function () {
      const { stderr } = await run([
        path.join(fixtures, 'overlay-copy.yaml'),
        path.join(sharedFixtures, 'openapi.json'),
        '--verbose',
      ]);
      expect(stderr).to.include('[ok] copy $.info.summary (1 matches)');
    });

    it('should print the trace up to the failing action', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'overlay-nomatch.json'),
        path.join(sharedFixtures, 'openapi.json'),
        '--strict',
        '--verbose',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Overlay: overlay-nomatch.json -> openapi.json');
      expect(stderr).to.include('[FAIL] noop $.info.contact.email (0 matches)');
      expect(stderr).to.not.include('Overlay was successfully applied');
      expect(stderr).to.include('Error:');
    });

    it('should print the trace of a failing additional overlay', async function () {
      const { stderr, code } = await runExpectFailure([
        path.join(fixtures, 'overlay.json'),
        path.join(sharedFixtures, 'openapi.json'),
        '--overlay',
        path.join(fixtures, 'overlay-reusable-nomatch.yaml'),
        '--strict',
        '--verbose',
      ]);
      expect(code).to.not.equal(0);
      expect(stderr).to.include('Overlay: overlay.json -> openapi.json');
      expect(stderr).to.include('Overlay: overlay-reusable-nomatch.yaml -> (previous result)');
      expect(stderr).to.include('[FAIL] noop $.info.contact (0 matches)');
    });

    it('should not print trace without --verbose', async function () {
      const { stderr } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(sharedFixtures, 'openapi.json'),
      ]);
      expect(stderr).to.equal('');
    });

    it('should still output result to stdout when verbose', async function () {
      const { stdout } = await run([
        path.join(fixtures, 'overlay.json'),
        path.join(sharedFixtures, 'openapi.json'),
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
        path.join(sharedFixtures, 'openapi.json'),
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
