import { LitElement, html, css } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { customElement, property } from "lit/decorators.js";
import { marked } from "marked";
import type { Comment } from "../types.js";
import { parseLineIndent, type Block } from "../blocks.js";
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
      background: var(--bg-focused);
    }
    .gutter {
      width: 4rem;
      flex-shrink: 0;
      text-align: right;
      padding-right: 0.75rem;
      color: var(--gutter-text);
      font-size: 0.8em;
      line-height: 1.6;
      user-select: none;
      cursor: pointer;
      position: relative;
    }
    .gutter.is-diff {
      width: 6rem;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding-right: 0.5rem;
    }
    .diff-ln {
      width: 2.5rem;
      text-align: right;
    }
    .gutter:hover .plus {
      opacity: 1;
      color: var(--accent);
    }
    .plus {
      opacity: 0;
      color: var(--gutter-plus);
      font-size: 1.4em;
      font-weight: bold;
      line-height: 1;
      transition: opacity 0.1s, color 0.1s;
    }
    .content {
      flex: 1;
      min-width: 0;
      padding: 0 0.25rem;
    }
    .content > * {
      margin: 0;
    }
    .content h1, .content h2, .content h3,
    .content h4, .content h5, .content h6 {
      color: var(--heading);
      margin: 0.8em 0 0.2em;
      line-height: 1.3;
    }
    .content h1 { font-size: 1.4em; border-bottom: 1px solid var(--heading-rule); padding-bottom: 0.2em; }
    .content h2 { font-size: 1.2em; }
    .content h3 { font-size: 1.05em; }
    .content p { margin: 0.2em 0; }
    .content ul, .content ol { margin: 0.2em 0; padding-left: 1.4em; }
    .content li { margin: 0.1em 0; }
    .content code {
      background: var(--code-bg);
      border: 1px solid var(--code-border);
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    .content pre {
      background: var(--code-bg);
      border: 1px solid var(--code-border);
      padding: 0.7em 1em;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0.3em 0;
    }
    .content pre code {
      background: none;
      border: none;
      padding: 0;
    }
    .content blockquote {
      border-left: 3px solid var(--bq-border);
      margin: 0.3em 0;
      padding-left: 0.8em;
      color: var(--bq-text);
    }
    .content table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.3em 0;
    }
    .content th, .content td {
      border: 1px solid var(--table-border);
      padding: 0.3em 0.6em;
    }
    .content th { background: var(--table-header-bg); }
    .content a { color: var(--link); }
    .content hr { border: none; border-top: 1px solid var(--border-muted); margin: 0.5em 0; }
    .diff-add { background: var(--diff-add-bg); color: var(--diff-add-text); }
    .diff-del { background: var(--diff-del-bg); color: var(--diff-del-text); }
    .diff-file-header { background: var(--bg-elevated); font-weight: bold; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border); border-left: 4px solid var(--accent); }
  `;

  @property({ attribute: false }) block!: Block;
  @property({ attribute: false }) comments: Comment[] = [];
  @property({ type: Boolean }) focused = false;
  @property({ type: Boolean }) commentOpen = false;
  @property({ type: Boolean }) isDiff = false;

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

  private _onLineDblClick(e: MouseEvent) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("request-comment", {
        detail: { startLine: this.block.startLine, endLine: this.block.endLine },
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    const lineLabel =
      this.block.startLine === this.block.endLine
        ? String(this.block.startLine)
        : `${String(this.block.startLine)}–${String(this.block.endLine)}`;

    let contentHtml;
    let wrapClass = `line-wrap ${this.block.startLine !== this.block.endLine ? "multiline" : ""} ${this.focused ? "focused" : ""}`;
    let indent = 0;

    if (this.isDiff) {
      if (this.block.raw.startsWith("File: ")) {
        wrapClass += " diff-file-header";
        contentHtml = html`<strong style="font-family:inherit;">${this.block.raw.substring(6)}</strong>`;
      } else {
        const firstChar = this.block.raw[0];
        if (firstChar === '+') wrapClass += " diff-add";
        if (firstChar === '-') wrapClass += " diff-del";
        contentHtml = html`<pre style="margin:0; font:inherit;"><code>${this.block.raw}</code></pre>`;
      }
    } else {
      const parsed = parseLineIndent(this.block.raw);
      indent = parsed.indent;
      const rendered = marked.parse(parsed.raw) as string;
      contentHtml = html`${unsafeHTML(rendered)}`;
    }

    return html`
      <div class="${wrapClass}" @click=${() => { this._onLineClick(); }} @dblclick=${(e: MouseEvent) => { this._onLineDblClick(e); }}>
        <div class="gutter ${this.isDiff ? "is-diff" : ""}" @click=${(e: Event) => { e.stopPropagation(); this._onGutterClick(); }}>
          <span class="plus">+</span>
          ${this.isDiff
            ? html`
                <span class="diff-ln">${this.block.oldLine !== undefined ? String(this.block.oldLine) : ""}</span>
                <span class="diff-ln">${this.block.newLine !== undefined ? String(this.block.newLine) : ""}</span>
              `
            : html`<span>${lineLabel}</span>`}
        </div>
        <div class="content" style="${indent > 0 ? `padding-left: ${String(indent * 0.5)}rem;` : ''}">
          ${contentHtml}
        </div>
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
