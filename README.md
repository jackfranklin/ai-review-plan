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

Three ready-made skills live in the [`skills/`](./skills) folder of this
repository. Copy the ones you want to `~/.claude/skills/` and Claude will pick
them up automatically.

| Skill | File | Invoke with |
|-------|------|-------------|
| Review a plan before acting | [`skills/review-plan.md`](./skills/review-plan.md) | `/review-plan` |
| Review a diff before committing | [`skills/review-diff.md`](./skills/review-diff.md) | `/review-diff` |
| Walkthrough of AI-written code | [`skills/walkthrough.md`](./skills/walkthrough.md) | `/walkthrough` |

```bash
# Install all three
cp skills/*.md ~/.claude/skills/
```

### review-plan

Tells Claude to pause before executing any multi-step plan, open the review UI,
and revise based on your comments before acting.

```
/review-plan
```

Or ask Claude: **"use /review-plan before you start"**.

### review-diff

Tells Claude to pipe the current diff into the review UI so you can annotate
changes before they are committed or pushed.

```
/review-diff
```

Or ask Claude: **"use /review-diff to review changes"**.

### walkthrough

Rather than reviewing code, this skill is for *understanding* it. Claude
analyses the diff, structures the changes into logical steps with explanations
of the *why*, and opens the result in the review UI. You read at your own pace,
leave questions as inline comments, and Claude answers them when you click Done.

```
/walkthrough
```

Or ask Claude: **"walk me through what you just wrote"**.

The flow:

```
agent writes code → /walkthrough → agent generates explanation →
browser opens → you read + leave questions → agent answers in chat
```

---

## Use from the command line

`review-plan` is also useful on its own, independently of any AI agent — for
reviewing a plan written by hand, or for integrating into your own tooling.

```bash
# Review a plan file
review-plan plan plan.md

# Pipe plan from stdin
echo "$PLAN" | review-plan plan

# Review a git diff
git diff | review-plan diff

# With a title
review-plan plan --title "Auth refactor" plan.md
git diff | review-plan diff --title "Current Changes"

# Light or dark theme
review-plan plan --theme light plan.md
review-plan plan --theme dark plan.md

# Token-efficient mode for AI agents (omits full plan from output)
review-plan plan --diff-only plan.md
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
