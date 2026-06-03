import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { groupBlocks, parseDiff } from "../blocks.js";
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
    button.help {
      font: inherit;
      font-size: 0.85em;
      padding: 0.2rem 0.6rem;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 3px;
      cursor: pointer;
    }
    button.help:hover { color: var(--text); border-color: var(--text-muted); }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      background: var(--bg-raised);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1.5rem;
      min-width: 340px;
      max-width: 480px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    .modal h2 {
      margin: 0 0 1rem;
      font-size: 1em;
      color: var(--heading);
    }
    .shortcut-table {
      width: 100%;
      border-collapse: collapse;
    }
    .shortcut-table td {
      padding: 0.3rem 0;
      color: var(--text-muted);
      font-size: 0.9em;
    }
    .shortcut-table td:first-child {
      width: 40%;
      white-space: nowrap;
    }
    kbd {
      display: inline-block;
      padding: 0.1em 0.4em;
      font: inherit;
      font-size: 0.85em;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 3px;
      color: var(--text);
      line-height: 1.4;
    }
    .file-nav {
      position: fixed;
      top: 1rem;
      left: 1rem;
      background: var(--bg-raised);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem;
      max-width: 250px;
      z-index: 20;
      font-size: 0.85em;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .file-nav h3 {
      margin: 0 0 0.3rem;
      font-size: 0.9em;
      color: var(--heading);
    }
    .file-nav ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .file-nav li {
      margin: 0.2rem 0;
    }
    .file-nav a {
      color: var(--link);
      text-decoration: none;
      cursor: pointer;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-nav a:hover {
      text-decoration: underline;
    }
    rp-plan-line.sticky-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--bg);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    details[data-file] {
      margin-bottom: 1.5rem;
    }
    details summary {
      position: sticky;
      top: 0;
      z-index: 10;
      display: list-item;
      cursor: pointer;
      padding: 0.5rem 0.75rem;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border);
      border-left: 4px solid var(--accent);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      font-weight: bold;
    }
    details summary:hover {
      background: var(--bg-focused);
    }
    .general-comments-panel {
      position: fixed;
      right: 2rem;
      bottom: 4.5rem;
      width: 380px;
      max-height: 60vh;
      background: var(--bg-raised);
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      z-index: 50;
    }
    .general-comments-header {
      padding: 0.6rem 0.8rem;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      border-top-left-radius: 5px;
      border-top-right-radius: 5px;
    }
    .general-comments-header button {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.3em;
      line-height: 1;
      padding: 0;
    }
    .general-comments-header button:hover {
      color: var(--text);
    }
    .general-comments-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
    }
    .general-comments-footer {
      padding: 0.6rem;
      border-top: 1px solid var(--border);
      background: var(--bg-elevated);
      border-bottom-left-radius: 5px;
      border-bottom-right-radius: 5px;
    }
    .general-comments-add-btn {
      width: 100%;
      padding: 0.4rem;
      background: var(--accent);
      color: var(--accent-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      font-weight: 600;
    }
    .general-comments-add-btn:hover {
      background: var(--accent-hover);
    }
    .floating-toggle {
      position: fixed;
      right: 2rem;
      bottom: 4.5rem;
      background: var(--accent);
      color: var(--accent-text);
      border: none;
      border-radius: 20px;
      padding: 0.6rem 1.2rem;
      cursor: pointer;
      font-weight: bold;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .floating-toggle:hover {
      background: var(--accent-hover);
    }
  `;

  @state() private blocks: Block[] = [];
  @state() private comments: Comment[] = [];
  @state() private focusedLine = 1;
  @state() private openCommentLine: number | null = null;
  @state() private theme = "dark";
  @state() private planTitle = "";
  @state() private showHelp = false;
  @state() private mode = "plan";
  @state() private files: Array<{ name: string; isDeleted: boolean }> = [];
  @state() private editingCommentText = "";
  @state() private showGeneralComments = false;

  private get _generalComments(): Comment[] {
    return this.comments.filter((c) => c.startLine === 0);
  }

  private get _storageKey(): string {
    return `review-plan:comments:${window.location.port}`;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void this._fetchPlan();
    window.addEventListener("keydown", this._onKeydown);
    window.addEventListener("beforeunload", this._onBeforeUnload);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this._onKeydown);
    window.removeEventListener("beforeunload", this._onBeforeUnload);
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has("comments")) {
      if (this.comments.length > 0) {
        localStorage.setItem(this._storageKey, JSON.stringify(this.comments));
      } else {
        localStorage.removeItem(this._storageKey);
      }
    }
  }

  private readonly _onBeforeUnload = (e: BeforeUnloadEvent): void => {
    if (this.comments.length > 0) {
      e.preventDefault();
    }
  };

  private _applyTheme(name: string): void {
    this.theme = name;
    document.documentElement.dataset.theme = name;
  }

  private async _fetchPlan(): Promise<void> {
    const res = await fetch("/plan");
    const data = (await res.json()) as { markdown: string; title?: string; theme?: string; mode?: string };
    this.mode = data.mode ?? "plan";
    
    if (this.mode === "diff") {
      this.blocks = parseDiff(data.markdown);
      this.files = this.blocks
        .filter((b) => b.raw.startsWith("File: "))
        .map((b) => ({ name: b.raw.substring(6), isDeleted: b.isDeleted || false }));
    } else {
      this.blocks = groupBlocks(data.markdown);
    }

    if (this.blocks.length > 0) this.focusedLine = this.blocks[0].startLine;
    if (data.title) {
      this.planTitle = data.title;
      document.title = `review-plan: ${data.title}`;
    }
    this._applyTheme(data.theme ?? "dark");
    const saved = localStorage.getItem(this._storageKey);
    if (saved) {
      try {
        this.comments = JSON.parse(saved) as Comment[];
      } catch { /* ignore corrupted data */ }
    }
  }

  private readonly _onKeydown = (e: KeyboardEvent): void => {
    const inInput = e.composedPath().some(el => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return tag === "textarea" || tag === "input";
    });

    if (e.key === "Escape") {
      if (this.showHelp) { this.showHelp = false; return; }
      this.openCommentLine = null;
      this.editingCommentText = "";
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
      case "?":
        this.showHelp = !this.showHelp;
        break;
    }
  };

  private _moveFocus(delta: number): void {
    const idx = this.blocks.findIndex((b) => b.startLine === this.focusedLine);
    if (idx + delta >= 0 && idx + delta < this.blocks.length) {
      const next = this.blocks[idx + delta];
      this.focusedLine = next.startLine;
    }
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

  private _onRequestComment = (e: CustomEvent<{ startLine: number; endLine: number }>): void => {
    this.focusedLine = e.detail.startLine;
    this.openCommentLine = e.detail.startLine;
  };

  private _onLineFocus = (e: CustomEvent<{ startLine: number }>): void => {
    this.focusedLine = e.detail.startLine;
  };

  private _onCommentSave = (
    e: CustomEvent<{ startLine: number; endLine: number; text: string }>
  ): void => {
    const { startLine, endLine, text } = e.detail;
    this.comments = [...this.comments, { startLine, endLine, text }];
    this.openCommentLine = null;
    this.editingCommentText = "";
  };

  private _onCommentCancel = (): void => {
    this.openCommentLine = null;
    this.editingCommentText = "";
  };

  private _onCommentEdit = (e: CustomEvent<Comment>): void => {
    const target = e.detail;
    this.comments = this.comments.filter((c) => c !== target);
    this.openCommentLine = target.startLine;
    if (target.startLine !== 0) {
      this.focusedLine = target.startLine;
    }
    this.editingCommentText = target.text;
  };

  private _onCommentDelete = (e: CustomEvent<Comment>): void => {
    this.comments = this.comments.filter((c) => c !== e.detail);
  };

  private _renderHelp() {
    return html`
      <div class="backdrop" @click=${() => { this.showHelp = false; }}>
        <div class="modal" @click=${(e: Event) => { e.stopPropagation(); }}>
          <h2>Keyboard shortcuts</h2>
          <table class="shortcut-table">
            <tbody>
              <tr><td><kbd>j</kbd> / <kbd>↓</kbd></td><td>Next block</td></tr>
              <tr><td><kbd>k</kbd> / <kbd>↑</kbd></td><td>Previous block</td></tr>
              <tr><td><kbd>c</kbd></td><td>Comment on focused block</td></tr>
              <tr><td><kbd>n</kbd></td><td>Next comment</td></tr>
              <tr><td><kbd>p</kbd></td><td>Previous comment</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Enter</kbd></td><td>Save comment</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Cancel / close</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>D</kbd></td><td>Submit review</td></tr>
              <tr><td><kbd>?</kbd></td><td>Show this help</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _submit = async (): Promise<void> => {
    await fetch("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: this.comments }),
    });
    localStorage.removeItem(this._storageKey);
    document.body.innerHTML =
      "<p style='padding:2rem;color:#888'>Done! You can close this tab.</p>";
  };

  private _scrollToFile(fileName: string) {
    const block = this.blocks.find((b) => b.raw === `File: ${fileName}`);
    if (block) {
      const el = this.shadowRoot?.querySelector(`details[data-file="${fileName}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      this.focusedLine = block.startLine;
    }
  }

  private get _groupedBlocks() {
    const groups: Array<{ fileName: string | undefined; isDeleted: boolean; blocks: Block[] }> = [];
    let currentGroup: { fileName: string | undefined; isDeleted: boolean; blocks: Block[] } | null = null;

    for (const block of this.blocks) {
      if (!currentGroup || block.fileName !== currentGroup.fileName) {
        currentGroup = {
          fileName: block.fileName,
          isDeleted: block.isDeleted || false,
          blocks: [block]
        };
        groups.push(currentGroup);
      } else {
        currentGroup.blocks.push(block);
      }
    }
    return groups;
  }

  private _renderBlock(block: Block) {
    const blockComments = this.comments.filter(
      (c) => c.startLine === block.startLine
    );
    const isOpen =
      this.openCommentLine !== null &&
      this.openCommentLine >= block.startLine &&
      this.openCommentLine <= block.endLine;
    const isHeader = block.raw.startsWith("File: ");
    return html`
      <rp-plan-line
        data-start-line=${block.startLine}
        class=${isHeader ? "sticky-header" : ""}
        .block=${block}
        .comments=${blockComments}
        ?focused=${this.focusedLine >= block.startLine &&
          this.focusedLine <= block.endLine}
        ?commentOpen=${isOpen}
        .commentText=${isOpen ? this.editingCommentText : ""}
        .isDiff=${this.mode === "diff"}
      ></rp-plan-line>
    `;
  }

  override render() {
    if (this.blocks.length === 0) {
      return html`<p style="color:#888">Loading…</p>`;
    }

    return html`
      ${this.mode === "diff" && this.files.length > 0
        ? html`
            <div class="file-nav">
              <h3>Files</h3>
              <ul>
                ${this.files.map(
                  (file) => html`
                    <li>
                      <a 
                        @click=${() => { this._scrollToFile(file.name); }}
                        style="${file.isDeleted ? 'text-decoration: line-through; color: var(--text-muted);' : ''}"
                      >
                        ${file.name} ${file.isDeleted ? ' [D]' : ''}
                      </a>
                    </li>
                  `
                )}
              </ul>
            </div>
          `
        : ""}
      <div
        @request-comment=${this._onRequestComment}
        @line-focus=${this._onLineFocus}
        @comment-save=${this._onCommentSave}
        @comment-cancel=${this._onCommentCancel}
        @comment-edit=${this._onCommentEdit}
        @comment-delete=${this._onCommentDelete}
      >
        ${this.mode === "diff"
          ? this._groupedBlocks.map((group) => {
              if (!group.fileName) {
                return group.blocks.map((block) => this._renderBlock(block));
              }
              return html`
                <details ?open=${!group.isDeleted} data-file="${group.fileName || ''}">
                  <summary>
                    <strong style="${group.isDeleted ? 'text-decoration: line-through;' : ''}">File: ${group.fileName}</strong>
                    ${group.isDeleted ? html`<span style="color: var(--text-muted);"> (deleted)</span>` : ""}
                  </summary>
                  <div class="file-content">
                    ${group.blocks
                      .filter((block) => !block.raw.startsWith("File: "))
                      .map((block) => this._renderBlock(block))}
                  </div>
                </details>
              `;
            })
          : this.blocks.map((block) => this._renderBlock(block))}
      </div>
      <div class="toolbar">
        ${this.planTitle ? html`<span class="title">${this.planTitle}</span>` : ""}
        <span class="status"
          >${this.comments.length === 0
            ? "No comments yet"
            : `${String(this.comments.length)} comment${this.comments.length === 1 ? "" : "s"}`}</span
        >
        <select
          .value=${this.theme}
          @change=${(e: Event) => { this._applyTheme((e.target as HTMLSelectElement).value); }}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
        <button class="help" @click=${() => { this.showHelp = true; }}>? shortcuts</button>
        <button class="done" @click=${this._submit}>Done reviewing (Ctrl+D)</button>
      </div>
      ${this.showGeneralComments
        ? html`
            <div class="general-comments-panel">
              <div class="general-comments-header">
                <span>General Comments</span>
                <button @click=${() => { this.showGeneralComments = false; }}>×</button>
              </div>
              <div class="general-comments-list">
                ${this._generalComments.map(
                  (c) => html`
                    <rp-comment-thread
                      .comment=${c}
                      @comment-edit=${this._onCommentEdit}
                      @comment-delete=${this._onCommentDelete}
                    ></rp-comment-thread>
                  `
                )}
                ${this._generalComments.length === 0 && this.openCommentLine !== 0
                  ? html`<p style="color: var(--text-muted); font-size: 0.9em; margin: 0.5rem; text-align: center;">No general comments yet.</p>`
                  : ""}
              </div>
              <div class="general-comments-footer">
                ${this.openCommentLine === 0
                  ? html`
                      <rp-comment-box
                        .startLine=${0}
                        .endLine=${0}
                        .text=${this.editingCommentText}
                        @comment-save=${this._onCommentSave}
                        @comment-cancel=${this._onCommentCancel}
                      ></rp-comment-box>
                    `
                  : html`
                      <button
                        class="general-comments-add-btn"
                        @click=${() => { this.openCommentLine = 0; }}
                      >
                        + Add General Comment
                      </button>
                    `}
              </div>
            </div>
          `
        : html`
            <button class="floating-toggle" @click=${() => { this.showGeneralComments = true; }}>
              💬 General Comments (${this._generalComments.length})
            </button>
          `}
      ${this.showHelp ? this._renderHelp() : ""}
    `;
  }
}
