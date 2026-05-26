<script lang="ts">
  import { Electroview } from "electrobun/view";
  import type { TriamPromptRPC, Snippet, Block } from "../../shared/types";
  import Composer from "./Composer.svelte";
  import SnippetList from "./SnippetList.svelte";

  let queue = $state<Snippet[]>([]);
  let archive = $state<Snippet[]>([]);
  let activeTab = $state<"queue" | "archive">("queue");
  let rpcReady = $state(false);
  let rpcError = $state<string | null>(null);

  let electroview: Electroview | null = null;

  try {
    const rpc = Electroview.defineRPC<TriamPromptRPC>({
      handlers: {
        requests: {},
        messages: {
          stateChanged: ({ queue: q, archive: a }) => {
            queue = q;
            archive = a;
          },
        },
      },
    });

    electroview = new Electroview({ rpc });
    rpcReady = true;
  } catch (e: any) {
    console.error("Electroview init failed:", e);
    rpcError = String(e?.message ?? e);
  }

  $effect(() => {
    if (electroview && rpcReady) {
      electroview.rpc.request.getState({}).then((state) => {
        queue = state.queue;
        archive = state.archive;
      });
    }
  });

  async function handleAddSnippet(blocks: Block[]) {
    if (!electroview) return;
    await electroview.rpc.request.addSnippet({ blocks });
  }

  async function handlePaste(id: string) {
    if (!electroview) return;
    await electroview.rpc.request.pasteSnippet({ id });
  }

  async function handleRemove(id: string) {
    if (!electroview) return;
    await electroview.rpc.request.removeSnippet({ id });
  }

  async function handleReorder(ids: string[]) {
    if (!electroview) return;
    await electroview.rpc.request.reorderSnippets({ ids });
  }

  async function handleRestore(id: string) {
    if (!electroview) return;
    await electroview.rpc.request.restoreSnippet({ id });
  }

  async function handlePasteFromArchive(id: string) {
    if (!electroview) return;
    await electroview.rpc.request.pasteFromArchive({ id });
  }

  async function handleDeleteFromArchive(id: string) {
    if (!electroview) return;
    await electroview.rpc.request.deleteSnippetFromArchive({ id });
  }
</script>

<div class="app-shell">
  <header class="header">
    <span class="logo">TriamPrompt</span>

    <div class="tabs">
      <button
        class="tab"
        class:active={activeTab === "queue"}
        onclick={() => (activeTab = "queue")}
      >
        Queue
        {#if queue.length > 0}
          <span class="badge">{queue.length}</span>
        {/if}
      </button>
      <button
        class="tab"
        class:active={activeTab === "archive"}
        onclick={() => (activeTab = "archive")}
      >
        Archive
        {#if archive.length > 0}
          <span class="badge">{archive.length}</span>
        {/if}
      </button>
    </div>
  </header>

  {#if rpcError}
    <div class="error-banner">
      Connection error: {rpcError}
    </div>
  {/if}

  {#if !rpcReady && !rpcError}
    <div class="loading">
      Connecting to TriamPrompt...
    </div>
  {:else}
    <div class="content">
      {#if activeTab === "queue"}
        <SnippetList
          items={queue}
          mode="queue"
          onpaste={handlePaste}
          onremove={handleRemove}
          onreorder={handleReorder}
        />
      {:else}
        <SnippetList
          items={archive}
          mode="archive"
          onpaste={handlePasteFromArchive}
          onremove={handleDeleteFromArchive}
          onrestore={handleRestore}
          onreorder={() => {}}
        />
      {/if}
    </div>

    {#if activeTab === "queue"}
      <div class="composer-wrapper">
        <Composer oncommit={handleAddSnippet} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }

  .logo {
    font-weight: 700;
    font-size: 14px;
    color: var(--accent);
    letter-spacing: 0.5px;
  }

  .tabs {
    display: flex;
    gap: 4px;
  }

  .tab {
    background: transparent;
    color: var(--text-muted);
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: var(--radius);
  }

  .tab:hover {
    background: var(--surface-hover);
    color: var(--text);
  }

  .tab.active {
    background: var(--surface-active);
    color: var(--text);
  }

  .badge {
    background: var(--accent);
    color: white;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 600;
  }

  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 13px;
  }

  .error-banner {
    padding: 10px 12px;
    background: var(--danger);
    color: white;
    font-size: 12px;
    font-family: var(--font-mono);
    word-break: break-all;
  }

  .content {
    flex: 1;
    overflow-y: auto;
  }

  .composer-wrapper {
    flex-shrink: 0;
  }
</style>
