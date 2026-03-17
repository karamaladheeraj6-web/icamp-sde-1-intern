# CLI Feed Watcher (feedwatch)

## Objective

Build `feedwatch` — a CLI that monitors RSS and Atom feeds for new items. On each run it fetches all registered feeds concurrently, parses the XML, compares new items against locally persisted seen-state, and reports what is new. No authentication required. The tool runs out of the box after `bun install`.

This is a full engineering project structured as developer tickets. Each ticket has an acceptance test you can run before moving to the next. Work through them in order, later tickets depend on earlier ones.

---

## Project Setup

```bash
mkdir feedwatch && cd feedwatch
bun init -y
bun add axios fast-xml-parser commander @inquirer/prompts ora chalk cli-table3
```

Create the file structure before writing any code:

```
feedwatch/
  feedwatch.js
  commands/
    add.js
    remove.js
    list.js
    run.js
    read.js
  lib/
    config.js
    parser.js
    fetcher.js
    store.js
    logger.js
  tests/
    feedwatch.test.js
  feedwatch.config.json
  package.json
```

Add `"type": "module"` to `package.json`. The entry point is `feedwatch.js`.

---

## Ticket 1.1: Config and Layered Settings

### What to Build

`lib/config.js` — implements layered configuration. Settings resolve in this order, each layer overriding the previous:

1. Hardcoded defaults
2. `feedwatch.config.json` in the project root
3. Environment variables
4. CLI flags passed at runtime

Config keys:

| Key | Default | Env var | Flag |
|-----|---------|---------|------|
| `retries` | `3` | `FEEDWATCH_RETRIES` | `--retries` |
| `timeout` | `8000` | `FEEDWATCH_TIMEOUT` | `--timeout` |
| `maxItems` | `10` | `FEEDWATCH_MAX_ITEMS` | `--max-items` |
| `logLevel` | `'info'` | `FEEDWATCH_LOG_LEVEL` | `--log-level` |

`resolveConfig(opts)` returns `{ config, sources }` where `sources` maps each key to `'default'`, `'file'`, `'env'`, or `'flag'`.

`feedwatch config show` displays a formatted table with each key, its resolved value, and a colour-coded source label.

### Acceptance

```bash
# All keys show source: default
feedwatch config show

# timeout source shows: env
FEEDWATCH_TIMEOUT=3000 feedwatch config show

# logLevel source shows: flag
feedwatch config show --log-level debug
```

All keys must have visible values and sources before any config file exists.

---

## Ticket 1.2: Feed Management

### What to Build

Three commands that manage the local feed registry stored in `~/.feedwatch/store.json`.

**`feedwatch add <name> <url>`** — registers a new feed. Rejects duplicate names with a clear error.

**`feedwatch remove <name>`** — removes a feed after a confirmation prompt.

**`feedwatch list`** — displays all registered feeds in a table: name, URL, last-fetched time, and new-item count from the last run. Shows an empty-state message when no feeds are registered.

All writes to `store.json` must be atomic — write to `.tmp`, then rename.

### Acceptance

```bash
feedwatch add hn https://news.ycombinator.com/rss
feedwatch list
# shows hn with its URL

feedwatch add hn https://other.com/rss
# exits with error: duplicate name

feedwatch list
# after no feeds: shows empty-state message, not a crash

feedwatch remove hn
# prompts for confirmation, removes on yes
```

Feed state persists across invocations, restart the terminal and run `feedwatch list` again to verify.

---

## Ticket 1.3: Fetch Engine

### What to Build

`lib/fetcher.js` — concurrent HTTP fetching with retry logic.

**`fetchAll(feeds, config)`** — fetches all feeds using `Promise.allSettled`. One failing feed never aborts the run. Returns an array of result objects with `{ name, status: 'ok' | 'failed', xml?, error? }`.

