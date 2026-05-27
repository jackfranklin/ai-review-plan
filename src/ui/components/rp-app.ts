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
      max-width: 860px;
      margin: 0 auto;
      padding: 2rem 1rem 6rem;
    }
    .toolbar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #252526;
      border-top: 1px solid #333;
      padding: 0.6rem 1rem;
      display: flex;
      justify-content: flex-end;
    }
    button.done {
      font: inherit;
      font-size: 0.9em;
      padding: 0.4rem 1.2rem;
      background: #0e639c;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button.done:hover { background: #1177bb; }
    .status {
      color: #888;
      font-size: 0.85em;
      align-self: center;
      margin-right: auto;
    }
  `;

  @state() private blocks: Block[] = [];
  @state() private comments: Comment[] = [];
  @state() private focusedLine = 1;
  @state() private openCommentLine: number | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    void this._fetchPlan();
    window.addEventListener("keydown", this._onKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this._onKeydown);
  }

  private async _fetchPlan(): Promise<void> {
    const res = await fetch("/plan");
    const data = (await res.json()) as { markdown: string };
    this.blocks = groupBlocks(data.markdown);
    if (this.blocks.length > 0) this.focusedLine = this.blocks[0].startLine;
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
        <span class="status"
          >${this.comments.length === 0
            ? "No comments yet"
            : `${this.comments.length} comment${this.comments.length === 1 ? "" : "s"}`}</span
        >
        <button class="done" @click=${this._submit}>Done reviewing (Ctrl+D)</button>
      </div>
    `;
  }
}
