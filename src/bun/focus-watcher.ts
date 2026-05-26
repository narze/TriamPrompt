import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WATCHER_VERSION = "1";

const SWIFT_SOURCE = `import Cocoa

let center = NSWorkspace.shared.notificationCenter
center.addObserver(
    forName: NSWorkspace.didActivateApplicationNotification,
    object: nil,
    queue: nil
) { notification in
    if let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication {
        print(app.processIdentifier)
        fflush(stdout)
    }
}

RunLoop.main.run()
`;

let cachedPath: string | null = null;

export function ensureFocusWatcher(helperDir: string): string | null {
  if (cachedPath) return cachedPath;

  const watcherPath = join(helperDir, "focus-watcher");
  const versionPath = join(helperDir, "focus-watcher.version");

  if (existsSync(watcherPath)) {
    try {
      if (existsSync(versionPath) && readFileSync(versionPath, "utf-8").trim() === WATCHER_VERSION) {
        cachedPath = watcherPath;
        return watcherPath;
      }
    } catch {}
  }

  const srcPath = join(helperDir, "focus-watcher.swift");
  Bun.write(srcPath, SWIFT_SOURCE);

  const proc = Bun.spawnSync({
    cmd: ["swiftc", "-o", watcherPath, srcPath],
    stdout: "ignore",
    stderr: "pipe",
  });

  try { Bun.file(srcPath).delete(); } catch {}

  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    console.error("Failed to compile focus watcher:", stderr);
    return null;
  }

  Bun.write(versionPath, WATCHER_VERSION);

  cachedPath = watcherPath;
  return watcherPath;
}

export function startFocusWatcher(
  watcherPath: string,
  myPid: number,
  onFocusChange: (pid: number) => void,
): { stop: () => void } {
  const proc = Bun.spawn({
    cmd: [watcherPath],
    stdout: "pipe",
    stderr: "inherit",
  });

  let buffer = "";

  async function readLoop() {
    const reader = proc.stdout.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += new TextDecoder().decode(value);
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const pid = parseInt(trimmed);
        if (!isNaN(pid) && pid > 0 && pid !== myPid) {
          onFocusChange(pid);
        }
      }
    }
  }

  readLoop().catch((err) => {
    console.error("[focus-watcher] read error:", err);
  });

  return {
    stop: () => {
      proc.kill();
    },
  };
}
