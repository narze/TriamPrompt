import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { unlinkSync, mkdirSync, rmdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Persistence } from "../persistence";
import type { PersistedData } from "../../shared/types";

const TEST_DIR = join(import.meta.dir!, ".test-persistence");

function testPath(filename: string): string {
  return join(TEST_DIR, filename);
}

function sampleData(): PersistedData {
  return {
    queue: [
      {
        id: "q1",
        blocks: [{ type: "text", content: "hello" }],
        createdAt: 1000,
      },
      {
        id: "q2",
        blocks: [
          { type: "text", content: "look" },
          { type: "image", content: "base64png" },
        ],
        createdAt: 2000,
      },
    ],
    archive: [
      {
        id: "a1",
        blocks: [{ type: "text", content: "done" }],
        createdAt: 500,
        consumedAt: 1500,
      },
    ],
    shortcuts: {
      toggle: "Cmd+Shift+Space",
      pasteNext: "Cmd+Shift+V",
    },
    windowPosition: { x: 100, y: 200, width: 450, height: 650 },
  };
}

describe("Persistence", () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      try { rmdirSync(TEST_DIR, { recursive: true }); } catch {}
    }
  });

  it("saves and loads data correctly (round-trip)", async () => {
    const path = testPath("data.json");
    const p = new Persistence(path);
    const data = sampleData();

    await p.save(data);
    const loaded = await p.load();

    expect(loaded).toEqual(data);
  });

  it("returns empty defaults when file does not exist", async () => {
    const path = testPath("nonexistent.json");
    const p = new Persistence(path);

    const loaded = await p.load();

    expect(loaded.queue).toEqual([]);
    expect(loaded.archive).toEqual([]);
    expect(loaded.shortcuts.toggle).toBeString();
    expect(loaded.shortcuts.pasteNext).toBeString();
  });

  it("returns defaults when file contains corrupted JSON", async () => {
    const path = testPath("corrupt.json");
    await Bun.write(path, "not valid json {{{");

    const p = new Persistence(path);
    const loaded = await p.load();

    expect(loaded.queue).toEqual([]);
    expect(loaded.archive).toEqual([]);
  });

  it("preserves optional windowPosition field", async () => {
    const path = testPath("position.json");
    const p = new Persistence(path);
    const data = sampleData();

    await p.save(data);
    const loaded = await p.load();

    expect(loaded.windowPosition).toEqual(data.windowPosition);
  });

  it("handles data without windowPosition (backward compat)", async () => {
    const path = testPath("nopos.json");
    const partial: PersistedData = {
      queue: [{ id: "q1", blocks: [{ type: "text", content: "hi" }], createdAt: 1 }],
      archive: [],
      shortcuts: { toggle: "A", pasteNext: "B" },
    };

    const p = new Persistence(path);
    await p.save(partial);
    const loaded = await p.load();

    expect(loaded.windowPosition).toBeUndefined();
    expect(loaded.queue).toEqual(partial.queue);
  });
});
