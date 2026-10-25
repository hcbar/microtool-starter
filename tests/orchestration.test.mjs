import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const document = readFileSync(new URL('../docs/orchestration.md', import.meta.url), 'utf8');
const names = ['SCOPED', 'ASSIGNED', 'IMPLEMENTED', 'CI_PASSED', 'REVIEWED', 'APPROVED', 'RELEASED'];
const actors = ['coordinator', 'coordinator', 'implementer', 'ci', 'independent_reviewer', 'owner', 'release_operator'];
const evidence = [
  ['task', 'scope', 'acceptance', 'authorization'],
  ['executor', 'base'],
  ['sha', 'pr', 'files', 'local_checks', 'limits', 'human_gates'],
  ['sha', 'check_urls', 'required_checks_passed'],
  ['sha', 'reviewer', 'review_url', 'findings', 'blocking_findings_resolved'],
  ['sha', 'approval_url', 'authorized_action', 'target'],
  ['sha', 'artifact', 'target', 'release_url', 'smoke', 'rollback'],
];

// Validate the documented handoff schema, not the truth of external events.
// Evidence URLs and real actors still require inspection of the candidate PR.
function validate(text) {
  const blocks = [...text.matchAll(/<!-- handoff-contract:start -->\s*```json\s*([\s\S]*?)```\s*<!-- handoff-contract:end -->/g)];
  assert.equal(blocks.length, 1, 'exactly one machine-readable handoff contract required');
  const contract = JSON.parse(blocks[0][1]);
  assert.deepEqual(contract.states.map(state => state.name), names, 'ordered gates must not be skipped');
  contract.states.forEach((state, index) => {
    assert.equal(state.actor, actors[index], `separate authority for ${state.name}`);
    for (const field of evidence[index]) {
      assert.ok(state.evidence.includes(field), `${state.name} requires ${field}`);
    }
  });
}

test('documented handoff preserves ordered states, actors and required evidence', () => validate(document));
test('handoff gate rejects missing contracts and invalid JSON', () => {
  assert.throws(() => validate('no contract'));
  assert.throws(() => validate(document + document));
  assert.throws(() => validate(document.replace('"states":', '"states" invalid:')));
});
test('handoff gate rejects skipped CI, self-review and lost authorization/evidence', () => {
  const mutate = change => document.replace(/("states"[\s\S]*?)\n}/, block => {
    const contract = JSON.parse(`{${block}`);
    change(contract.states);
    return JSON.stringify(contract).slice(1);
  });
  assert.throws(() => validate(mutate(states => states.splice(3, 1))));
  assert.throws(() => validate(mutate(states => { states[4].actor = 'implementer'; })));
  for (let index = 0; index < names.length; index++) {
    for (const field of evidence[index]) {
      assert.throws(() => validate(mutate(states => {
        states[index].evidence = states[index].evidence.filter(item => item !== field);
      })), `${names[index]} must retain ${field}`);
    }
  }
});
