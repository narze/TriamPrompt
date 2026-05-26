import { existsSync } from "node:fs";
import { join } from "node:path";

const SWIFT_SOURCE = `import Cocoa

let args = CommandLine.arguments
if args.count > 1 {
    let ourName = args[1]
    if let prev = NSWorkspace.shared.runningApplications
        .first(where: { app in
            !app.isHidden &&
            app.activationPolicy == .regular &&
            app.localizedName != ourName
        }) {
        prev.activate(options: .activateIgnoringOtherApps)
        usleep(50000)
    }
}

let src = CGEventSource(stateID: .combinedSessionState)

let d = CGEvent(keyboardEventSource: src, virtualKey: 0x09, keyDown: true)!
d.flags = .maskCommand
d.post(tap: .cghidEventTap)

let u = CGEvent(keyboardEventSource: src, virtualKey: 0x09, keyDown: false)!
u.flags = .maskCommand
u.post(tap: .cghidEventTap)
`;

let cachedPath: string | null = null;

export function ensurePasteHelper(helperDir: string): string | null {
  if (cachedPath) return cachedPath;

  const helperPath = join(helperDir, "paste-helper");
  if (existsSync(helperPath)) {
    cachedPath = helperPath;
    return helperPath;
  }

  const srcPath = join(helperDir, "paste-helper.swift");
  Bun.write(srcPath, SWIFT_SOURCE);

  const proc = Bun.spawnSync({
    cmd: ["swiftc", "-o", helperPath, srcPath],
    stdout: "ignore",
    stderr: "pipe",
  });

  try { Bun.file(srcPath).delete(); } catch {}

  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr);
    console.error("Failed to compile paste helper:", stderr);
    return null;
  }

  cachedPath = helperPath;
  return helperPath;
}

export function runPasteHelper(helperPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = Bun.spawn({
      cmd: [helperPath, "TriamPrompt"],
      stdout: "ignore",
      stderr: "ignore",
      onExit: (_proc, exitCode) => {
        resolve(exitCode === 0);
      },
    });
  });
}
