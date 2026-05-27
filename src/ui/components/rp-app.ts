import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { groupBlocks } from "../blocks.js";
import type { Block } from "../blocks.js";
import type { Comment } from "../types.js";
import "./rp-plan-line.js";

@customElement("rp-app")
export class RpApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 1100px;
      margin: 0 auto;
      padding: 2rem 2rem 6rem;
    }
    .toolbar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--toolbar-bg);
      border-top: 1px solid var(--toolbar-border);
      padding: 0.6rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .title {
      font-size: 0.9em;
      font-weight: 600;
      color: var(--text);
    }
    .title::after {
      content: "·";
      margin: 0 0.5rem;
      color: var(--text-subtle);
    }
    .status {
      color: var(--text-muted);
      font-size: 0.85em;
      margin-right: auto;
    }
    select {
      font: inherit;
      font-size: 0.85em;
      background: var(--bg-elevated);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 0.2rem 0.5rem;
      cursor: pointer;
    }
    button.done {
      font: inherit;
      font-size: 0.9em;
      padding: 0.4rem 1.2rem;
      background: var(--accent);
      color: var(--accent-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button.done:hover { background: var(--accent-hover); }
  `;

  @state() private blocks: Block[] = [];
  @state() private comments: Comment[] = [];
  @state() private focusedLine = 1;
  @state() private openCommentLine: number | null = null;
  @state() private theme = "dark";
  @state() private planTitle = "";

  override connectedCallback(): void {
    super.connectedCallback();
    this._applyTheme(localStorage.getItem("review-plan:theme") ?? "dark");
    void this._fetchPlan();
    window.addEventListener("keydown", this._onKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this._onKeydown);
  }

  private _applyTheme(name: string): void {
    this.theme = name;
    document.documentElement.dataset.theme = name;
    localStorage.setItem("review-plan:theme", name);
  }

  private async _fetchPlan(): Promise<void> {
    const res = await fetch("/plan");
    const data = (await res.json()) as { markdown: string; title?: string };
    this.blocks = groupBlocks(data.markdown);
    if (this.blocks.length > 0) this.focusedLine = this.blocks[0].startLine;
    if (data.title) {
      this.planTitle = data.title;
      document.title = `review-plan: ${data.title}`;
    }
  }

  private readonly _onKeydown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    const inInput = tag === "textarea" || tag === "input";

    if (e.key === "Escape") {
      this.openCommentLine = null;
      return;
    }

    if (inInput) return;

    switch (e.key) {
      case "j":
      case "ArrowDown":
        this._moveFocus(1);
        break;
      case "k":
      case "ArrowUp":
        this._moveFocus(-1);
        break;
      case "c":
        this.openCommentLine = this.focusedLine;
        break;
      case "n":
        this._jumpToComment(1);
        break;
      case "p":
        this._jumpToComment(-1);
        break;
      case "d":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          void this._submit();
        }
        break;
    }
  };

  private _moveFocus(delta: number): void {
    const idx = this.blocks.findIndex((b) => b.startLine === this.focusedLine);
    const next = this.blocks[idx + delta];
    if (next) this.focusedLine = next.startLine;
  }

  private _jumpToComment(delta: number): void {
    const commentedLines = [...new Set(this.comments.map((c) => c.startLine))].sort(
      (a, b) => a - b
    );
    if (commentedLines.length === 0) return;
    const idx = commentedLines.findIndex((l) => l >= this.focusedLine);
    if (delta > 0) {
      const next = commentedLines[idx === -1 ? 0 : idx + 1] ?? commentedLines[0];
      this.focusedLine = next;
    } else {
      const prev = commentedLines[idx - 1] ?? commentedLines[commentedLines.length - 1];
      this.focusedLine = prev;
    }
  }

  private _onRequestComment(e: CustomEvent<{ startLine: number; endLine: number }>): void {
    this.focusedLine = e.detail.startLine;
    this.openCommentLine = e.detail.startLine;
  }

  private _onLineFocus(e: CustomEvent<{ startLine: number }>): void {
    this.focusedLine = e.detail.startLine;
  }

  private _onCommentSave(
    e: CustomEvent<{ startLine: number; endLine: number; text: string }>
  ): void {
    const { startLine, endLine, text } = e.detail;
    this.comments = [...this.comments, { startLine, endLine, text }];
    this.openCommentLine = null;
  }

  private _onCommentCancel(): void {
    this.openCommentLine = null;
  }

  private _onCommentEdit(e: CustomEvent<Comment>): void {
    const target = e.detail;
    this.comments = this.comments.filter((c) => c !== target);
    this.openCommentLine = target.startLine;
    this.focusedLine = target.startLine;
  }

  private _onCommentDelete(e: CustomEvent<Comment>): void {
    this.comments = this.comments.filter((c) => c !== e.detail);
  }

  private async _submit(): Promise<void> {
    await fetch("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: this.comments }),
    });
    document.body.innerHTML =
      "<p style='padding:2rem;color:#888'>Done! You can close this tab.</p>";
  }

  override render() {
    if (this.blocks.length === 0) {
      return html`<p style="color:#888">Loading…</p>`;
    }

    return html`
      <div
        @request-comment=${this._onRequestComment}
        @line-focus=${this._onLineFocus}
        @comment-save=${this._onCommentSave}
        @comment-cancel=${this._onCommentCancel}
        @comment-edit=${this._onCommentEdit}
        @comment-delete=${this._onCommentDelete}
      >
        ${this.blocks.map((block) => {
          const blockComments = this.comments.filter(
            (c) => c.startLine === block.startLine
          );
          const isOpen =
            this.openCommentLine !== null &&
            this.openCommentLine >= block.startLine &&
            this.openCommentLine <= block.endLine;
          return html`
            <rp-plan-line
              .block=${block}
              .comments=${blockComments}
              ?focused=${this.focusedLine >= block.startLine &&
                this.focusedLine <= block.endLine}
              ?commentOpen=${isOpen}
            ></rp-plan-line>
          `;
        })}
      </div>
      <div class="toolbar">
        ${this.planTitle ? html`<span class="title">${this.planTitle}</span>` : ""}
        <span class="status"
          >${this.comments.length === 0
            ? "No comments yet"
            : `${this.comments.length} comment${this.comments.length === 1 ? "" : "s"}`}</span
        >
        <select
          .value=${this.theme}
          @change=${(e: Event) => { this._applyTheme((e.target as HTMLSelectElement).value); }}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
        <button class="done" @click=${this._submit}>Done reviewing (Ctrl+D)</button>
      </div>
    `;
  }
}
