import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const lock = readFileSync(new URL('./requirements-browser.txt', import.meta.url), 'utf8');

function validate(ci, requirements) {
  assert.match(ci, /runs-on: ubuntu-24\.04\b/);
  assert.match(ci, /python3\.12 -m venv/);
  const installs = ci.split('\n').filter(line => /\bpip["']?\s+install\b/.test(line));
  assert.equal(installs.length, 2, 'both browser jobs use locked Python installs');
  for (const flag of ['--no-cache-dir', '--only-binary=:all:', '--require-hashes', '-r tests/requirements-browser.txt']) {
    assert.ok(installs.every(line => line.includes(flag)), `every Python install requires ${flag}`);
  }
  assert.match(ci, /-m playwright install --with-deps chromium/);
  const entries = requirements.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  const names = entries.map(line => {
    const match = /^([a-z_]+)==\d+\.\d+\.\d+ --hash=sha256:[a-f0-9]{64}$/.exec(line);
    assert.ok(match, 'every requirement must pin a version and SHA256');
    return match[1];
  });
  assert.deepEqual(names.sort(), ['greenlet', 'playwright', 'pyee', 'typing_extensions']);
}

test('CI browser harness uses a complete hashed wheel lock', () => validate(workflow, lock));
test('browser lock gate rejects unverified installs and incomplete pins', () => {
  for (const flag of ['--require-hashes', '--no-cache-dir', '--only-binary=:all:', '-r tests/requirements-browser.txt']) {
    assert.throws(() => validate(workflow.replace(flag, ''), lock));
  }
  assert.throws(() => validate(workflow + '\n      - run: pip install playwright', lock));
  assert.throws(() => validate(workflow, lock.replace(/ --hash=sha256:[a-f0-9]{64}/, '')));
  assert.throws(() => validate(workflow, lock.replace(/==\d+\.\d+\.\d+/, '')));
  assert.throws(() => validate(workflow, lock.replace(/^pyee==.*\n/m, '')));
});
