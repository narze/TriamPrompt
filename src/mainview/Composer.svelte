<script lang="ts">
  import type { Block } from "../../shared/types";

  let { oncommit = (_blocks: Block[]) => {} }: { oncommit?: (blocks: Block[]) => void } =
    $props();

  interface ComposerBlock {
    id: string;
    type: "text" | "image";
    content: string;
  }

  let blocks = $state<ComposerBlock[]>([
    { id: crypto.randomUUID(), type: "text", content: "" },
  ]);

  function addTextBlock() {
    blocks.push({ id: crypto.randomUUID(), type: "text", content: "" });
  }

  function removeBlock(id: string) {
    if (blocks.length <= 1) return;
    blocks = blocks.filter((b) => b.id !== id);
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (!blob) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          blocks = [
            ...blocks,
            { id: crypto.randomUUID(), type: "image", content: base64 },
          ];
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        return;
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      commitSnippet();
    }
  }

  function commitSnippet() {
    const validBlocks: Block[] = [];
    for (const b of blocks) {
      if (b.type === "text" && b.content.trim().length === 0) continue;
      if (b.type === "image") {
        validBlocks.push({ type: "image", content: b.content });
      } else {
        validBlocks.push({ type: "text", content: b.content });
      }
    }

    if (validBlocks.length === 0) return;

    oncommit(validBlocks);
    blocks = [{ id: crypto.randomUUID(), type: "text", content: "" }];
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="composer" onpaste={handlePaste} onkeydown={handleKeydown}>
  <div class="blocks">
    {#each blocks as block (block.id)}
      <div class="block">
        {#if block.type === "text"}
          <textarea
            class="text-block"
            placeholder="Type a prompt..."
            rows={Math.max(2, block.content.split("\n").length)}
            bind:value={block.content}
          ></textarea>
        {:else}
          <div class="image-block">
            <img
              class="thumbnail"
              src={"data:image/png;base64," + block.content}
              alt=""
            />
            <span class="image-label">Image</span>
          </div>
        {/if}

        {#if blocks.length > 1}
          <button class="remove-block" onclick={() => removeBlock(block.id)}>
            &#10005;
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <div class="composer-actions">
    <button class="add-btn" onclick={addTextBlock}>+ Text Block</button>
    <button class="commit-btn" onclick={commitSnippet}>
      Add to Queue (Cmd+Enter)
    </button>
  </div>
</div>

<style>
  .composer {
    border-top: 1px solid var(--border);
    background: var(--surface);
    padding: 8px;
  }

  .blocks {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .block {
    position: relative;
  }

  .text-block {
    width: 100%;
    min-height: 40px;
    max-height: 100px;
  }

  .image-block {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px 8px;
  }

  .thumbnail {
    max-width: 48px;
    max-height: 48px;
    border-radius: 4px;
    object-fit: cover;
  }

  .image-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .remove-block {
    position: absolute;
    top: 4px;
    right: 4px;
    background: var(--danger);
    color: white;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .block:hover .remove-block {
    opacity: 1;
  }

  .composer-actions {
    display: flex;
    gap: 6px;
    justify-content: space-between;
  }

  .add-btn {
    background: var(--surface-hover);
    color: var(--text-muted);
    padding: 6px 12px;
    font-size: 12px;
  }

  .add-btn:hover {
    background: var(--border);
    color: var(--text);
  }

  .commit-btn {
    background: var(--accent);
    color: white;
    padding: 6px 16px;
    font-size: 12px;
    font-weight: 600;
    flex: 1;
    text-align: center;
  }

  .commit-btn:hover {
    background: var(--accent-hover);
  }
</style>
