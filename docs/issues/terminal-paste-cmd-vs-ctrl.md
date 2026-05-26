# Paste keystroke uses Cmd+V instead of Ctrl+V for terminal/TUI apps

## Problem

On macOS, the paste helper always sends `Cmd+V` (`.maskCommand`) regardless of the target application. However, terminal-based applications and TUIs (Claude Code, OpenCode, vim, etc.) often expect `Ctrl+V` for paste operations, or their input handling layers intercept `Cmd+V` differently than GUI apps.

This means when a user tries to paste a snippet (especially an image block) into a terminal-based AI CLI, the keystroke either does nothing or triggers the wrong behavior.

## Reproduction Steps

1. Launch TriamPrompt
2. Open a terminal app (e.g., Terminal.app, iTerm2, Warp) running Claude Code or OpenCode
3. Ensure the terminal is the frontmost app
4. Add a snippet with an image block to the queue
5. Press `Cmd+Shift+V` (or click the snippet to paste)

**Expected:** The image should paste into the terminal/AI CLI.
**Actual:** The paste keystroke is silently ignored or misinterpreted because it sends `Cmd+V` instead of `Ctrl+V`.

## Root Cause

The Swift paste helper (`src/bun/paste-helper.ts`) hardcodes the `.maskCommand` flag:

```swift
let d = CGEvent(keyboardEventSource: src, virtualKey: 0x09, keyDown: true)!
d.flags = .maskCommand
```

There is no mechanism to detect the target app type or switch the modifier.

## Proposed Solution

1. **Extend focus-watcher** to emit both PID and bundle identifier (e.g., `1234|com.apple.Terminal`). The Bun-side parser splits on `|` and stores a mapping of PID → bundle ID.

2. **Maintain a terminal bundle ID list** in the Bun main process:
   ```typescript
   const TERMINAL_BUNDLE_IDS = new Set([
     "com.apple.Terminal",
     "com.googlecode.iterm2",
     "dev.warp.Warp-Stable",
     "net.kovidgoyal.kitty",
     "org.alacritty",
     "com.github.wez.wezterm",
     // etc.
   ]);
   ```

3. **Modify the paste helper** to accept a second argument (`cmd` or `ctrl`) and set the `CGEvent` flags accordingly:
   ```swift
   let modifierFlag: CGEventFlags = args.count > 2 && args[2] == "ctrl" ? .maskControl : .maskCommand
   d.flags = modifierFlag
   u.flags = modifierFlag
   ```

4. **Wire it up in `sendPasteKeystroke()`**: look up the target app's bundle ID. If it matches the terminal set, pass `"ctrl"` to `runPasteHelper()`. Otherwise pass `"cmd"`.

5. **Bump version constants** (`WATCHER_VERSION`, `HELPER_VERSION`) to force recompilation.

## Open Questions

- Should the terminal bundle ID list be user-configurable via Settings, or a hardcoded sensible default?
- Do we need to handle other modifier contexts (e.g., `Shift+Ctrl+V` for "paste without formatting" in some terminals)?
- How does this behave with terminal apps running inside containerized environments (e.g., VS Code integrated terminal, which has its own bundle ID)?

## Affected Files

- `src/bun/focus-watcher.ts` — extend Swift watcher to emit bundle ID
- `src/bun/paste-helper.ts` — accept modifier argument, switch flags
- `src/bun/index.ts` — maintain bundle ID → terminal mapping, pass modifier to helper
- `src/shared/types.ts` — potentially expose terminal list in settings schema

## Labels

`bug`, `macOS`, `paste`, `terminal`
