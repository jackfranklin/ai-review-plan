# review-plan

When an AI agent is about to execute a plan, `review-plan` pauses it, opens
the plan in your browser, and lets you annotate it line by line. Your comments
are returned to the agent so it can revise before acting.

---

## Install

```bash
npm install -g review-plan
```

Or run without installing:

```bash
npx review-plan plan.md
```

---

## Use with Claude Code (recommended)

The easiest way to use `review-plan` is via a Claude Code skill that triggers
automatically when Claude is about to execute a multi-step plan.

Copy the template below to `~/.claude/skills/review-plan.md`:

````markdown
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
````

Then ask Claude: **"use /review-plan before you start"** — or invoke it directly with `/review-plan`.

---

## Use from the command line

```bash
# Review a file
review-plan plan.md

# Pipe from stdin
echo "$PLAN" | review-plan

# With a title (useful when reviewing multiple plans at once)
review-plan --title "Auth refactor" plan.md

# Light theme
review-plan --theme light plan.md
```

The browser opens automatically. If it doesn't, the URL is printed to stderr.
Annotate the plan, then click **Done** (or press `Ctrl+D`). The CLI prints the
annotated result to stdout and exits. If you click Done with no comments,
nothing is printed.

Press **?** in the UI to see all keyboard shortcuts.

---

## Output format

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

---

## Development

```bash
npm install
npm run dev        # UI dev server with hot reload on http://localhost:5173
npm run build      # Production build → dist/cli.js
npm run typecheck  # Type-check all packages
```

### Repository layout

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
      rp-app.ts            # Root component — state, keyboard nav, toolbar
      rp-plan-line.ts      # Single block: renders markdown, gutter, comment affordance
      rp-comment-box.ts    # Inline textarea for writing a comment
      rp-comment-thread.ts # Saved comment with Edit/Delete
    styles/
      base.css
scripts/
  build.ts            # Vite → inline UI HTML → esbuild → dist/cli.js
```
