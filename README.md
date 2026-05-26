# TriamPrompt

A small, always-on-top floating panel for staging and queueing AI prompts. Compose text-and-image snippets, line them up in priority order, and paste them into any application with a single keystroke — without ever leaving your AI chat window.

> **TriamPrompt** (เตรียม + Prompt) — Thai for "prepare prompt."

## Why

When working with AI agents, you often have follow-up prompts ready while the agent is still processing. TriamPrompt acts as a sidecar clipboard manager: stage prompts as they come to mind, then deliver them one by one when the agent is ready. No context switching, no lost ideas.

## Features

- **Multi-block snippets** — Compose prompts with mixed text and images in any order
- **Queue + Archive** — Pasted snippets move to an archive; restore them anytime
- **Drag-to-reorder** — Reprioritize your queue on the fly
- **Global shortcuts**
  - `Cmd+Shift+Space` — Toggle the panel
  - `Cmd+Shift+V` — Paste the next snippet in queue
- **Sequential paste** — Multi-block snippets paste block-by-block automatically
- **Always-on-top panel** — Stays visible while you work; auto-hides on paste
- **Persistence** — Queue, archive, and window position survive app restarts
- **Cross-platform paste** — macOS, Windows, and Linux support

## Development

```bash
# Install dependencies
bun install

# Run with HMR (recommended)
bun run dev:hmr

# Run without HMR
bun run dev

# Build for distribution
bun run build:canary

# Run tests
bun test
```

## Usage

1. **Summon** the panel with `Cmd+Shift+Space`
2. **Compose** a prompt in the bottom composer — type text or paste images
3. **Commit** with `Cmd+Enter` (or click the button) to add it to the queue
4. **Reorder** queue items by dragging
5. **Paste** the top item with `Cmd+Shift+V`, or click any snippet to paste it directly
6. **Restore** past snippets from the Archive tab if needed

## Architecture

- **Bun main process** (`src/bun/`) — All business logic: queue management, persistence, OS-level clipboard operations, global shortcuts, and paste keystroke dispatch
- **Svelte 5 frontend** (`src/mainview/`) — Thin rendering layer that communicates with Bun via typed RPC
- **Native helpers** — Swift helpers for reliable paste keystroke dispatch and frontmost-app tracking on macOS

## Project Structure

```
├── src/
│   ├── bun/
│   │   ├── index.ts              # Main process entry
│   │   ├── queue-manager.ts      # Queue/archive logic
│   │   ├── paste-orchestrator.ts # Sequential clipboard + keystroke paste
│   │   ├── paste-helper.ts       # Native Swift paste helper compilation
│   │   ├── focus-watcher.ts      # Frontmost app tracker
│   │   └── persistence.ts        # JSON state persistence
│   ├── mainview/
│   │   ├── App.svelte            # Root Svelte component
│   │   ├── Composer.svelte       # Snippet composer UI
│   │   ├── SnippetList.svelte    # Queue/archive list with drag-drop
│   │   └── Settings.svelte       # Shortcut settings
│   └── shared/
│       └── types.ts              # Shared TypeScript types + RPC schema
├── docs/
│   └── prd-triamprompt.md        # Product requirements
├── electrobun.config.ts          # Electrobun app configuration
└── package.json
```

## Tech Stack

- [Electrobun](https://electrobun.dev/) — Bun-native desktop framework
- [Svelte 5](https://svelte.dev/) — Frontend with runes (`$state`, `$effect`)
- [Vite](https://vitejs.dev/) — Build tool with HMR

## License

MIT