**`withRetry(fn, maxRetries, isRetryable)`** — retries `fn` up to `maxRetries` times with exponential backoff and jitter. Only retries on network errors and 5xx responses. Does not retry 4xx errors.

Each request uses `config.timeout` as the axios timeout. Retry attempts are logged at `DEBUG` level.

### Acceptance

```bash
feedwatch add hn https://news.ycombinator.com/rss
feedwatch run
# fetches and displays results

feedwatch add broken http://localhost:9999/nope
feedwatch run
# hn: shows results
# broken: reports FAILED, does not crash
# exit code 1 because one feed failed
```

Introduce an artificial delay by running `feedwatch run --timeout 1`, hn should fail with a timeout error, not a crash.

---

## Ticket 1.4: RSS/Atom Parsing and Normalisation

### What to Build

`lib/parser.js` — parses raw XML and normalises items to a fixed schema.

**`parseXML(xml)`** — accepts a raw XML string, detects whether it is RSS 2.0 or Atom 1.0, and returns an array of normalised items. Returns `[]` on any parse error, never throws.

Normalised item schema:

```javascript
{
  title:       string,   // empty string if missing
  link:        string,
  pubDate:     string,   // ISO 8601, or empty string
  description: string,
  guid:        string,   // fallback chain: guid → link → title
}
```

Both formats produce this same shape. Missing fields default to empty string. `pubDate` is normalised to ISO 8601 regardless of source format.

### Acceptance

```bash
# Create two fixture files:
# tests/fixtures/rss.xml   - a valid RSS 2.0 feed with 2 items
# tests/fixtures/atom.xml  - a valid Atom feed with 2 items
# tests/fixtures/bad.xml   - malformed XML
```

Write a quick test script (or use the test suite from Ticket 1.8):

```javascript
import { parseXML } from './lib/parser.js';
import fs from 'fs';

const rss  = parseXML(fs.readFileSync('tests/fixtures/rss.xml',  'utf8'));
const atom = parseXML(fs.readFileSync('tests/fixtures/atom.xml', 'utf8'));
const bad  = parseXML(fs.readFileSync('tests/fixtures/bad.xml',  'utf8'));

console.log(rss[0]);   // { title, link, pubDate, description, guid }
console.log(atom[0]);  // same shape
console.log(bad);      // []
```

Both `rss[0]` and `atom[0]` must have the same five keys. A missing `<title>` on any item must not crash the parser.

---

## Ticket 1.5: State Diffing and Change Detection

### What to Build

After parsing, compare each item's `guid` against the stored seen-state for that feed. Items not in the seen-state are `NEW`. Items already in it are `SEEN`.

After a successful run, write the current item GUIDs back to the store atomically. On the next run those items will be `SEEN`.

`feedwatch run` displays only `NEW` items by default. `--all` shows all items.

### Acceptance

```bash
feedwatch run
# first run: all items show as NEW

feedwatch run
# second run: same items show as SEEN, new count is 0

feedwatch run --all
# shows all items regardless of seen-state
```

Verify that the seen-state persists by stopping and restarting between runs.

---

## Ticket 1.6: Output and Reading

### What to Build

**`feedwatch run` output** — a formatted table per feed showing title, status (NEW/SEEN), published date, and link. NEW items are highlighted in green. FAILED feeds are highlighted in red. Exit code is `0` if all feeds succeed, `1` if any fail.

**`feedwatch run --json`** — outputs a raw JSON array of all results. No table, no colour. Must be valid JSON parseable by `jq`.

**`feedwatch read <name>`** — fetches and displays the latest items for a single feed in a readable list format. Does not modify seen-state.

### Acceptance

```bash
feedwatch run
# formatted table, NEW items in green

feedwatch run --json | jq '.[0].name'
# prints the feed name as a JSON string

feedwatch read hn
# shows latest items for hn feed

feedwatch read nonexistent
# exits with a clear error message, non-zero exit code

feedwatch run
# exit code 0 when all feeds succeed
echo $?  # 0

feedwatch add broken http://localhost:9999/nope && feedwatch run
echo $?  # 1
```

