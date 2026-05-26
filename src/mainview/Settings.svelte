<script lang="ts">
  import type { Electroview } from "electrobun/view";
  import type { TriamPromptRPC } from "../../shared/types";

  let {
    electroview,
    toggle: initialToggle,
    pasteNext: initialPasteNext,
    refocus: initialRefocus,
  }: {
    electroview: Electroview<TriamPromptRPC> | null;
    toggle: string;
    pasteNext: string;
    refocus: boolean;
  } = $props();

  let toggleField = $state(formatShortcut(initialToggle));
  let pasteNextField = $state(formatShortcut(initialPasteNext));
  let refocusAfterPaste = $state(initialRefocus);
  let recording = $state<"toggle" | "pasteNext" | null>(null);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    toggleField = formatShortcut(initialToggle);
  });
  $effect(() => {
    pasteNextField = formatShortcut(initialPasteNext);
  });
  $effect(() => {
    refocusAfterPaste = initialRefocus;
  });

  function formatShortcut(accel: string): string {
    return accel
      .replace("CommandOrControl", navigator.platform.includes("Mac") ? "Cmd" : "Ctrl")
      .replace("+", " + ");
  }

  function shortcutToAccel(display: string): string {
    return display
      .replace("Cmd", "CommandOrControl")
      .replace("Ctrl", "CommandOrControl")
      .replace(/\s*\+\s*/g, "+");
  }

  function startRecording(field: "toggle" | "pasteNext") {
    recording = field;
    error = null;
    saved = false;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];

    if (e.metaKey) parts.push("Cmd");
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    const key = e.key;
    if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta") return;

    let keyPart = key;
    if (keyPart === " ") keyPart = "Space";
    else if (keyPart.length === 1) keyPart = keyPart.toUpperCase();
    else if (keyPart === "ArrowUp") keyPart = "Up";
    else if (keyPart === "ArrowDown") keyPart = "Down";
    else if (keyPart === "ArrowLeft") keyPart = "Left";
    else if (keyPart === "ArrowRight") keyPart = "Right";

    parts.push(keyPart);
    const display = parts.join(" + ");

    if (recording === "toggle") {
      toggleField = display;
    } else {
      pasteNextField = display;
    }

    recording = null;
  }

  async function save() {
    if (!electroview) return;
    const result = await electroview.rpc.request.updateSettings({
      toggle: shortcutToAccel(toggleField),
      pasteNext: shortcutToAccel(pasteNextField),
      refocusAfterPaste,
    });
    if (result.success) {
      saved = true;
      error = null;
    } else {
      error = result.error ?? "Save failed";
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="settings">
  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  <div class="field">
    <label class="label">Toggle Panel</label>
    <div class="shortcut-group">
      <button
        class="shortcut-input"
        class:recording={recording === "toggle"}
        onclick={() => startRecording("toggle")}
      >
        {toggleField || "Click to record"}
      </button>
      {#if recording === "toggle"}
        <span class="hint">Press keys...</span>
      {/if}
    </div>
  </div>

  <div class="field">
    <label class="label">Paste Next</label>
    <div class="shortcut-group">
      <button
        class="shortcut-input"
        class:recording={recording === "pasteNext"}
        onclick={() => startRecording("pasteNext")}
      >
        {pasteNextField || "Click to record"}
      </button>
      {#if recording === "pasteNext"}
        <span class="hint">Press keys...</span>
      {/if}
    </div>
  </div>

  <div class="field">
    <label class="label">Behavior</label>
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={refocusAfterPaste} onchange={() => (saved = false)} />
      <span class="checkbox-text">Re-focus TriamPrompt after paste</span>
    </label>
  </div>

  <button class="save-btn" onclick={save} disabled={recording !== null}>
    {saved ? "Saved" : "Save"}
  </button>
</div>

<style>
  .settings {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .error-banner {
    padding: 8px 12px;
    background: var(--danger);
    color: white;
    font-size: 12px;
    border-radius: var(--radius);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shortcut-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .shortcut-input {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 8px 12px;
    font-size: 13px;
    font-family: var(--font-mono, monospace);
    min-width: 160px;
    text-align: center;
  }

  .shortcut-input:hover {
    border-color: var(--accent);
  }

  .shortcut-input.recording {
    border-color: var(--accent);
    background: var(--surface-active);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .hint {
    font-size: 11px;
    color: var(--accent);
    font-weight: 500;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .checkbox-text {
    font-size: 13px;
    color: var(--text);
  }

  .save-btn {
    background: var(--accent);
    color: white;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    border-radius: var(--radius);
    margin-top: 4px;
  }

  .save-btn:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
