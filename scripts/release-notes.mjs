#!/usr/bin/env node
// Generate release notes for a tag from the git history between it and the previous tag.
//
// Commits are grouped into Keep a Changelog sections by their Conventional-Commit prefix:
//   feat / feature            -> Added
//   fix / bugfix / hotfix     -> Fixed
//   perf / refactor / revert  -> Changed
//   (chore/docs/test/ci/build/style are treated as noise and skipped)
// Commits with no recognised prefix fall back to Changed, so nothing meaningful is lost.
//
// Usage:
//   node scripts/release-notes.mjs <tag> [--repo owner/name] > notes.md
//   node scripts/release-notes.mjs v1.2.0
//
// Designed to run in CI (the Release workflow) where the full history is available
// (actions/checkout with fetch-depth: 0). Safe to run locally too.

import { execSync } from 'node:child_process';

function git(args) {
  try {
    // Suppress stderr here (not via a shell redirect) so it works on both POSIX and Windows.
    return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

const args = process.argv.slice(2);
const tag = args.find((a) => !a.startsWith('--')) || git('describe --tags --abbrev=0') || 'HEAD';
const repoFlag = args.indexOf('--repo');
const repo =
  (repoFlag !== -1 && args[repoFlag + 1]) ||
  process.env.GITHUB_REPOSITORY ||
  'swyftstack/grids';

// Resolve the range: previous tag -> this tag. If there is no previous tag, use the whole history.
const tagExists = git(`rev-parse -q --verify "refs/tags/${tag}"`) !== '';
const tagRef = tagExists ? tag : 'HEAD';
const prevTag = git(`describe --tags --abbrev=0 "${tagRef}^"`);
const range = prevTag ? `${prevTag}..${tagRef}` : tagRef;

// %s = subject, %h = short hash, separated by a NUL so subjects with any character survive.
const raw = git(`log ${range} --no-merges --pretty=format:%s%x1f%h`);
const commits = raw
  ? raw
      .split('\n')
      .map((line) => {
        const [subject, hash] = line.split('\x1f');
        return { subject: (subject || '').trim(), hash: (hash || '').trim() };
      })
      .filter((c) => c.subject)
  : [];

const SECTIONS = { Added: [], Changed: [], Fixed: [] };
const SKIP = /^(chore|docs|test|tests|ci|build|style)(\(.+\))?(!)?:/i;

function classify(subject) {
  const m = subject.match(/^([a-z]+)(\(.+\))?(!)?:\s*(.*)$/i);
  if (!m) return { section: 'Changed', text: subject };
  const type = m[1].toLowerCase();
  const text = m[4] || subject;
  if (/^(feat|feature)$/.test(type)) return { section: 'Added', text };
  if (/^(fix|bugfix|hotfix)$/.test(type)) return { section: 'Fixed', text };
  if (/^(perf|refactor|revert)$/.test(type)) return { section: 'Changed', text };
  return { section: 'Changed', text };
}

function titleCase(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

for (const c of commits) {
  if (SKIP.test(c.subject)) continue;
  const { section, text } = classify(c.subject);
  SECTIONS[section].push(`- ${titleCase(text)} (${c.hash})`);
}

const lines = [];
lines.push(`## Swyftgrids ${tag}`);
lines.push('');
lines.push('Download the installer for your platform from the assets below. Verify your');
lines.push('download against `checksums.txt` (SHA-256).');
lines.push('');

let hasEntries = false;
for (const name of ['Added', 'Changed', 'Fixed']) {
  if (SECTIONS[name].length === 0) continue;
  hasEntries = true;
  lines.push(`### ${name}`);
  lines.push(...SECTIONS[name]);
  lines.push('');
}

if (!hasEntries) {
  lines.push('Maintenance and packaging updates. See the full changelog below.');
  lines.push('');
}

if (prevTag) {
  lines.push(`**Full changelog**: https://github.com/${repo}/compare/${prevTag}...${tag}`);
} else {
  lines.push(`**Full changelog**: https://github.com/${repo}/commits/${tag}`);
}
lines.push('');

process.stdout.write(lines.join('\n'));
