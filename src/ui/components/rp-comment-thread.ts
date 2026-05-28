import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Comment } from "../types.js";

@customElement("rp-comment-thread")
export class RpCommentThread extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .thread {
      margin: 0.4rem 0;
      border-top: 2px solid var(--comment-border);
      border-bottom: 1px solid var(--border-muted);
      background: var(--comment-bg);
      padding: 0.5rem 0.75rem;
    }
    .header {
      font-size: 0.75em;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }
    .body {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .text {
      flex: 1;
      white-space: pre-wrap;
      color: var(--comment-text);
    }
    .actions {
      display: flex;
      gap: 0.4rem;
      flex-shrink: 0;
    }
    button {
      font: inherit;
      font-size: 0.8em;
      padding: 0.1rem 0.5rem;
      border-radius: 3px;
      cursor: pointer;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-muted);
    }
    button:hover { color: var(--text); border-color: var(--text-muted); }
  `;

  @property({ attribute: false }) comment!: Comment;

  private _edit = (): void => {
    this.dispatchEvent(
      new CustomEvent("comment-edit", {
        detail: this.comment,
        bubbles: true,
        composed: true,
      })
    );
  };

  private _delete = (): void => {
    this.dispatchEvent(
      new CustomEvent("comment-delete", {
        detail: this.comment,
        bubbles: true,
        composed: true,
      })
    );
  };

  override render() {
    const { startLine, endLine } = this.comment;
    const lineLabel = startLine === endLine ? `line ${String(startLine)}` : `lines ${String(startLine)}–${String(endLine)}`;
    return html`
      <div class="thread">
        <div class="header">Comment on ${lineLabel}</div>
        <div class="body">
          <span class="text">${this.comment.text}</span>
          <div class="actions">
            <button @click=${this._edit}>Edit</button>
            <button @click=${this._delete}>Delete</button>
          </div>
        </div>
      </div>
    `;
  }
}
