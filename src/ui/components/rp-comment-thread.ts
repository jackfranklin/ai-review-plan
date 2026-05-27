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
      margin: 0.25rem 0 0.25rem 2rem;
      padding: 0.4rem 0.6rem;
      border-left: 3px solid #555;
      background: #252526;
      border-radius: 0 3px 3px 0;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .text {
      flex: 1;
      white-space: pre-wrap;
      color: #ccc;
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
      border: 1px solid #555;
      background: transparent;
      color: #888;
    }
    button:hover { color: #ccc; border-color: #888; }
  `;

  @property({ attribute: false }) comment!: Comment;

  private _edit() {
    this.dispatchEvent(
      new CustomEvent("comment-edit", {
        detail: this.comment,
        bubbles: true,
        composed: true,
      })
    );
  }

  private _delete() {
    this.dispatchEvent(
      new CustomEvent("comment-delete", {
        detail: this.comment,
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    return html`
      <div class="thread">
        <span class="text">${this.comment.text}</span>
        <div class="actions">
          <button @click=${this._edit}>Edit</button>
          <button @click=${this._delete}>Delete</button>
        </div>
      </div>
    `;
  }
}
