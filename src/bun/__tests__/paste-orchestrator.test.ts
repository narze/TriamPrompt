import { describe, expect, it, spyOn } from "bun:test";
import { PasteOrchestrator } from "../paste-orchestrator";
import type { Block } from "../../shared/types";

function makeSpies() {
  const writeTextCalls: string[] = [];
  const writeImageCalls: Uint8Array[] = [];
  const keystrokeResults: boolean[] = [];

  const writeText = (text: string) => {
    writeTextCalls.push(text);
  };

  const writeImage = (data: Uint8Array) => {
    writeImageCalls.push(data);
  };

  const sendPasteKeystroke = async (): Promise<boolean> => {
    const result = keystrokeResults.shift() ?? true;
    return result;
  };

  return {
    writeText,
    writeImage,
    sendPasteKeystroke,
    writeTextCalls,
    writeImageCalls,
    setKeystrokeResults: (results: boolean[]) => {
      keystrokeResults.length = 0;
      keystrokeResults.push(...results);
    },
  };
}

describe("PasteOrchestrator", () => {
  it("pastes a single text block", async () => {
    const spies = makeSpies();
    const p = new PasteOrchestrator({
      writeText: spies.writeText,
      writeImage: spies.writeImage,
      sendPasteKeystroke: spies.sendPasteKeystroke,
    });

    const result = await p.execute([{ type: "text", content: "hello world" }]);

    expect(result).toBe(true);
    expect(spies.writeTextCalls).toEqual(["hello world"]);
    expect(spies.writeImageCalls).toHaveLength(0);
  });

  it("pastes a single image block", async () => {
    const spies = makeSpies();
    const p = new PasteOrchestrator({
      writeText: spies.writeText,
      writeImage: spies.writeImage,
      sendPasteKeystroke: spies.sendPasteKeystroke,
    });

    const result = await p.execute([{ type: "image", content: "base64data" }]);

    expect(result).toBe(true);
    expect(spies.writeImageCalls).toHaveLength(1);
    expect(spies.writeTextCalls).toHaveLength(0);
  });

  it("pastes mixed blocks in order (text → image → text)", async () => {
    const spies = makeSpies();
    const p = new PasteOrchestrator({
      writeText: spies.writeText,
      writeImage: spies.writeImage,
      sendPasteKeystroke: spies.sendPasteKeystroke,
    });

    const blocks: Block[] = [
      { type: "text", content: "first" },
      { type: "image", content: "img1" },
      { type: "text", content: "last" },
    ];

    const result = await p.execute(blocks);

    expect(result).toBe(true);
    expect(spies.writeTextCalls).toEqual(["first", "last"]);
    expect(spies.writeImageCalls).toHaveLength(1);
  });

  it("returns false and stops if keystroke fails", async () => {
    const spies = makeSpies();
    spies.setKeystrokeResults([false]);

    const p = new PasteOrchestrator({
      writeText: spies.writeText,
      writeImage: spies.writeImage,
      sendPasteKeystroke: spies.sendPasteKeystroke,
    });

    const blocks: Block[] = [
      { type: "text", content: "first" },
      { type: "text", content: "should never reach" },
    ];

    const result = await p.execute(blocks);

    expect(result).toBe(false);
    expect(spies.writeTextCalls).toEqual(["first"]);
  });
});
