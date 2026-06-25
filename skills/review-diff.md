---
name: review-diff
description: >
  Present a git diff to the user for inline annotation via the ai-review UI.
  Use when you want to review code changes before committing or requesting review.
---

You are presenting a git diff for human review using the ai-review CLI.

## Steps

1. Get the diff you want to review. For staged changes use `git diff --staged`;
   for all uncommitted changes use `git diff HEAD`; for a specific range use
   `git diff <base>..<head>`.
   **Note**: Run `git add -N .` first to include untracked files in the diff. This records the intent to add the files, making them visible to `git diff` without fully staging them.

2. **Generate AI annotations.** Before opening the review, write a JSON file with a summary and any per-line notes you want the reviewer to see. This gives context on what changed and why.

   Write the file to `.jai/tmp/annotations-<timestamp>.json` (create the directory if needed) using this schema:
   ```json
   {
     "summary": "One or two sentences describing what changed and why.",
     "annotations": [
       {
         "file": "src/path/to/file.ts",
         "startLine": 42,
         "endLine": 45,
         "lineType": "new",
         "text": "What changed on these lines and the reason."
       }
     ]
   }
   ```

   Rules for generating annotations:
   - `summary` is optional but strongly recommended; write it if you have useful context.
   - `annotations` is optional; include only lines worth drawing the reviewer's attention to.
   - `file` must match the path exactly as it appears after `+++ b/` in the diff (e.g. `src/foo.ts`, not `./src/foo.ts`).
   - `lineType` must be `"new"` for added or context lines, or `"old"` for deleted lines. This disambiguates the line numbers when old and new sides overlap.
   - `startLine` and `endLine` are **source-file line numbers** from the diff hunk headers (`@@ -old +new @@`). Use the new-file line numbers when `lineType` is `"new"`, and old-file line numbers when `lineType` is `"old"`.
   - To find the exact line numbers: read the `@@ -old,count +new,count @@` header; the first context or changed line after it starts at the indicated new/old line number. Count forward from there.
   - Read the written file back and verify the line numbers look correct before proceeding. If annotations don't appear in the review UI, they were silently dropped with no error — check that `file` exactly matches the path after `+++ b/` in the diff, and that line numbers fall within the rendered hunk.
   - On a re-review after changes requested: mention in the summary which prior feedback you addressed and how.

3. Run the CLI, piping the diff to stdin:
   ```
   git diff HEAD | node ~/git/ai-review-plan/dist/cli.js diff \
     --title "<short task-specific title>" \
     --theme <dark|light> \
     --ai-annotations-file .jai/tmp/annotations-<timestamp>.json
   ```
   Use `--theme light` unless the user has expressed a preference for dark mode.

4. Wait for the CLI to exit. It blocks until the user submits their review.

5. Check the exit code and stdout:
   - **Exit 0 (Approved):** The user approved the diff. Address any inline comments in code, then proceed.
   - **Exit 1 (Changes Requested):** The user requested changes. Do not commit or push. Show the user the comments from stdout, address them in code, and offer to run another review pass.

6. The stdout always begins with `## Review: APPROVED` or `## Review: CHANGES REQUESTED`, followed by any comments as a numbered list. Read each comment carefully.

7. Delete the temporary annotations file.

## Notes

- Always pass `--title`. Derive it from the branch name or the work being done (e.g. "Auth middleware changes", "Dark mode CSS") — never use a generic title like "Diff review".
- Always pass `--theme`. Default to `light`; switch to `dark` if the user has indicated a preference.
- Pass `--no-wrap` to disable line wrapping if you prefer lines to overflow with a scrollbar. Line wrapping is enabled by default.
- If the diff is very large (hundreds of files), warn the user before opening and offer to scope it to specific paths: `git diff HEAD -- src/`.
