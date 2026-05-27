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
npm run typecheck
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

Copy the template below to `~/.claude/skills/review-plan.md` to give Claude a
`/review-plan` skill. When invoked, Claude will write the current plan to a
temp file, open it in the review UI, wait for your annotations, then revise
the plan addressing each comment.

```markdown
---
name: review-plan
description: >
  Present a plan to the user for inline annotation via the review-plan UI.
  Use when you have a plan ready for human review before executing it.
  The user will annotate it in the browser; you then revise based on their comments.
---

You are presenting a plan for human review using the review-plan CLI.

## Steps

1. Write the plan to a temporary file (e.g. `/tmp/plan-<timestamp>.md`).
2. Run the CLI, passing a short title so the user knows which review tab is which:
   ```
   review-plan --title "<short description of what is being planned>" /tmp/plan-<timestamp>.md
   ```
3. Wait for the CLI to exit. It blocks until the user clicks Done.
4. If the CLI prints nothing to stdout, the user had no comments — proceed with the plan as-is.
5. If the CLI prints annotated output, read each comment carefully and revise the plan to address it. Show the revised plan to the user before proceeding.
6. Delete the temporary file.

## Notes

- Pass `--theme light` if the user prefers a light UI.
- Do not proceed with execution until after review is complete.
- If the user's comments conflict with each other, surface the conflict and ask for clarification rather than guessing.
```
