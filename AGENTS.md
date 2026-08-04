# AGENTS.md — ai-review

Guidelines for AI agents working in this repository.

---

## Project overview

`ai-review` is a Node.js CLI + Lit web UI. The CLI starts a local HTTP server,
opens the browser, waits for the user to annotate a markdown plan or a git diff, then prints
annotated output to stdout. It is itself a tool used by AI agents (via the
Claude Code skill) to solicit human feedback mid-task.

Stack: TypeScript (strict), Lit 3, Vite, esbuild, `node:http`, `marked`.

---

## Build

```bash
npm install
npm run build        # full production build → dist/cli.js
npm run dev          # dev server (see below)
```

**Build order matters.** `scripts/build.ts` runs:
1. `vite build` → `dist/ui/index.html` (single-file, all JS/CSS inlined)
2. Writes the HTML into `src/cli/ui-html.ts` as a string constant
3. `esbuild` bundles `src/cli/index.ts` → `dist/cli.js` (ESM, all deps bundled)
4. Restores `src/cli/ui-html.ts` to its dev stub

Do **not** edit `src/cli/ui-html.ts` by hand — it is overwritten and restored
on every build.

---

## Dev workflow

```bash
npm run dev-plan     # dev server for plans
npm run dev-diff     # dev server for diffs
```

`scripts/dev.ts` starts two servers:

- **Plan API** on port 3001 — the same `node:http` server used in production,
  running in interactive mode, serving `fixtures/sample-plan.md` (plan mode) or
  `fixtures/sample-diff.diff` (diff mode) via `GET /plan`, streaming updates
  over `GET /events`, and accepting `POST /submit`
- **Vite** on port 5173 — full HMR, proxies `/plan`, `/submit`, and `/events`
  to port 3001

Open **http://localhost:5173** in the browser. Edit any file under `src/ui/` and
the page hot-reloads instantly without restarting either server. Editing
`fixtures/sample-plan.md` (or its annotations file) re-broadcasts over SSE, so
you can exercise the interactive loop by hand without going through the CLI.

When you submit in dev mode, the round is logged to the terminal and the
servers keep running — reload the page to review again.

**`fixtures/sample-plan.md`** is the canonical test document. Update it if you
need to test against a plan with different structure (e.g. deeply nested lists,
tables, long code blocks).

---

## Type checking and Linting

Always run type checking and linting after making changes to ensure code quality and prevent errors:

```bash
npm run typecheck
npm run lint
```

---

## Key architectural constraints

**No cross-boundary imports between UI and CLI/server.**
`src/ui/` cannot import from `src/server/` or `src/cli/`, and vice versa.
Types shared between both sides live in `src/types/` (e.g. `AiAnnotation`,
`AiAnnotationsFile` in `src/types/annotation.ts`), which both `tsconfig.ui.json`
and `tsconfig.cli.json` include. `src/ui/types.ts` and `src/server/server.ts`
re-export from `src/types/` rather than redefining. If you add a new shared
type, put it in `src/types/` and re-export it the same way — do not merge the
tsconfig `rootDir`s or duplicate the definition.

**ESM output only.**
`package.json` has `"type": "module"`. The esbuild output is ESM (`format: "esm"`).
Do not switch to CJS — `open` and `get-port` are ESM-only packages that use
`import.meta.url` internally and will break if bundled into CJS.

**Express is not used.**
The server uses raw `node:http` to avoid CJS/ESM bundling conflicts.
Keep it that way — the four routes (`GET /`, `GET /plan`, `GET /events`,
`POST /submit`) do not justify adding a framework dependency.

**`marked` is used for rendering.**
It is called per-block inside `rp-plan-line.ts`. Do not switch to `markdown-it`
without discussing it first; the rendering surface is small and `marked` is
intentionally lightweight here.

---

## UI component model

Blocks are the unit of interaction, not lines. `src/ui/blocks.ts` groups the
markdown source into `Block` objects before rendering. Each `<rp-plan-line>`
receives one block and its associated comments. Fenced code blocks span multiple
source lines but are a single `Block` with `startLine`/`endLine`.

The block grouper handles fences with up to 3 spaces of leading indentation
(CommonMark allows this; it also occurs naturally when a code block sits inside
a list item). The fence regex must account for this — a bare `/^`{3,}/` will
miss indented fences and cause each line inside the block to render as its own
block with broken markdown.

Multi-line blocks render with the gutter number top-aligned (`align-items:
flex-start`); single-line blocks centre it. This is intentional — do not
unify them to one value.

Comments are keyed by `startLine`. When the user annotates a multi-line block,
the comment is stored with `startLine = block.startLine` and
`endLine = block.endLine`.

State lives entirely in `rp-app`. Child components communicate upward via
custom events:

| Event | Fired by | Payload |
|-------|----------|---------|
| `request-comment` | `rp-plan-line` gutter click | `{ startLine, endLine }` |
| `line-focus` | `rp-plan-line` body click | `{ startLine }` |
| `comment-save` | `rp-comment-box` | `{ startLine, endLine, text }` |
| `comment-cancel` | `rp-comment-box` | — |
| `comment-edit` | `rp-comment-thread` | `Comment` |
| `comment-delete` | `rp-comment-thread` | `Comment` |

---

## Server contract

The CLI server exposes exactly four routes. Do not add routes without updating
both the server and the UI fetch calls.

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Serves the inlined UI HTML |
| `/plan` | GET | Returns `{ markdown: string, title?: string, theme?: string, mode?: string, interactive?: boolean, aiSummary?: string, aiAnnotations?: AiAnnotation[] }` |
| `/events` | GET | SSE stream (interactive mode only). Broadcasts `PlanUpdatePayload` (`{ markdown, aiSummary?, aiAnnotations? }`) whenever the CLI's file watcher fires |
| `/submit` | POST | Accepts `{ comments: Comment[], verdict }` |

**Non-interactive mode** (default): after `/submit`, the server closes and the
CLI exits (0 for approve, 1 for reject). Not designed to handle concurrent
requests or multiple submit calls.

**Interactive mode** (`--interactive`/`-i`): the server stays alive across
multiple `/submit` rounds. A `reject` verdict responds
`{ status: "waiting_for_updates" }` and keeps the server running; `approve`
responds `{ status: "closing" }` and resolves the same way non-interactive
approve does. The CLI (not the server) owns process lifecycle in this mode —
`createServer`'s `onReviewRound`/`onSessionEnd` callbacks drive when the CLI
prints output and exits. The CLI prints a `Watching: <path>` line to stdout on
startup (a machine-parsed contract line for an integrating AI agent), and
prints `=== FEEDBACK END ===` after each reject round or
`=== SESSION CLOSED: client disconnected ===` if the last SSE client (browser
tab) doesn't reconnect within the 30s grace period. Do not reintroduce the
"always close after first submit" assumption when touching this code path.

---

## Output format

stdout when comments exist:

```
<!-- ai-review output -->

## Annotated Plan

<plan lines, with blockquote comments interleaved after their target line>

## Comment Summary

| Lines | Comment |
|-------|---------|
| <n> | <text> |
```

stdout when no comments: empty (nothing printed). The CLI writes a message to
stderr only.

---

## What not to do

- Do not add a framework (React, Vue, etc.) to the UI — Lit is the chosen library.
- Do not add a router or middleware layer to the server.
- Do not make `src/cli/ui-html.ts` a hand-maintained file.
- Do not change the esbuild output format to CJS.
- Do not add `express` back — see ESM note above.
- Do not add comments to code that explain *what* the code does; only add them
  when the *why* is non-obvious.