---

## Ticket 1.7: Package and Publish

### What to Build

Make `feedwatch` installable and runnable as a global binary.

Add a shebang to `feedwatch.js`:
```javascript
#!/usr/bin/env node
```

Make it executable:
```bash
chmod +x feedwatch.js
```

Update `package.json`:
```json
{
  "name": "feedwatch",
  "version": "1.0.0",
  "bin": { "feedwatch": "./feedwatch.js" },
  "files": ["feedwatch.js", "commands/", "lib/"]
}
```

The `files` whitelist must exclude `~/.feedwatch/`, `*.log`, `.env`, and `tests/`.

### Acceptance

```bash
bun link
feedwatch --help
# works from any directory

bun pack
# inspect the tarball, no store data, no log files, no test fixtures
tar tf feedwatch-*.tgz
```

Bump the version and do a dry-run publish:
```bash
npm version patch
bun publish --dry-run
```

---

## Ticket 1.8: Test Suite

### What to Build

`tests/feedwatch.test.js` — integration and unit tests that run with `bun test` and require no network access.

**Store isolation:** every test that touches the store sets `process.env.FEEDWATCH_STORE_DIR` to a unique temp directory. Clean it up in `afterAll`.

**Parser unit tests:**
- Valid RSS fixture → returns array of correctly normalised items
- Valid Atom fixture → returns same normalised shape
- Malformed XML fixture → returns `[]`, does not throw
- Feed with a missing `<title>` on one item → that item's `title` is `''`, not a crash

**Config unit tests:**
- `resolveConfig({})` with no file and no env → all sources are `'default'`
- `FEEDWATCH_TIMEOUT=3000` set before calling → `timeout === 3000`, source is `'env'`
- `opts.logLevel = 'debug'` passed in → `logLevel === 'debug'`, source is `'flag'`
- Unknown key in config file → exits with error

**Integration tests (spawned processes):**

Each integration test uses a `FEEDWATCH_STORE_DIR` temp directory passed via `env`:

```javascript
function run(args, opts = {}) {
  return spawnSync('bun', ['feedwatch.js', ...args], {
    cwd:      PROJECT_ROOT,
    encoding: 'utf8',
    timeout:  10000,
    env:      { ...process.env, FEEDWATCH_STORE_DIR: opts.storeDir || tmpDir },
    ...opts,
  });
}
```

Cover these cases:

| Test | Args | Expected |
|------|------|----------|
| add a feed | `['add', 'test', 'http://example.com/rss']` | `status 0` |
| list after add | `['list']` | `status 0`, stdout contains `'test'` |
| duplicate add | `['add', 'test', 'http://other.com']` | `status` not `0`, stderr contains error |
| list empty store | `['list']` (fresh dir) | `status 0`, shows empty-state message |
| remove unknown feed | `['remove', 'nope']` | `status` not `0` |
| read unknown feed | `['read', 'nope']` | `status` not `0` |
| config show | `['config', 'show']` | `status 0`, stdout contains `retries` |
| config show with env | `['config', 'show']` + `FEEDWATCH_TIMEOUT=1234` | stdout contains `1234` |

**Network error path test:**

Register a feed pointing at a port nothing is listening on, run it, and assert the result is `FAILED` rather than a crash:

```javascript
it('reports FAILED for unreachable feed without crashing', () => {
  run(['add', 'dead', 'http://127.0.0.1:19999/rss']);
  const r = run(['run']);
  expect(r.status).toBe(1);             // at least one failure
  expect(r.stdout).toMatch(/FAILED|failed/i);
  expect(r.stderr).not.toMatch(/unhandledRejection/);
});
```

### Acceptance

```bash
bun test tests/feedwatch.test.js
# all tests pass without network access
```

---