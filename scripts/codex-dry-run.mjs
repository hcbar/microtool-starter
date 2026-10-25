import {readFileSync, appendFileSync} from 'node:fs';
import {resolve} from 'node:path';

const repo = 'hcbar/microtool-starter';
const ownerId = 154026289;
const fail = code => { throw new Error(code); };

// GitHub's authenticated event envelope is the authority; issue text is never code.
export function validateTrigger(event, context) {
  if (context.eventName !== 'issue_comment' || event.action !== 'created') fail('EVENT_DENIED');
  if (event.repository?.full_name !== repo || event.repository?.owner?.id !== ownerId ||
      event.repository?.default_branch !== 'main') fail('REPOSITORY_DENIED');
  if (event.sender?.id !== ownerId || event.sender?.type !== 'User' ||
      event.comment?.user?.id !== ownerId || event.comment?.user?.type !== 'User' ||
      context.actorId !== String(ownerId)) fail('ACTOR_DENIED');
  if (event.issue?.number !== 4 || event.issue?.pull_request || event.issue?.state !== 'open') fail('ISSUE_DENIED');
  if (!Number.isSafeInteger(event.comment?.id) || event.comment.id <= 0) fail('COMMENT_DENIED');
  if (context.attempt !== '1' || !/^[1-9]\d*$/.test(context.runId)) fail('REPLAY_DENIED');
  const match = /^\/codex dry-run ([a-f0-9]{40})$/.exec(event.comment?.body);
  if (!match || match[0] !== event.comment.body) fail('CONTRACT_DENIED');
  return {repository: repo, issue: 4, base: match[1], command: event.comment.body,
    runName: `dry-run-4-${event.comment.body}`, runId: context.runId};
}

export async function diagnose(request, api) {
  const branch = await api('/branches/main');
  if (branch.name !== 'main' || branch.protected !== true || branch.commit?.sha !== request.base) fail('BASE_DENIED');
  // Serialized by workflow concurrency. Any earlier matching run consumes the
  // command, even failed/cancelled runs. Missing/incomplete history fails closed.
  let currentVisible = false;
  let total;
  for (let page = 1; page <= 10; page++) {
    const history = await api(`/actions/workflows/codex-dry-run.yml/runs?event=issue_comment&per_page=100&page=${page}`);
    if (!Number.isSafeInteger(history.total_count) || !Array.isArray(history.workflow_runs)) fail('DEDUP_UNVERIFIED');
    if (total !== undefined && total !== history.total_count) fail('DEDUP_UNVERIFIED');
    total = history.total_count;
    currentVisible ||= history.workflow_runs.some(run => String(run.id) === request.runId && run.display_title === request.runName);
    if (history.workflow_runs.length !== Math.min(100, Math.max(0, history.total_count - (page - 1) * 100))) fail('DEDUP_UNVERIFIED');
    if (history.workflow_runs.some(run => run.display_title === request.runName &&
        /^[1-9]\d*$/.test(String(run.id)) && BigInt(run.id) < BigInt(request.runId))) fail('DUPLICATE_DENIED');
    if (history.total_count <= page * 100) {
      if (!currentVisible) fail('DEDUP_UNVERIFIED');
      return {status: 'DRY_RUN', executor: 'DISABLED', repository: repo, issue: 4,
        base_sha: request.base, dedup: 'HISTORY_CHECKED', live: false};
    }
    if (history.workflow_runs.length !== 100) fail('DEDUP_UNVERIFIED');
  }
  fail('DEDUP_UNVERIFIED');
}

export function githubApi(token) {
  return async path => {
    const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'}, signal: AbortSignal.timeout(10000), redirect: 'error'
    });
    if (!response.ok) fail('GITHUB_READ_FAILED');
    return response.json();
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  try {
    const request = validateTrigger(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), {
      eventName: process.env.GITHUB_EVENT_NAME, actorId: process.env.GITHUB_ACTOR_ID,
      attempt: process.env.GITHUB_RUN_ATTEMPT, runId: process.env.GITHUB_RUN_ID
    });
    const result = await diagnose(request, githubApi(process.env.GH_TOKEN));
    const output = JSON.stringify(result);
    console.log(output);
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n\`\`\`json\n${output}\n\`\`\`\n`);
  } catch (error) {
    // Do not echo event text, HTTP bodies or credentials.
    const code = /^[A-Z_]+$/.test(error.message) ? error.message : 'DIAGNOSTIC_FAILED';
    console.error(code);
    process.exitCode = 1;
  }
}
