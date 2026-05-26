<script lang="ts">
  import type { Snippet } from "../../shared/types";

  let {
    items,
    mode,
    onpaste = (_id: string) => {},
    onremove = (_id: string) => {},
    onreorder = (_ids: string[]) => {},
    onrestore = (_id: string) => {},
  }: {
    items: Snippet[];
    mode: "queue" | "archive";
    onpaste?: (id: string) => void;
    onremove?: (id: string) => void;
    onreorder?: (ids: string[]) => void;
    onrestore?: (id: string) => void;
  } = $props();

  function previewText(snippet: Snippet): string {
    const textBlock = snippet.blocks.find((b) => b.type === "text");
    if (!textBlock) return "[Image]";
    const content = textBlock.content.trim();
    if (content.length > 100) return content.slice(0, 100) + "...";
    return content || "[Empty]";
  }

  function hasImage(snippet: Snippet): boolean {
    return snippet.blocks.some((b) => b.type === "image");
  }

  function blockCount(snippet: Snippet): string {
    const texts = snippet.blocks.filter((b) => b.type === "text").length;
    const imgs = snippet.blocks.filter((b) => b.type === "image").length;
    const parts: string[] = [];
    if (texts > 0) parts.push(`${texts} text`);
    if (imgs > 0) parts.push(`${imgs} img`);
    return parts.join(" + ");
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const newOrder = [...items];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onreorder(newOrder.map((s) => s.id));
  }

  function moveDown(index: number) {
    if (index >= items.length - 1) return;
    const newOrder = [...items];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onreorder(newOrder.map((s) => s.id));
  }
</script>

{#if items.length === 0}
  <div class="empty">
    {mode === "queue" ? "No prompts queued. Compose below." : "No archived prompts yet."}
  </div>
{:else}
  <div class="list">
    {#each items as snippet, index (snippet.id)}
      <div class="item">
        <div
          class="item-main"
          onclick={() => onpaste(snippet.id)}
          onkeydown={(e) => { if (e.key === 'Enter') onpaste(snippet.id); }}
          role="button"
          tabindex="0"
        >
          <div class="preview">
            <span class="preview-text">{previewText(snippet)}</span>
          </div>
          <div class="meta">
            <span class="block-count">{blockCount(snippet)}</span>
            {#if hasImage(snippet)}
              <span class="has-image">IMG</span>
            {/if}
          </div>
        </div>

        <div class="item-actions">
          {#if mode === "queue"}
            <button
              class="icon-btn"
              onclick={(e) => { e.stopPropagation(); moveUp(index); }}
              disabled={index === 0}
              title="Move up"
            >&#9650;</button>
            <button
              class="icon-btn"
              onclick={(e) => { e.stopPropagation(); moveDown(index); }}
              disabled={index === items.length - 1}
              title="Move down"
            >&#9660;</button>
            <button
              class="icon-btn paste-btn"
              onclick={(e) => { e.stopPropagation(); onpaste(snippet.id); }}
              title="Paste below"
            >&#10148;</button>
          {/if}

          {#if mode === "archive"}
            <button
              class="icon-btn restore-btn"
              onclick={(e) => { e.stopPropagation(); onrestore(snippet.id); }}
              title="Restore to queue"
            >&#8634;</button>
          {/if}

          <button
            class="icon-btn remove-btn"
            onclick={(e) => { e.stopPropagation(); onremove(snippet.id); }}
            title="Remove"
          >&#10005;</button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .empty {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .list {
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 4px;
  }

  .item {
    display: flex;
    align-items: stretch;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .item:hover {
    border-color: var(--accent);
  }

  .item-main {
    flex: 1;
    padding: 8px 10px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    min-width: 0;
  }

  .item-main:hover {
    background: var(--surface-hover);
  }

  .preview-text {
    font-size: 12px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  .meta {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .block-count {
    font-size: 10px;
    color: var(--text-muted);
  }

  .has-image {
    font-size: 10px;
    background: var(--surface-active);
    color: var(--text);
    padding: 0 4px;
    border-radius: 3px;
    font-weight: 600;
  }

  .item-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    background: transparent;
    color: var(--text-muted);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    border-radius: 4px;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    color: var(--text);
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .paste-btn:hover:not(:disabled) {
    color: var(--success);
  }

  .restore-btn:hover {
    color: var(--accent);
  }

  .remove-btn:hover {
    color: var(--danger);
  }
</style>
