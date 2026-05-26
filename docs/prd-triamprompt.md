# PRD: TriamPrompt (เตรียม Prompt)

## Problem Statement

When working with AI agents (ChatGPT, Claude, Cursor, etc.), users often have a sequence of follow-up prompts lined up while the agent is processing a previous request. Adding prompts to the agent's queue mid-processing can interrupt or halt it. The user needs a sidecar tool to stage prompts — text and images — without context-switching away from their work, then deliver them sequentially when the agent is ready.

System clipboard managers exist, but none are designed for the prompt-queueing workflow: composing multi-block messages (text + images), reordering priority, consuming on delivery with a safety net (archive + restore), and pasting without leaving the target application.

## Solution

**TriamPrompt** is a small, always-on-top floating panel desktop app. It sits in the corner of the screen while the user works in other applications. The user summons it with a global shortcut (`Cmd+Shift+Space`), composes a prompt (text blocks, pasted images), and sends it to the queue with `Cmd+Enter`. When ready to send the next prompt to the AI agent, the user either clicks the snippet (auto-hides panel, restores focus, pastes) or hits `Cmd+Shift+V` for the next-in-queue. Pasted snippets are consumed into an archive (restorable), keeping the active queue clean.

## User Stories

1. As a user working with an AI agent, I want to compose a prompt with both text instructions and reference images in a single snippet, so that I can send complex context the agent needs all at once.

2. As a user, I want to type or paste text blocks and images in any order within a snippet (e.g., text → image → more text), so that I can structure prompts naturally.

3. As a user, I want to press `Cmd+Enter` to commit my composed prompt to the queue, so that I can quickly build a backlog without touching the mouse.

4. As a user, I want to see my queued prompts in a reorderable list, so that I can reprioritize as the conversation with the AI evolves.

5. As a user, I want to click a queued snippet to paste it into the application behind TriamPrompt, so that I can deliver prompts without switching windows.

6. As a user, I want to press `Cmd+Shift+V` to paste the first item in the queue into whatever app currently has focus, so that I never leave my AI chat window.

7. As a user, I want the panel to auto-hide when I paste a snippet, so that it doesn't obstruct the application receiving the paste.

8. As a user, I want pasted snippets to move to an archive rather than being deleted, so that I can restore a prompt if the AI didn't receive it properly or if I need to send it again.

9. As a user, I want to switch to an Archive tab and restore archived snippets back to the queue, so that I can recover and re-send prompts.

10. As a user, I want the panel to remember its size and position across app restarts, so that I don't have to reposition it every time.

11. As a user, I want my queue and archive to persist to disk, so that I don't lose my work if the app crashes or I restart my machine.

12. As a user, I want to summon and dismiss the panel with a global keyboard shortcut (`Cmd+Shift+Space`), so that I can access my queue without using the mouse.

13. As a user, I want the app to start in the system tray when launched, so that it's available on demand without taking over my screen.

14. As a user, I want to paste snippets that contain multiple blocks (text + image + text) sequentially with one action, so that each block is pasted in the correct order into the target application.

15. As a user, I want to be notified if a paste fails (e.g., clipboard write error), so that I know the snippet wasn't consumed and can try again manually.

16. As a user, I want to remove snippets from the queue individually, so that I can discard prompts I no longer need.

17. As a user, I want to see a preview of each snippet's content in the queue list (text truncated, images as thumbnails), so that I can identify which prompt is which at a glance.

18. As a user, I want to drag snippets to reorder them in the queue, so that I can quickly reorganize without clicking up/down buttons.

19. As a user, I want the paste global shortcut to do nothing when the queue is empty, to avoid accidentally pasting stale clipboard content.

20. As a user, I want the app window to be resizable, so that I can make it wider for long prompts or taller for many queue items.

21. As a user, I want to quit the app from a system tray menu, so that I have a normal exit path for a background app.

22. As a user running macOS, I want paste keystrokes to work correctly via AppleScript, so that the sequential paste is reliable on my platform.

23. As a user running Windows, I want paste keystrokes to work correctly via PowerShell, so that the sequential paste is reliable on my platform.

24. As a user running Linux, I want paste keystrokes to work correctly via xdotool, so that the sequential paste is reliable on my platform.

## Implementation Decisions

### Architecture: Bun-owned state, thin WebView UI

The queue, archive, clipboard operations, OS paste scripts, global shortcuts, and persistence all run in the Bun main process. The WebView (Svelte 5) is a rendering layer that calls Bun via typed RPC for all mutations and receives state-change messages to stay in sync. This avoids sync bugs from dual state ownership and puts OS-level operations where they must live.

### RPC Contract

Typed RPC using Electrobun's `BrowserView.defineRPC` / `Electroview.defineRPC`. Bun handles `bun.requests` for all mutations (add, remove, reorder, paste, restore) and `bun.messages` for pushing state changes to the view. The `webview` side is empty — the view never needs to serve requests from Bun since Bun drives all state.

The RPC schema shape:

```typescript
type TriamPromptRPC = {
  bun: RPCSchema<{
    requests: {
      addSnippet:       { params: { blocks: BlockData[] };                    response: { success: boolean; snippet: Snippet } };
      removeSnippet:    { params: { id: string };                             response: { success: boolean } };
      reorderSnippets:  { params: { ids: string[] };                          response: { success: boolean } };
      restoreSnippet:   { params: { id: string };                             response: { success: boolean } };
      pasteSnippet:     { params: { id: string };                             response: { success: boolean; error?: string } };
      pasteNextInQueue: { params: {};                                         response: { success: boolean; error?: string; snippet?: Snippet } };
      getState:         { params: {};                                         response: { queue: Snippet[]; archive: Snippet[] } };
    };
    messages: {
      stateChanged: { queue: Snippet[]; archive: Snippet[] };
    };
  }>;
  webview: RPCSchema<{ requests: {}; messages: {} }>;
};
```

