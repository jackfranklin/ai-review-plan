import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { AiAnnotation } from "../types.js";

@customElement("rp-ai-annotation")
export class RpAiAnnotation extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .annotation {
      margin: 0.4rem 0;
      border-top: 2px solid var(--ai-annotation-border);
      border-bottom: 1px solid var(--border-muted);
      background: var(--ai-annotation-bg);
      padding: 0.5rem 0.75rem;
    }
    .header {
      font-size: 0.75em;
      font-weight: 600;
      color: var(--ai-annotation-label);
      margin-bottom: 0.35rem;
    }
    .text {
      white-space: pre-wrap;
      color: var(--ai-annotation-text);
    }
  `;

  @property({ attribute: false }) annotation!: AiAnnotation;

  override render() {
    return html`
      <div class="annotation" role="note">
        <div class="header">AI Annotation</div>
        <span class="text">${this.annotation.text}</span>
      </div>
    `;
  }
}
