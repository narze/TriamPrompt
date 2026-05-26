import Electrobun, {
  BrowserWindow,
  BrowserView,
  Tray,
  Utils,
  GlobalShortcut,
  Updater,
} from "electrobun/bun";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { QueueManager } from "./queue-manager";
import { Persistence } from "./persistence";
import { PasteOrchestrator } from "./paste-orchestrator";
import { ensurePasteHelper, runPasteHelper } from "./paste-helper";
import { ensureFocusWatcher, startFocusWatcher } from "./focus-watcher";
import type { TriamPromptRPC } from "../shared/types";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const DEFAULT_TOGGLE = "CommandOrControl+Shift+Space";
const DEFAULT_PASTE = "CommandOrControl+Shift+V";

let queueManager = new QueueManager();
let persistence: Persistence;
let pasteOrchestrator: PasteOrchestrator;
let mainWindow: BrowserWindow | null = null;
let shortcuts = { toggle: DEFAULT_TOGGLE, pasteNext: DEFAULT_PASTE };
let mainViewUrl = "";

let lastFocusedAppPID: number | null = null;
let focusWatcherStop: (() => void) | null = null;
let refocusAfterPaste = false;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running.");
    }
  }
  return "views://mainview/index.html";
}

function getDataPath(): string {
  const dir = join(Utils.paths.userData, "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "queue.json");
}

function getWindowPosition() {
  if (!mainWindow) return undefined;
  const f = mainWindow.getFrame();
  return { x: f.x, y: f.y, width: f.width, height: f.height };
}

function broadcastState() {
  const state = queueManager.getState();
  mainWindow?.webview.rpc.send.stateChanged(state);
}

async function persistAndBroadcast() {
  await persistence.save({
    ...queueManager.getState(),
    shortcuts,
    windowPosition: getWindowPosition(),
  });
  broadcastState();
}

function getPasteCommand(): string[] {
  const p = process.platform;
  if (p === "win32")
    return ["powershell", "-Command", "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"];
  return ["xdotool", "key", "ctrl+v"];
}

function getInitialFrontmostPID(myPid: number): number | null {
  const proc = Bun.spawnSync({
    cmd: ["osascript", "-e", 'tell application "System Events" to return unix id of first application process whose frontmost is true'],
    stdout: "pipe",
    stderr: "ignore",
  });
  if (proc.exitCode === 0) {
    const pid = parseInt(new TextDecoder().decode(proc.stdout).trim());
    if (!isNaN(pid) && pid > 0 && pid !== myPid) return pid;
  }
  return null;
}

function getHelperDir(): string {
  const dir = join(Utils.paths.userData, "bin");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

async function handlePaste(id: string) {
  console.log(`[paste] handlePaste id=${id.slice(0,8)} storedPID=${lastFocusedAppPID}`);

  const state = queueManager.getState();
  const snippet = state.queue.find((s) => s.id === id);
  if (!snippet) return { success: false, error: "Snippet not found" } as const;

  const ok = await pasteOrchestrator.execute(snippet.blocks);
  if (!ok) {
    Utils.showNotification({
      title: "TriamPrompt",
      body: "Paste failed. Snippet remains in queue.",
    });
    return { success: false, error: "Paste failed" } as const;
  }

  queueManager.consumeSnippet(id);
  await persistAndBroadcast();

  if (mainWindow && !mainWindow.isMinimized() && refocusAfterPaste) {
    mainWindow.focus();
  }

  return { success: true } as const;
}

async function handlePasteNext() {
  console.log(`[paste] handlePasteNext storedPID=${lastFocusedAppPID}`);
  const state = queueManager.getState();
  if (state.queue.length === 0)
    return { success: false, error: "Queue is empty" } as const;

  const snippet = state.queue[0];

  const ok = await pasteOrchestrator.execute(snippet.blocks);
  if (!ok) {
    Utils.showNotification({
      title: "TriamPrompt",
      body: "Paste failed. Snippet remains in queue.",
    });
    return { success: false, error: "Paste failed" } as const;
  }

  queueManager.consumeSnippet(snippet.id);
  await persistAndBroadcast();
  return { success: true, snippet } as const;
}

async function handlePasteFromArchive(id: string) {
  const snippet = queueManager.getSnippetFromArchive(id);
  if (!snippet) return { success: false, error: "Snippet not found" } as const;

  const ok = await pasteOrchestrator.execute(snippet.blocks);
  if (!ok) {
    Utils.showNotification({
      title: "TriamPrompt",
      body: "Paste failed.",
    });
    return { success: false, error: "Paste failed" } as const;
  }

  if (mainWindow && !mainWindow.isMinimized() && refocusAfterPaste) {
    mainWindow.focus();
  }

  return { success: true } as const;
}

function defineRPC() {
  return BrowserView.defineRPC<TriamPromptRPC>({
    handlers: {
      requests: {
        addSnippet: async ({ blocks }) => {
          const snippet = queueManager.addSnippet(blocks);
          await persistAndBroadcast();
          return { success: true, snippet };
        },
        removeSnippet: async ({ id }) => {
          const ok = queueManager.removeSnippet(id);
          if (ok) await persistAndBroadcast();
          return { success: ok };
        },
        reorderSnippets: async ({ ids }) => {
          const ok = queueManager.reorderSnippets(ids);
          if (ok) await persistAndBroadcast();
          return { success: ok };
        },
        restoreSnippet: async ({ id }) => {
          const ok = queueManager.restoreSnippet(id);
          if (ok) await persistAndBroadcast();
          return { success: ok };
        },
        pasteSnippet: ({ id }) => handlePaste(id),
        pasteFromArchive: ({ id }) => handlePasteFromArchive(id),
        pasteNextInQueue: () => handlePasteNext(),
        deleteSnippetFromArchive: async ({ id }) => {
          const ok = queueManager.deleteFromArchive(id);
          if (ok) await persistAndBroadcast();
          return { success: ok };
        },
        getSettings: () => ({ ...shortcuts, refocusAfterPaste }),
        updateSettings: async ({ toggle, pasteNext, refocusAfterPaste: refocus }) => {
          try {
            if (refocus !== undefined) refocusAfterPaste = refocus;
            if (toggle && pasteNext) {
              reregisterShortcuts({ toggle, pasteNext });
            }
            await persistence.save({
              ...queueManager.getState(),
              shortcuts,
              refocusAfterPaste,
              windowPosition: getWindowPosition(),
            });
            mainWindow?.webview.rpc.send.shortcutsUpdated({
              ...shortcuts,
              refocusAfterPaste,
            });
            return { success: true };
          } catch (e: any) {
            return { success: false, error: String(e.message ?? e) };
          }
        },
        getState: () => queueManager.getState(),
      },
      messages: {},
    },
  });
}

function createWindow(): BrowserWindow {
  const rpc = defineRPC();

  const win = new BrowserWindow({
    title: "TriamPrompt",
    url: mainViewUrl,
    frame: { width: 450, height: 650, x: 200, y: 200 },
    rpc,
  });

  win.setAlwaysOnTop(true);

  win.on("close", () => {
    mainWindow = null;
  });

  win.on("resize", () => {
    const pos = getWindowPosition();
    if (pos) {
      persistence.save({
        ...queueManager.getState(),
        shortcuts,
        windowPosition: pos,
      });
    }
  });

  win.on("move", () => {
    const pos = getWindowPosition();
    if (pos) {
      persistence.save({
        ...queueManager.getState(),
        shortcuts,
        windowPosition: pos,
      });
    }
  });

  return win;
}

function toggleWindow() {
  console.log(`[paste] toggleWindow, storedPID=${lastFocusedAppPID}`);
  if (!mainWindow) {
    console.log(`[paste] creating window`);
    mainWindow = createWindow();
    broadcastState();
    return;
  }
  if (mainWindow.isMinimized()) {
    console.log(`[paste] unminimizing`);
    mainWindow.unminimize();
    mainWindow.focus();
  } else {
    console.log(`[paste] minimizing`);
    mainWindow.minimize();
  }
}

function registerShortcuts() {
  GlobalShortcut.register(shortcuts.toggle, () => toggleWindow());
  GlobalShortcut.register(shortcuts.pasteNext, async () => {
    const result = await handlePasteNext();
    if (!result.success && result.error) {
      Utils.showNotification({
        title: "TriamPrompt",
        body: result.error,
      });
    }
  });
}

function reregisterShortcuts(newShortcuts: { toggle: string; pasteNext: string }) {
  GlobalShortcut.unregisterAll();
  shortcuts = newShortcuts;
  registerShortcuts();
}

function createTray() {
  const tray = new Tray({ title: "TriamPrompt" });
  tray.setMenu([
    { type: "normal", label: "Show/Hide", action: "toggle" },
    { type: "divider" },
    { type: "normal", label: "Quit", action: "quit" },
  ]);

  tray.on("tray-clicked", (e) => {
    if (!e.data.action) {
      toggleWindow();
      return;
    }
    if (e.data.action === "toggle") toggleWindow();
    if (e.data.action === "quit") Utils.quit();
  });
}

async function main() {
  mainViewUrl = await getMainViewUrl();

  persistence = new Persistence(getDataPath());
  const data = await persistence.load();
  queueManager = new QueueManager({ queue: data.queue, archive: data.archive });
  shortcuts = data.shortcuts;
  refocusAfterPaste = data.refocusAfterPaste ?? false;

  pasteOrchestrator = new PasteOrchestrator({
    writeText: (text) => Utils.clipboardWriteText(text),
    writeImage: (data) => Utils.clipboardWriteImage(data),
    sendPasteKeystroke: async () => {
      if (process.platform === "darwin") {
        const helperPath = ensurePasteHelper(getHelperDir());
        if (!helperPath) {
          console.error("[paste] helper not available");
          return false;
        }
        const targetPID = lastFocusedAppPID ?? undefined;
        console.log(`[paste] CGEventPostToPid target=${targetPID}`);
        const ok = await runPasteHelper(helperPath, targetPID);
        console.log(`[paste] result=${ok}`);
        return ok;
      }
      try {
        const cmd = getPasteCommand();
        const proc = Bun.spawn({ cmd, stdout: "ignore", stderr: "ignore" });
        await proc.exited;
        return proc.exitCode === 0;
      } catch {
        return false;
      }
    },
  });

  mainWindow = createWindow();

  if (data.windowPosition) {
    const { x, y, width, height } = data.windowPosition;
    mainWindow.setFrame(x, y, width, height);
  }

  registerShortcuts();
  createTray();

  broadcastState();

  const watcherPath = ensureFocusWatcher(getHelperDir());
  if (watcherPath) {
    const myPid = process.pid;
    lastFocusedAppPID = getInitialFrontmostPID(myPid);
    console.log(`[focus-watcher] initial pid=${lastFocusedAppPID}`);
    focusWatcherStop = startFocusWatcher(watcherPath, myPid, (pid: number) => {
      lastFocusedAppPID = pid;
      console.log(`[focus-watcher] app switched → pid=${pid}`);
    }).stop;
  } else {
    console.error("[focus-watcher] failed to start — paste target tracking disabled");
  }

  Electrobun.events.on("before-quit", async () => {
    focusWatcherStop?.();
    await persistence.save({
      ...queueManager.getState(),
      shortcuts,
      refocusAfterPaste,
      windowPosition: getWindowPosition(),
    });
    GlobalShortcut.unregisterAll();
  });

  console.log("TriamPrompt started!");
}

main().catch(console.error);
