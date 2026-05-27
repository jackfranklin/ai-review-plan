import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("rp-comment-box")
export class RpCommentBox extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .box {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.5rem;
      background: #2d2d2d;
      border: 1px solid #444;
      border-radius: 4px;
      margin: 0.25rem 0 0.25rem 2rem;
    }
    textarea {
      background: #1e1e1e;
      color: #d4d4d4;
      border: 1px solid #555;
      border-radius: 3px;
      padding: 0.4rem;
      font: inherit;
      resize: vertical;
      min-height: 60px;
      outline: none;
    }
    textarea:focus {
      border-color: #888;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    button {
      font: inherit;
      font-size: 0.85em;
      padding: 0.2rem 0.7rem;
      border-radius: 3px;
      cursor: pointer;
      border: 1px solid #555;
      background: #333;
      color: #d4d4d4;
    }
    button.save {
      background: #0e639c;
      border-color: #0e639c;
      color: #fff;
    }
    button.save:hover { background: #1177bb; }
    button.cancel:hover { background: #444; }
  `;

  @property({ type: Number }) startLine = 0;
  @property({ type: Number }) endLine = 0;

  private _text = "";

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      this._cancel();
      return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      this._save();
    }
  }

  private _save() {
    const text = this._text.trim();
    if (!text) return;
    this.dispatchEvent(
      new CustomEvent("comment-save", {
        detail: { startLine: this.startLine, endLine: this.endLine, text },
        bubbles: true,
        composed: true,
      })
    );
    this._text = "";
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("comment-cancel", { bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <div class="box">
        <textarea
          autofocus
          .value=${this._text}
          placeholder="Leave a comment… (Ctrl+Enter to save)"
          @input=${(e: Event) => { this._text = (e.target as HTMLTextAreaElement).value; }}
          @keydown=${this._onKeydown}
        ></textarea>
        <div class="actions">
          <button class="save" @click=${this._save}>Save</button>
          <button class="cancel" @click=${this._cancel}>Cancel</button>
        </div>
      </div>
    `;
  }
}