### Data Model

```typescript
interface TextBlock  { type: 'text';  content: string; }
interface ImageBlock { type: 'image'; content: string; filename?: string; } // base64-encoded PNG
type BlockData = TextBlock | ImageBlock;

interface Snippet {
  id: string;           // UUID
  blocks: BlockData[];  // ordered list of content blocks
  createdAt: number;    // Unix ms timestamp
  consumedAt?: number;  // Unix ms timestamp, set when pasted
}

interface PersistedData {
  queue: Snippet[];
  archive: Snippet[];
  shortcuts: { toggle: string; pasteNext: string };
  windowPosition?: { x: number; y: number; width: number; height: number };
}
```

### Persistence

Single JSON file at `Utils.paths.userData/data/queue.json`. Loaded on startup, saved on every mutation and on `before-quit`. The `shortcuts` and `windowPosition` fields use defaults if absent, making the format forward-compatible.

### Floating Panel Window

- Default size: 450×650, resizable, always-on-top
- Title bar hidden for compact appearance
- Position remembered across restarts (saved on resize/move events)
- Starts visible on launch; tray menu has Show/Hide toggle

### Snippet Composer

Chat-like block builder at the bottom of the panel. Defaults to one empty text block. User can add text blocks, paste images (via paste event interception in the composer container), and remove individual blocks. Textareas auto-resize. `Cmd+Enter` or a commit button sends the current blocks as a new snippet to the queue via RPC. Committing resets the composer to one empty block.

### Sequential Paste Mechanism

For each block in a snippet, the Bun process:
1. Writes the block content to the system clipboard (text or image via `Utils.clipboardWriteText` / `Utils.clipboardWriteImage`)
2. Spawns a platform-specific OS script that sends `Cmd+V` / `Ctrl+V` keystroke
3. Waits 200ms between blocks

The OS scripts are:
- macOS: `osascript -e 'tell application "System Events" to keystroke "v" using command down'`
- Windows: PowerShell `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`
- Linux: `xdotool key ctrl+v`

When triggered by clicking a snippet (panel is focused), the panel minimizes first (300ms delay for focus transition), then pastes. When triggered by global shortcut (panel may be hidden), it pastes directly — the frontmost app receives the keystrokes.

If any clipboard write or OS script spawn fails, the paste aborts, the snippet stays in the queue, and a `Utils.showNotification` alerts the user.

### Queue Reordering

Items use HTML5 drag-and-drop within the SnippetList component. On drop, the view calls `reorderSnippets` with the new ID order. Bun reorders the array, persists, and broadcasts `stateChanged`.

### Archive Behavior

A toggle in the header switches between Queue and Archive views. Archive items show their content with a "Restore" button. Restoring moves the snippet back to the queue (end of list) and clears its `consumedAt`. A "Remove" button permanently deletes from archive.

### Global Shortcuts

- `Cmd+Shift+Space`: Toggle panel visibility (registered via `GlobalShortcut.register`)
- `Cmd+Shift+V`: Paste next-in-queue (ditto)
- Shortcut values are stored in the persisted data. The `shortcuts` field supports future configurable shortcut editing.

### Tray

System tray icon (text label "TriamPrompt" initially, icon image later). Menu: Show/Hide, Quit. Left-click on tray icon toggles the panel.

### Framework

Svelte 5 with runes syntax (`$state`, `$effect`, `$props`). Vite with HMR via existing dev setup.

## Testing Decisions

### Testing Philosophy

Tests should verify external behavior of modules, not implementation details. Focus on the Bun main process modules (queue logic, persistence, paste orchestration) since they contain the business logic. Svelte UI components are tested implicitly through the Bun process tests.

### Testable Deep Modules

1. **Queue Manager** — pure logic module for add, remove, reorder, consume, archive, restore operations on `Snippet[]` arrays. Testable in isolation with no OS dependencies.

2. **Persistence Layer** — read/write of `PersistedData` to the JSON file. Testable by pointing at temp directories.

3. **Paste Orchestrator** — given a list of blocks, determines the correct sequence of clipboard writes and OS script spawns. Mockable OS boundaries.

### Prior Art in Codebase

This is a greenfield Electrobun app. No existing test infrastructure. Tests will use Bun's built-in test runner (`bun test`).

## Out of Scope

- **Multiple queues/projects** — single queue only. The data model supports extension (`queues: Record<string, Queue>`) but no UI for it.
- **Shortcut configuration UI** — shortcuts are stored in persisted data and editable via JSON, but no in-app settings panel.
- **Snippet metadata** — no labels, tags, or timestamps displayed in the UI.
- **Clipboard auto-capture** — user must manually compose in-app. No silent clipboard watching.
- **Rich clipboard (text+image in one paste)** — blocks are pasted sequentially because cross-platform rich clipboard is unreliable.
- **Export/import** — no save/load queue as files.
- **Dark mode / theming** — default system appearance only.
- **Keyboard shortcut for restoring from archive** — mouse-only for now.
- **WebView-based paste** — only OS script-based keystroke dispatch; no `executeJavascript`-based paste injection into web apps.

## Further Notes

- The app name "TriamPrompt" is Thai for "prepare prompt" (เตรียม + Prompt).
- Image blocks are stored as base64 strings in the JSON persistence file. For very large images this could bloat the file; a future optimization would be to store images as separate files in the `userCache` directory.
- The sequential paste timing (200ms between blocks, 300ms after minimize) may need tuning per platform based on testing.
- Linux requires `xdotool` to be installed for paste keystroke dispatch. This is a runtime dependency.
- The `bundleCEF` setting is `false` on all platforms since the native renderer is sufficient for this UI.
