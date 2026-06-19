import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { groupBlocks, parseDiff, groupFilesByDirectory } from "../blocks.js";
import type { Block } from "../blocks.js";
import type { Comment } from "../types.js";
import "./rp-plan-line.js";

@customElement("rp-app")
export class RpApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem 2rem 6rem;
    }
    .layout-container {
      display: flex;
      gap: 2rem;
      align-items: flex-start;
      justify-content: center;
      width: 100%;
    }
    .review-content {
      flex: 1;
      min-width: 0;
      max-width: 1000px;
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
    button.approve {
      font: inherit;
      font-size: 0.9em;
      padding: 0.4rem 1.2rem;
      background: var(--approve-bg);
      color: var(--approve-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button.approve:hover { background: var(--approve-hover); }
    button.reject {
      font: inherit;
      font-size: 0.9em;
      padding: 0.4rem 1.2rem;
      background: var(--reject-bg);
      color: var(--reject-text);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button.reject:hover { background: var(--reject-hover); }
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
      position: sticky;
      top: 2rem;
      background: var(--bg-raised);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.75rem;
      width: 280px;
      min-width: 200px;
      max-width: 600px;
      resize: horizontal;
      overflow: auto;
      max-height: calc(100vh - 10rem);
      z-index: 20;
      font-size: 0.85em;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      flex-shrink: 0;
    }
    .file-nav-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .file-nav-header h3 {
      margin: 0;
      font-size: 0.9em;
      color: var(--heading);
    }
    .toggle-sidebar {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.1em;
      padding: 0.2rem;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .toggle-sidebar:hover {
      color: var(--text);
      background: var(--bg-elevated);
    }
    .toggle-sidebar-expand {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg-raised);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.4rem 0.8rem;
      color: var(--text);
      cursor: pointer;
      font-size: 0.85em;
      margin-bottom: 1rem;
    }
    .toggle-sidebar-expand:hover {
      background: var(--bg-elevated);
    }
    .file-nav ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .file-nav li {
      margin: 0.2rem 0;
    }
    .file-group {
      margin-bottom: 0.75rem;
    }
    .file-group-dir {
      font-size: 0.8em;
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: rtl;
      text-align: left;
    }
    .file-group-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .file-group-list li {
      margin: 0.1rem 0;
    }
    .file-nav a.file-link {
      color: var(--link);
      text-decoration: none;
      cursor: pointer;
      display: block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: background 0.15s ease;
    }
    .file-nav a.file-link:hover {
      background: var(--bg-elevated);
      text-decoration: none;
    }
    .file-nav a.file-link.deleted {
      text-decoration: line-through;
      color: var(--text-muted);
    }
    @media (max-width: 768px) {
      .layout-container {
        flex-direction: column;
      }
      .file-nav {
        position: static;
        width: 100%;
        max-height: 200px;
        resize: none;
      }
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
    .submit-modal textarea {
      width: 100%;
      height: 100px;
      resize: vertical;
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.6rem;
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      box-sizing: border-box;
      margin-top: 0.75rem;
      transition: border-color 0.15s ease;
    }
    .submit-modal textarea:focus { border-color: var(--accent); }
    .submit-modal-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      margin-top: 0.75rem;
    }
    .verdict-label {
      font-weight: 700;
      font-size: 1.1em;
    }
    .verdict-label.approve { color: var(--approve-bg); }
    .verdict-label.reject  { color: var(--reject-bg); }
    button.submit-confirm {
      font: inherit;
      font-size: 0.9em;
      padding: 0.4rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button.submit-confirm.approve {
      background: var(--approve-bg);
      color: var(--approve-text);
    }
    button.submit-confirm.approve:hover { background: var(--approve-hover); }
    button.submit-confirm.reject {
      background: var(--reject-bg);
      color: var(--reject-text);
    }
    button.submit-confirm.reject:hover { background: var(--reject-hover); }
    button.submit-cancel {
      font: inherit;
      font-size: 0.9em;
      padding: 0.4rem 0.8rem;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
    }
    button.submit-cancel:hover { color: var(--text); border-color: var(--text-muted); }
    .wrap-toggle {
      font-size: 0.85em;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.3rem;
      cursor: pointer;
      user-select: none;
    }
    .wrap-toggle:hover {
      color: var(--text);
    }
    .wrap-toggle input {
      cursor: pointer;
      margin: 0;
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
  @state() private sidebarCollapsed = false;
  @state() private showSubmitModal = false;
  @state() private pendingVerdict: "approve" | "reject" | null = null;
  @state() private submitSummary = "";
  @state() private wrapLines = false;
  @state() private _loadError = "";
  @state() private _submitError = "";

  private get _groupedFiles() {
    return groupFilesByDirectory(this.files);
  }

  private get _storageKey(): string {
    return `ai-review:comments:${window.location.port}`;
  }

  private readonly _toggleSidebar = (): void => {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    localStorage.setItem("ai-review:sidebar-collapsed", String(this.sidebarCollapsed));
  };

  override connectedCallback(): void {
    super.connectedCallback();
    void this._fetchPlan();
    window.addEventListener("keydown", this._onKeydown);
    window.addEventListener("beforeunload", this._onBeforeUnload);
    const collapsed = localStorage.getItem("ai-review:sidebar-collapsed");
    this.sidebarCollapsed = collapsed === "true";
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

  private readonly _toggleWrapLines = (e: Event): void => {
    this.wrapLines = (e.target as HTMLInputElement).checked;
    localStorage.setItem("ai-review:wrap-lines", String(this.wrapLines));
  };

  private async _fetchPlan(): Promise<void> {
    let res: Response;
    try {
      res = await fetch("/plan");
    } catch (err) {
      this._loadError = err instanceof Error ? err.message : String(err);
      return;
    }
    if (!res.ok) {
      this._loadError = `Server returned ${String(res.status)}`;
      return;
    }
    const data = (await res.json()) as { markdown: string; title?: string; theme?: string; mode?: string; wrap?: boolean };
    this.mode = data.mode ?? "plan";

    if (data.wrap !== undefined) {
      this.wrapLines = data.wrap;
    } else {
      const saved = localStorage.getItem("ai-review:wrap-lines");
      this.wrapLines = saved !== null ? saved === "true" : true;
    }
    
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
      document.title = `ai-review: ${data.title}`;
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
      if (this.showSubmitModal) { this._cancelSubmit(); return; }
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
      case "a":
        this._openSubmitModal("approve");
        break;
      case "r":
        this._openSubmitModal("reject");
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
              <tr><td><kbd>a</kbd></td><td>Approve review</td></tr>
              <tr><td><kbd>r</kbd></td><td>Request Changes</td></tr>
              <tr><td><kbd>?</kbd></td><td>Show this help</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _openSubmitModal(verdict: "approve" | "reject"): void {
    this.pendingVerdict = verdict;
    this.submitSummary = "";
    this.showSubmitModal = true;
  }

  private readonly _cancelSubmit = (): void => {
    this.showSubmitModal = false;
    this.pendingVerdict = null;
    this.submitSummary = "";
    this._submitError = "";
  };

  private readonly _confirmSubmit = async (): Promise<void> => {
    const verdict = this.pendingVerdict;
    if (!verdict) return;
    const comments = this.submitSummary.trim()
      ? [...this.comments, { startLine: 0, endLine: 0, text: this.submitSummary.trim() }]
      : this.comments;
    try {
      const res = await fetch("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments, verdict }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        this._submitError = body.error ?? `Server returned ${String(res.status)}`;
        return;
      }
    } catch (err) {
      this._submitError = err instanceof Error ? err.message : String(err);
      return;
    }
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
        .theme=${this.theme}
        ?wrap-lines=${this.wrapLines}
      ></rp-plan-line>
    `;
  }

  override render() {
    if (this._loadError) {
      return html`<p style="color:#c0392b">Failed to load review content: ${this._loadError}</p>`;
    }
    if (this.blocks.length === 0) {
      return html`<p style="color:#888">Loading…</p>`;
    }

    return html`
      <div class="layout-container">
        ${this.mode === "diff" && this.files.length > 0 && !this.sidebarCollapsed
          ? html`
              <div class="file-nav">
                <div class="file-nav-header">
                  <h3>Files</h3>
                  <button class="toggle-sidebar" @click=${this._toggleSidebar} title="Collapse sidebar">◂</button>
                </div>
                <ul>
                  ${this._groupedFiles.map((group) => html`
                    <li class="file-group">
                      ${group.dirPath ? html`<div class="file-group-dir" title="${group.dirPath}">${group.dirPath}</div>` : ""}
                      <ul class="file-group-list">
                        ${group.files.map((file) => html`
                          <li>
                            <a 
                              @click=${() => { this._scrollToFile(file.name); }}
                              title="${file.name}${file.isDeleted ? ' (deleted)' : ''}"
                              class="file-link ${file.isDeleted ? 'deleted' : ''}"
                            >
                              ${file.displayName}${file.isDeleted ? ' [D]' : ''}
                            </a>
                          </li>
                        `)}
                      </ul>
                    </li>
                  `)}
                </ul>
              </div>
            `
          : ""}
        <div
          class="review-content"
          @request-comment=${this._onRequestComment}
          @line-focus=${this._onLineFocus}
          @comment-save=${this._onCommentSave}
          @comment-cancel=${this._onCommentCancel}
          @comment-edit=${this._onCommentEdit}
          @comment-delete=${this._onCommentDelete}
        >
          ${this.mode === "diff" && this.files.length > 0 && this.sidebarCollapsed
            ? html`
                <button class="toggle-sidebar-expand" @click=${this._toggleSidebar} title="Expand sidebar">📂 Files</button>
              `
            : ""}
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
        <label class="wrap-toggle">
          <input
            type="checkbox"
            .checked=${this.wrapLines}
            @change=${this._toggleWrapLines}
          />
          Wrap lines
        </label>
        <button class="help" @click=${() => { this.showHelp = true; }}>? shortcuts</button>
        <button class="approve" @click=${() => { this._openSubmitModal("approve"); }}>Approve</button>
        <button class="reject"  @click=${() => { this._openSubmitModal("reject");  }}>Request Changes</button>
      </div>
      ${this.showSubmitModal && this.pendingVerdict ? this._renderSubmitModal() : ""}
      ${this.showHelp ? this._renderHelp() : ""}
    `;
  }

  private _renderSubmitModal() {
    const verdict = this.pendingVerdict;
    if (!verdict) return html``;
    const label = verdict === "approve" ? "Approve" : "Request Changes";
    return html`
      <div class="backdrop" @click=${this._cancelSubmit}>
        <div class="modal submit-modal" @click=${(e: Event) => { e.stopPropagation(); }}>
          <h2>
            Submit as
            <span class="verdict-label ${verdict}">${label}</span>?
          </h2>
          <textarea
            autofocus
            placeholder="Add a summary comment (optional)…"
            .value=${this.submitSummary}
            @input=${(e: Event) => { this.submitSummary = (e.target as HTMLTextAreaElement).value; }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void this._confirmSubmit();
              }
            }}
          ></textarea>
          ${this._submitError ? html`<p style="color:#c0392b;margin:0.5rem 0 0;">${this._submitError}</p>` : ""}
          <div class="submit-modal-actions">
            <button class="submit-cancel" @click=${this._cancelSubmit}>Cancel</button>
            <button class="submit-confirm ${verdict}" @click=${this._confirmSubmit}>
              ${label} (Ctrl+Enter)
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
