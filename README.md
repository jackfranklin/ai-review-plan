# review-plan

Reviewing an AI-generated plan in the terminal means reading a wall of text and
typing feedback into the chat. `review-plan` opens the plan in your browser so
you can annotate specific lines inline. Your comments are returned to the agent
so it can revise before acting.

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

## How it works

```
agent writes plan → review-plan opens browser → you annotate → agent revises → agent acts
```

The CLI starts a local server, opens the browser, and blocks until you click
**Done**. Any comments you left are printed to stdout and returned to the agent
as context for revision. If you click Done with no comments, nothing is printed
and the agent proceeds as planned.

---

## Use with Claude Code

The skill below tells Claude to pause before executing any multi-step plan and
call `review-plan` automatically.

Copy it to `~/.claude/skills/review-plan.md`:

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
2. Run the CLI with a title and theme. Choose a title that is short (3–6 words)
   and specific to the current task — the user may have multiple review tabs open
   at once and needs to tell them apart at a glance:
   ```
   review-plan --title "<short task-specific title>" --theme <dark|light> /tmp/plan-<timestamp>.md
   ```
   Use `--theme light` unless the user has expressed a preference for dark mode.
3. Wait for the CLI to exit. It blocks until the user clicks Done.
4. If the CLI prints nothing to stdout, the user had no comments — proceed with the plan as-is.
5. If the CLI prints annotated output, read each comment carefully and revise the plan to address it. Show the revised plan to the user before proceeding.
6. Delete the temporary file.

## Notes

- Always pass `--title`. Derive it from the current conversation (e.g. "Auth middleware refactor", "Add dark mode", "DB migration plan") — never use a generic title like "Plan review".
- Always pass `--theme`. Default to `light`; switch to `dark` if the user has indicated a preference.
- Do not proceed with execution until after review is complete.
- If the user's comments conflict with each other, surface the conflict and ask for clarification rather than guessing.
````

Then ask Claude: **"use /review-plan before you start"** — or invoke it directly with `/review-plan`.

---

## Use from the command line

`review-plan` is also useful on its own, independently of any AI agent — for
reviewing a plan written by hand, or for integrating into your own tooling.

```bash
# Review a file
review-plan plan.md

# Pipe from stdin
echo "$PLAN" | review-plan

# With a title (useful when reviewing multiple plans at once)
review-plan --title "Auth refactor" plan.md

# Light or dark theme
review-plan --theme light plan.md
review-plan --theme dark plan.md

# Token-efficient mode for AI agents (omits full plan from output)
review-plan --diff-only plan.md
```

The browser opens automatically. If it doesn't, the URL is printed to stderr.
Annotate the plan, then click **Done** (or press `Ctrl+D`). The CLI prints the
annotated result to stdout and exits.

Press **?** in the UI to see all keyboard shortcuts.

---

## Output format

When you leave comments, the CLI prints:

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

The interleaved format gives spatial context; the summary table gives the agent
a quick structured view to work from. Both are always present by default.

When the `--diff-only` flag is passed, the `## Annotated Plan` section is omitted, and only the `## Comment Summary` is printed. This is useful for saving tokens when the AI already has the plan in its context history.

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
