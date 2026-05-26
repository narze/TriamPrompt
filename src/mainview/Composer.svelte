<script lang="ts">
  import type { Block } from "../../shared/types";

  let { oncommit = (_blocks: Block[]) => {} }: { oncommit?: (blocks: Block[]) => void } =
    $props();

  let text = $state("");
  let image: string | null = $state(null);

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
          image = result.split(",")[1];
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        return;
      }
    }
  }

  function removeImage() {
    image = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      commitSnippet();
    }
  }

  function commitSnippet() {
    const blocks: Block[] = [];
    if (text.trim().length > 0) blocks.push({ type: "text", content: text });
    if (image) blocks.push({ type: "image", content: image });

    if (blocks.length === 0) return;

    oncommit(blocks);
    text = "";
    image = null;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="composer" onpaste={handlePaste} onkeydown={handleKeydown}>
  <textarea
    class="text-input"
    placeholder="Type a prompt..."
    rows={Math.max(2, text.split("\n").length)}
    bind:value={text}
  ></textarea>

  {#if image}
    <div class="image-preview">
      <img
        class="thumbnail"
        src={"data:image/png;base64," + image}
        alt=""
      />
      <span class="image-label">Image</span>
      <button class="remove-img" onclick={removeImage}>&#10005;</button>
    </div>
  {/if}

  <div class="composer-actions">
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

  .text-input {
    width: 100%;
    min-height: 40px;
    max-height: 120px;
    box-sizing: border-box;
  }

  .image-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px 8px;
    margin-top: 6px;
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
    flex: 1;
  }

  .remove-img {
    background: var(--danger);
    color: white;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    border-radius: 50%;
  }

  .composer-actions {
    margin-top: 8px;
  }

  .commit-btn {
    background: var(--accent);
    color: white;
    padding: 6px 16px;
    font-size: 12px;
    font-weight: 600;
    width: 100%;
    text-align: center;
  }

  .commit-btn:hover {
    background: var(--accent-hover);
  }
</style>
