# review-plan

A CLI tool + local web UI for annotating AI-generated markdown plans inline,
returning the annotated result to the calling AI agent via stdout.

```
AI skill → review-plan <file> → browser UI → user annotates → stdout → AI revises
```

The CLI blocks while the browser UI is open. When you click **Done**, your
comments are sent to the local server, which serialises the plan with
comments interleaved and exits. The calling AI agent reads that output as
context for revision.

---

## Usage

```bash
# Review a plan file
node dist/cli.js plan.md

# Pipe from stdin
echo "$PLAN" | node dist/cli.js

# After npm install -g (or npx)
review-plan plan.md
```

The browser opens automatically. If it doesn't, the URL is printed to stderr.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Move focus to next block |
| `k` / `↑` | Move focus to previous block |
| `c` | Open comment box on focused block |
| `n` | Jump to next commented block |
| `p` | Jump to previous commented block |
| `Escape` | Close open comment box |
| `Ctrl+Enter` | Save comment |
| `Ctrl+D` / `Cmd+D` | Done — submit all comments |

---

## Output format

When you click Done, the CLI prints to stdout:

```markdown
<!-- review-plan output -->

## Annotated Plan

[plan line 1]
[plan line 2]
> **Comment (line 2):** This step is too vague — specify which database.
[plan line 3]
...

## Comment Summary

| Lines | Comment |
|-------|---------|
| 2 | This step is too vague — specify which database. |
| 8–11 | This whole block conflicts with the caching approach in step 4. |
```

If you click Done with no comments, the CLI exits silently (nothing printed to
stdout).

---

## Development

```bash
npm install

# UI dev server (hot reload, connects to a running CLI for /plan and /submit)
npm run dev

# Production build → dist/cli.js
npm run build

# Type-check everything
npx tsc -p tsconfig.cli.json --noEmit
npx tsc -p tsconfig.ui.json --noEmit
```

---

## Repository layout

```
src/
  cli/
    index.ts          # Entry point: arg parsing, server start, browser launch, stdout
    ui-html.ts        # Stub (dev) / inlined UI HTML (overwritten by build script)
  server/
    server.ts         # node:http server: GET /, GET /plan, POST /submit
  ui/
    index.html        # Vite entry point
    main.ts           # Bootstraps the Lit app
    blocks.ts         # Markdown block grouper (fenced code, etc.)
    types.ts          # Shared Comment interface for UI code
    components/
      rp-app.ts           # Root component — state, keyboard nav, Done button
      rp-plan-line.ts     # Single block: renders markdown, gutter, comment affordance
      rp-comment-box.ts   # Inline textarea for writing a comment
      rp-comment-thread.ts # Read-only saved comment with Edit/Delete
    styles/
      base.css
scripts/
  build.ts            # Vite → inline UI HTML → esbuild → dist/cli.js
```

---

## Claude Code skill

A skill file is installed at `~/.claude/skills/review-plan.md`. When you ask
Claude to present a plan for review, it will run `review-plan`, wait for you
to annotate it, then revise the plan addressing each comment.
