# Changelog

## [0.2.0] - 2026-06-11

### Breaking Changes

- **Approve / Reject verdict flow** — The single "Done reviewing" button has been replaced with distinct **Approve** and **Reject** buttons (keyboard shortcuts `a` / `r`). The `Ctrl+D` shortcut has been removed. The floating auto-save general comment panel is gone; a summary comment can now be added in the submit confirmation modal. The POST `/submit` endpoint now requires a `verdict: "approve" | "reject"` field.

- **CLI output format** — Output now begins with a `## Review: APPROVED` or `## Review: REJECTED` heading, making the verdict unambiguous for LLM callers. Inline comments are rendered as a numbered list instead of a markdown table. The general comment appears as prose below the verdict heading. The annotated plan is omitted by default (comments-only was already the recommended default). The `--comments-only` flag has been removed and replaced by `--include-plan` for the rare case where you want the full plan echoed back. The CLI exits with code `1` for rejected reviews.

### Features

- Group and sort files by directory in the diff review sidebar ([9f77071](https://github.com/jackfranklin/ai-review-plan/commit/9f77071))
- Mermaid diagram rendering support ([39e4ccc](https://github.com/jackfranklin/ai-review-plan/commit/39e4ccc))
- Markdown tables support ([d893658](https://github.com/jackfranklin/ai-review-plan/commit/d893658))

### Docs

- Add example screenshot to README

---

## [0.1.0] - 2026-06-06

Initial release.
