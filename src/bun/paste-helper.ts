import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const HELPER_VERSION = "10";

const SWIFT_SOURCE = `import Cocoa

let args = CommandLine.arguments

if args.count > 1, let targetPid = pid_t(args[1]) {
    if let targetApp = NSRunningApplication(processIdentifier: targetPid) {
        let ok = targetApp.activate(options: [.activateIgnoringOtherApps])
        if !ok {
            FileHandle.standardError.write(Data("activate failed for pid \\(targetPid)\\n".utf8))
        }
    }
}

usleep(100000)

let src = CGEventSource(stateID: .combinedSessionState)
let d = CGEvent(keyboardEventSource: src, virtualKey: 0x09, keyDown: true)!
d.flags = .maskCommand
let u = CGEvent(keyboardEventSource: src, virtualKey: 0x09, keyDown: false)!
u.flags = .maskCommand

d.post(tap: .cghidEventTap)
usleep(50000)
u.post(tap: .cghidEventTap)
`;

let cachedPath: string | null = null;

export function ensurePasteHelper(helperDir: string): string | null {
  if (cachedPath) return cachedPath;

  const helperPath = join(helperDir, "paste-helper");
  const versionPath = join(helperDir, "paste-helper.version");

  if (existsSync(helperPath)) {
    try {
      if (existsSync(versionPath) && readFileSync(versionPath, "utf-8").trim() === HELPER_VERSION) {
        cachedPath = helperPath;
        return helperPath;
      }
    } catch {}
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

  Bun.write(versionPath, HELPER_VERSION);

  cachedPath = helperPath;
  return helperPath;
}

export function runPasteHelper(helperPath: string, targetPID?: number): Promise<boolean> {
  return new Promise((resolve) => {
    const args = targetPID !== undefined ? [helperPath, String(targetPID)] : [helperPath];
    const proc = Bun.spawn({
      cmd: args,
      stdout: "inherit",
      stderr: "inherit",
      onExit: (_proc, exitCode, signal) => {
        resolve(exitCode === 0 && signal === null);
      },
    });
  });
}
