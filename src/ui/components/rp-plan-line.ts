import { LitElement, html, css } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { customElement, property } from "lit/decorators.js";
import { marked } from "marked";
import type { Comment } from "../types.js";
import type { Block } from "../blocks.js";
import "./rp-comment-box.js";
import "./rp-comment-thread.js";

@customElement("rp-plan-line")
export class RpPlanLine extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .line-wrap {
      display: flex;
      align-items: center;
      border-radius: 3px;
    }
    .line-wrap.multiline {
      align-items: flex-start;
    }
    .line-wrap.focused {
      background: #2a2d2e;
    }
    .gutter {
      width: 4rem;
      flex-shrink: 0;
      text-align: right;
      padding-right: 0.75rem;
      color: #555;
      font-size: 0.8em;
      line-height: 1.6;
      user-select: none;
      cursor: pointer;
      position: relative;
    }
    .gutter:hover .plus {
      opacity: 1;
    }
    .plus {
      opacity: 0;
      color: #888;
      transition: opacity 0.1s;
    }
    .content {
      flex: 1;
      min-width: 0;
      padding: 0 0.25rem;
    }
    .content > * {
      margin: 0;
    }
    /* prose styles inside shadow DOM */
    .content h1, .content h2, .content h3,
    .content h4, .content h5, .content h6 {
      color: #e0e0e0;
      margin: 0.8em 0 0.2em;
      line-height: 1.3;
    }
    .content h1 { font-size: 1.4em; border-bottom: 1px solid #333; padding-bottom: 0.2em; }
    .content h2 { font-size: 1.2em; }
    .content h3 { font-size: 1.05em; }
    .content p { margin: 0.2em 0; }
    .content ul, .content ol { margin: 0.2em 0; padding-left: 1.4em; }
    .content li { margin: 0.1em 0; }
    .content code {
      background: #2d2d2d;
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    .content pre {
      background: #2d2d2d;
      padding: 0.7em 1em;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0.3em 0;
    }
    .content pre code {
      background: none;
      padding: 0;
    }
    .content blockquote {
      border-left: 3px solid #555;
      margin: 0.3em 0 0.3em 0;
      padding-left: 0.8em;
      color: #aaa;
    }
    .content table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.3em 0;
    }
    .content th, .content td {
      border: 1px solid #444;
      padding: 0.3em 0.6em;
    }
    .content th { background: #2d2d2d; }
    .content a { color: #4ec9b0; }
    .content hr { border: none; border-top: 1px solid #333; margin: 0.5em 0; }
  `;

  @property({ attribute: false }) block!: Block;
  @property({ attribute: false }) comments: Comment[] = [];
  @property({ type: Boolean }) focused = false;
  @property({ type: Boolean }) commentOpen = false;

  private _onGutterClick() {
    this.dispatchEvent(
      new CustomEvent("request-comment", {
        detail: { startLine: this.block.startLine, endLine: this.block.endLine },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onLineClick() {
    this.dispatchEvent(
      new CustomEvent("line-focus", {
        detail: { startLine: this.block.startLine },
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    const rendered = marked.parse(this.block.raw) as string;
    const lineLabel =
      this.block.startLine === this.block.endLine
        ? `${this.block.startLine}`
        : `${this.block.startLine}–${this.block.endLine}`;

    return html`
      <div class="line-wrap ${this.block.startLine !== this.block.endLine ? "multiline" : ""} ${this.focused ? "focused" : ""}" @click=${this._onLineClick}>
        <div class="gutter" @click=${(e: Event) => { e.stopPropagation(); this._onGutterClick(); }}>
          <span class="plus">+</span>
          <span>${lineLabel}</span>
        </div>
        <div class="content">${unsafeHTML(rendered)}</div>
      </div>
      ${this.commentOpen
        ? html`<rp-comment-box
            .startLine=${this.block.startLine}
            .endLine=${this.block.endLine}
          ></rp-comment-box>`
        : ""}
      ${this.comments.map(
        (c) => html`<rp-comment-thread .comment=${c}></rp-comment-thread>`
      )}
    `;
  }
}
