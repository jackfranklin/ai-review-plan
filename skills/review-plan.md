---
name: review-plan
description: >
  Present a plan to the user for inline annotation via the ai-review UI.
  Use when you have a plan ready for human review before executing it.
  The user will annotate it in the browser; you then revise based on their comments.
---

You are presenting a plan for human review using the ai-review CLI.

## Steps

1. Write the plan to a file in the `.jai/tmp/` directory in the current workspace (e.g. `.jai/tmp/plan-<timestamp>.md`). Ensure the directory exists or create it.

2. **Generate AI annotations.** Before opening the review, write a JSON file with a summary and any per-line notes to guide the reviewer. This is especially useful on iterative reviews to show what changed since last time.

   Write the file to `.jai/tmp/annotations-<timestamp>.json` using this schema:
   ```json
   {
     "summary": "One or two sentences: what this plan does, or what changed since the last review.",
     "annotations": [
       {
         "startLine": 15,
         "endLine": 22,
         "text": "This section was rewritten to address the feedback about error handling."
       }
     ]
   }
   ```

   Rules for generating annotations:
   - `summary` is optional but strongly recommended; always write one on a re-review.
   - `annotations` is optional; include only lines worth drawing the reviewer's attention to.
   - Do **not** include a `file` field — plan mode uses plain line numbers only.
   - `startLine` and `endLine` are **1-indexed line numbers in the plan file**. To get accurate numbers: read the written plan file back with line numbers (e.g. `cat -n .jai/tmp/plan-<timestamp>.md`), then reference the specific lines.
   - Read the written annotations file back and verify line numbers look correct before proceeding.
   - On a re-review: annotate each section that changed and explain which prior feedback it addresses.

3. Run the CLI with a title and theme. Choose a title that is short (3–6 words)
   and specific to the current task — the user may have multiple review tabs open
   at once and needs to tell them apart at a glance:
   ```
   node ~/git/ai-review-plan/dist/cli.js plan \
     --title "<short task-specific title>" \
     --theme <dark|light> \
     --ai-annotations-file .jai/tmp/annotations-<timestamp>.json \
     .jai/tmp/plan-<timestamp>.md
   ```
   Use `--theme light` unless the user has expressed a preference for dark mode.

4. Wait for the CLI to exit. It blocks until the user submits their review.

5. Check the exit code and stdout:
   - **Exit 0 (Approved):** The user approved the plan. Check for any inline comments and address them, then proceed.
   - **Exit 1 (Changes Requested):** The user requested changes. Do not proceed. Show the user the comments from stdout and revise the plan to address them, then offer to run another review pass.

6. The stdout always begins with `## Review: APPROVED` or `## Review: CHANGES REQUESTED`, followed by any comments as a numbered list. Read each comment carefully.

7. Delete both temporary files (plan and annotations).

## Notes

- Always pass `--title`. Derive it from the current conversation (e.g. "Auth middleware refactor", "Add dark mode", "DB migration plan") — never use a generic title like "Plan review".
- Always pass `--theme`. Default to `light`; switch to `dark` if the user has indicated a preference.
- Do not proceed with execution until after review is complete and the verdict is Approved.
- If the user's comments conflict with each other, surface the conflict and ask for clarification rather than guessing.
- **Diagrams**: Use Mermaid diagrams (e.g. `sequenceDiagram`, `flowchart TD`, `stateDiagram-v2` in a fenced code block with language `mermaid`) when explaining complex interactions, database schemas, architectures, or step-by-step processes to make the plan easier to review.
