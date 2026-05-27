# review-plan — Build Plan

A CLI tool + local web UI for annotating AI-generated markdown plans inline,
returning the annotated result to the calling AI agent via stdout.

---

## Overview

```
AI skill → review-plan <file> → browser UI → user annotates → stdout → AI revises
```

The CLI blocks while the UI is open. When the user clicks "Done", comments are
POSTed to the local server, which serialises plan + comments to stdout and exits.
The skill feeds that output back to the AI as context for revision.

---

## Repository Layout

```
review-plan/
├── src/
│   ├── cli/
│   │   └── index.ts          # entry point: arg parsing, server, browser launch
│   ├── server/
│   │   └── server.ts         # Express/http server: serves UI, exposes /submit
│   └── ui/
│       ├── index.html        # Vite entry
│       ├── main.ts           # bootstraps the LitElement app
│       ├── components/
│       │   ├── rp-app.ts         # root component, owns state
│       │   ├── rp-plan-line.ts   # single rendered line with comment affordance
│       │   ├── rp-comment-box.ts # inline comment input (anchored to a line/range)
│       │   └── rp-comment-thread.ts # rendered comment callout
│       └── styles/
│           └── base.css
├── scripts/
│   └── build.ts              # Vite build → inject into CLI binary
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Phase 1 — Project Scaffolding

- [ ] `npm init`, TypeScript config, ESLint
- [ ] Vite config for the UI (output to `dist/ui/`)
- [ ] `tsconfig` with separate `ui` and `cli` roots
- [ ] Agree on output format (see §Output Format)

---

## Phase 2 — CLI & Server (`src/cli/`, `src/server/`)

### CLI entry (`src/cli/index.ts`)

Responsibilities:
1. Parse args: `review-plan [file]` or read stdin
2. Write plan to a named temp file if coming from stdin
3. Pick a free port
4. Start the HTTP server (see below)
5. Open the browser (`open` package — cross-platform)
6. Await a `Promise` that resolves when `/submit` is called
7. Print result to stdout, `process.exit(0)`

### Server (`src/server/server.ts`)

- `GET /`  → serves the bundled `index.html` (inlined at build time — see §Packaging)
- `GET /plan` → returns the plan markdown as JSON `{ markdown: string }`
- `POST /submit` → accepts `{ comments: Comment[] }`, resolves the awaited promise

```ts
interface Comment {
  startLine: number;   // 1-indexed
  endLine: number;     // same as startLine for single-line comments
  text: string;
}
```

---

## Phase 3 — UI (`src/ui/`)

### Rendering approach

The plan markdown is split into lines **before** passing to `marked` (or similar).
Each line is rendered individually inside a `<rp-plan-line>` component so that:
- Line numbers are always 1-to-1 with source markdown lines
- Comment affordances can be attached per-line without fighting the rendered DOM

> Trade-off: some markdown constructs span multiple lines (fenced code blocks,
> multi-line list items). These are grouped into a single logical "block" that
> can be selected as a range. The block's start/end line numbers are preserved.

### Components

**`rp-app`**
- Fetches `/plan` on connect
- Owns `comments: Comment[]` state
- Handles keyboard navigation (see §Keyboard Shortcuts)
- "Done reviewing" button → POST `/submit` → window closes (or shows "you can close this tab")

**`rp-plan-line`**
- Renders one line (or block) of markdown via `innerHTML` + `marked`
- Shows a faint `+` in the left gutter on hover
- On gutter click: dispatches `request-comment` event with `{ startLine, endLine }`
- If a comment exists for this line: renders `<rp-comment-thread>` inline below

**`rp-comment-box`**
- A floating `<textarea>` + Save/Cancel
- Positioned absolute, anchored to the triggering line
- Ctrl+Enter / Cmd+Enter to save

**`rp-comment-thread`**
- Read-only display of a saved comment
- "Edit" and "Delete" affordances

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Move focus to next line |
| `k` / `↑` | Move focus to previous line |
| `c` | Open comment box on focused line |
| `n` | Jump to next commented line |
| `p` | Jump to previous commented line |
| `Escape` | Close open comment box |
| `Ctrl+Enter` | Submit comment (when box is open) |
| `Ctrl+D` / `Cmd+D` | Done — submit all comments |

Focus is tracked on `rp-app` with a `focusedLine` property; active line gets a
subtle highlight in the gutter.

### Range selection (stretch goal for Phase 3, not blocking)

- On mousedown on a line number, set `rangeStart`
- On mouseup on a different line number, set `rangeEnd`, open comment box for range
- This is entirely additive — single-line comments work without it

---

## Phase 4 — Packaging

1. **Vite builds the UI** to `dist/ui/` — a single `index.html` + inlined JS/CSS
   (use `vite-plugin-singlefile` to produce one self-contained HTML file)
2. **esbuild bundles the CLI + server** to `dist/cli.js`, with the UI HTML
   inlined as a string constant (a build script reads the file and substitutes
   it in)

Build order: `vite build` → `inline-ui-into-cli` → `esbuild`

A `scripts/build.ts` script orchestrates this.

Publish as an npm package with a `bin` entry pointing to `dist/cli.js`.
Users can `npm i -g review-plan` or `npx review-plan`.

---

## Phase 5 — Claude Code Skill

A markdown skill file at `~/.claude/skills/review-plan.md` (or in the project's
`.claude/skills/`):

```markdown
When asked to present a plan for review, or when the user says "review this plan":

1. Write the plan to a temporary file, e.g. /tmp/plan-review-<timestamp>.md
2. Run: `review-plan /tmp/plan-review-<timestamp>.md`
3. Capture stdout. It will contain the original plan with comments interleaved.
4. Say: "Here is what the user commented:" and show the comments section.
5. Revise the plan, addressing each comment. Indicate which comments have been
   addressed and how.
```

---

## Output Format

What the CLI prints to stdout when the user clicks Done:

```markdown
<!-- review-plan output -->

## Annotated Plan

[line 1 of plan]
[line 2 of plan]
> **Comment (line 2):** This step is too vague — specify which database.
[line 3 of plan]
...

## Comment Summary

| Lines | Comment |
|-------|---------|
| 2 | This step is too vague — specify which database. |
| 8–11 | This whole block conflicts with the caching approach in step 4. |
```

The summary table gives the AI a quick structured view; the interleaved format
gives spatial context. Both are present in every output.

---

## Milestones

| # | Milestone | Done when |
|---|-----------|-----------|
| 1 | Scaffolding | `npm run dev` opens a blank Vite+Lit page |
| 2 | Plan rendering | Markdown file is displayed with line numbers |
| 3 | Comment flow | Click gutter → type comment → saved inline |
| 4 | Keyboard nav | All shortcuts in §Keyboard Shortcuts work |
| 5 | Submit + stdout | "Done" closes UI, CLI prints annotated output |
| 6 | Packaging | `node dist/cli.js plan.md` works, no separate UI assets |
| 7 | Skill | Claude Code skill triggers the flow end-to-end |

---

## Open Questions

- **Markdown renderer**: `marked` is lightest; `markdown-it` has better plugin
  support if we later want syntax highlighting in code blocks inside plans.
  Start with `marked`, migrate if needed.
- **Port collision**: pick a random free port via `get-port` package; pass it
  to the UI via a query param on the URL opened in the browser.
- **stdin handling**: if no file arg, read stdin into a temp file. This lets
  the skill pipe directly: `echo "$PLAN" | review-plan`.
- **Long plans**: virtual scrolling is probably overkill for plans (they are
  rarely >200 lines), but keep component granularity fine enough that it could
  be added later.
