#!/usr/bin/env node
/**
 * Publish check — run before every push, because this repo is public and a push
 * is a publication that can't be taken back. CI runs after the push, so it can't
 * be the gate; this runs before.
 *
 * It looks at the commits about to be pushed and flags what needs a human
 * decision, rather than judging it:
 *   1. new files outside the source tree
 *   2. content files (fixtures, sample analyses, media, data), whose origin and
 *      licence must be clear before they're published
 *   3. secrets and personal data in added lines or commit messages
 *   4. project-specific private markers, read from an optional file outside this
 *      repo (the maintainer's private notes), so the list itself is never public
 *
 * Usage:
 *   npm run publish-check          check the current branch's unpushed commits
 *   node scripts/publish-check.mjs --hook
 *                                  Claude Code PreToolUse hook: reads the tool
 *                                  call from stdin; checks only `git push` into
 *                                  this repo; exit 2 blocks the push
 *
 * A flagged push goes ahead only after the maintainer approves the flagged items;
 * the push command then carries PUBLISH_CHECK_ACK=1. That is a record that a
 * human looked, not a way around looking.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, realpathSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim()

// ── What counts as source ────────────────────────────────────────────────────
const SOURCE_DIRS = ['src/', 'schema/', 'docs/', 'widgets/', 'public/', '.github/', '.claude/', 'scripts/']
const ROOT_FILES = new Set([
  'CLAUDE.md', 'README.md', 'LICENSE', 'CONTRIBUTING.md', 'CONTRIBUTING-VOCAB.md', '.gitignore',
  'package.json', 'package-lock.json', 'index.html', 'components.json', 'vite.config.ts',
  'tsconfig.json', 'tsconfig.node.json', 'tailwind.config.js', 'postcss.config.js', '.eslintrc.cjs',
])
// Content, not code: publishing it is a licence and provenance decision.
const CONTENT = /\.(strata|vocab\.json|png|jpe?g|gif|webp|svg|pdf|mp3|wav|m4a|ogg|flac|mp4|mov|csv|tsv|xlsx?|mei|musicxml|mxl|mid|midi)$/i

// ── Secrets and personal data ────────────────────────────────────────────────
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\b(AKIA|ASIA)[A-Z0-9]{16}\b/, 'an AWS access key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'a GitHub token'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, 'an API secret key'],
  [/\b(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'a credential assignment'],
]
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// Addresses that are meant to be public: commit attribution and GitHub noreply.
const ALLOWED_EMAIL = /^(noreply@anthropic\.com|[^@]+@users\.noreply\.github\.com)$/i

// Private markers live outside this repo; missing file = no extra markers.
const MARKER_FILE = join(REPO, '..', 'research', 'strata', 'publish-markers.txt')
function privateMarkers() {
  if (!existsSync(MARKER_FILE)) return []
  return readFileSync(MARKER_FILE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
}

// ── The commits about to be pushed ───────────────────────────────────────────
function baseRef() {
  try {
    return git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
  } catch {
    return 'origin/main' // a branch never pushed: everything since main is new
  }
}

export function check() {
  const base = baseRef()
  const range = `${base}..HEAD`
  if (git('rev-list', '--count', range) === '0') return { range, problems: [] }

  const problems = []
  const changes = git('diff', '--name-status', '--no-renames', range)
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'))

  for (const [status, file] of changes) {
    if (status === 'D') continue
    if (status === 'A' && !ROOT_FILES.has(file) && !SOURCE_DIRS.some((d) => file.startsWith(d))) {
      problems.push(`New file outside the source tree: ${file}`)
    }
    if (CONTENT.test(file)) {
      problems.push(`Content file ${status === 'A' ? 'added' : 'changed'}: ${file} (origin and licence need a decision)`)
    }
  }

  // Added lines only: what this push newly publishes, plus the commit messages.
  const added = git('diff', '-U0', '--no-color', range)
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .join('\n')
  const messages = git('log', '--format=%B', range)
  const text = `${added}\n${messages}`

  for (const [pattern, what] of SECRET_PATTERNS) {
    if (pattern.test(text)) problems.push(`Looks like ${what} in the changes or commit messages`)
  }
  const emails = [...new Set(text.match(EMAIL) ?? [])].filter((e) => !ALLOWED_EMAIL.test(e))
  if (emails.length) problems.push(`Email address(es): ${emails.join(', ')}`)

  for (const marker of privateMarkers()) {
    if (text.toLowerCase().includes(marker.toLowerCase())) {
      problems.push(`Private marker "${marker}" appears in the changes or commit messages`)
    }
  }
  return { range, problems }
}

function report({ range, problems }) {
  if (problems.length === 0) {
    console.log(`Publish check passed (${range}).`)
    return true
  }
  console.error(`Publish check flagged ${problems.length} item(s) in ${range}:`)
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\nThis repo is public: ask the maintainer before pushing these.')
  console.error('Once approved, push with PUBLISH_CHECK_ACK=1 in front of the command.')
  return false
}

// ── Hook mode: decide whether this tool call is a push into this repo ───────
function pushTargetsThisRepo(command, cwd) {
  if (!/\bgit\b[^;&|]*\bpush\b/.test(command)) return false
  // Where does the push run? `git -C <dir>`, else the last `cd <dir>`, else cwd.
  const dashC = command.match(/\bgit\s+-C\s+("[^"]+"|\S+)/)
  const cd = [...command.matchAll(/\bcd\s+("[^"]+"|[^\s;&|]+)/g)].pop()
  const dir = (dashC?.[1] ?? cd?.[1] ?? cwd).replace(/^"|"$/g, '')
  try {
    const top = execFileSync('git', ['-C', resolve(cwd, dir), 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'], // not a repo is an answer, not an error
    }).trim()
    return realpathSync(top) === realpathSync(REPO)
  } catch {
    return false
  }
}

if (process.argv.includes('--hook')) {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const command = input.tool_input?.command ?? ''
  if (!pushTargetsThisRepo(command, input.cwd ?? process.cwd())) process.exit(0)
  if (/\bPUBLISH_CHECK_ACK=1\b/.test(command)) process.exit(0)
  process.exit(report(check()) ? 0 : 2) // exit 2 = block the tool call
} else {
  process.exit(report(check()) ? 0 : 1)
}
