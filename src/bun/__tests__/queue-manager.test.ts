import { describe, expect, it } from "bun:test";
import { QueueManager } from "../queue-manager";
import type { Block } from "../../shared/types";

function textBlock(content: string): Block {
  return { type: "text", content };
}

describe("QueueManager", () => {
  describe("addSnippet", () => {
    it("adds a text snippet to the queue", () => {
      const manager = new QueueManager();

      const snippet = manager.addSnippet([textBlock("hello")]);

      expect(snippet.id).toBeString();
      expect(snippet.blocks).toEqual([textBlock("hello")]);
      expect(snippet.createdAt).toBeNumber();

      const state = manager.getState();
      expect(state.queue).toHaveLength(1);
      expect(state.queue[0].id).toBe(snippet.id);
      expect(state.archive).toHaveLength(0);
    });

    it("adds a snippet with multiple blocks", () => {
      const manager = new QueueManager();

      const blocks: Block[] = [
        textBlock("instruction"),
        { type: "image", content: "base64data" },
        textBlock("follow-up"),
      ];

      manager.addSnippet(blocks);

      const state = manager.getState();
      expect(state.queue[0].blocks).toHaveLength(3);
      expect(state.queue[0].blocks[0]).toEqual(blocks[0]);
      expect(state.queue[0].blocks[1]).toEqual(blocks[1]);
      expect(state.queue[0].blocks[2]).toEqual(blocks[2]);
    });

    it("generates unique IDs for each snippet", () => {
      const manager = new QueueManager();

      const a = manager.addSnippet([textBlock("first")]);
      const b = manager.addSnippet([textBlock("second")]);

      expect(a.id).not.toBe(b.id);
    });
  });

  describe("removeSnippet", () => {
    it("removes snippet from queue and moves to archive", () => {
      const manager = new QueueManager();
      const snippet = manager.addSnippet([textBlock("remove me")]);

      const result = manager.removeSnippet(snippet.id);

      expect(result).toBe(true);
      expect(manager.getState().queue).toHaveLength(0);
      expect(manager.getState().archive).toHaveLength(1);
      expect(manager.getState().archive[0].id).toBe(snippet.id);
      expect(manager.getState().archive[0].consumedAt).toBeNumber();
    });

    it("returns false for non-existent ID", () => {
      const manager = new QueueManager();

      const result = manager.removeSnippet("nonexistent");

      expect(result).toBe(false);
    });

    it("does not affect archive items", () => {
      const manager = new QueueManager({
        queue: [],
        archive: [
          {
            id: "archived-1",
            blocks: [textBlock("old")],
            createdAt: Date.now(),
            consumedAt: Date.now(),
          },
        ],
      });

      const result = manager.removeSnippet("archived-1");

      expect(result).toBe(false);
      expect(manager.getState().archive).toHaveLength(1);
    });
  });

  describe("reorderSnippets", () => {
    it("reorders queue to match provided ID order", () => {
      const manager = new QueueManager();
      const a = manager.addSnippet([textBlock("first")]);
      const b = manager.addSnippet([textBlock("second")]);
      const c = manager.addSnippet([textBlock("third")]);

      manager.reorderSnippets([c.id, a.id, b.id]);

      const ids = manager.getState().queue.map((s) => s.id);
      expect(ids).toEqual([c.id, a.id, b.id]);
    });

    it("returns false when IDs do not match queue", () => {
      const manager = new QueueManager();
      manager.addSnippet([textBlock("first")]);
      manager.addSnippet([textBlock("second")]);

      const result = manager.reorderSnippets(["wrong-id"]);

      expect(result).toBe(false);
    });

    it("returns false when ID count does not match queue", () => {
      const manager = new QueueManager();
      const a = manager.addSnippet([textBlock("first")]);
      const b = manager.addSnippet([textBlock("second")]);

      const result = manager.reorderSnippets([a.id]);

      expect(result).toBe(false);
    });
  });

  describe("consumeSnippet", () => {
    it("moves snippet from queue to archive with consumedAt", () => {
      const manager = new QueueManager();
      const snippet = manager.addSnippet([textBlock("consume me")]);

      const result = manager.consumeSnippet(snippet.id);

      expect("snippet" in result).toBe(true);
      if ("snippet" in result) {
        expect(result.snippet.id).toBe(snippet.id);
        expect(result.snippet.consumedAt).toBeNumber();
      }
      expect(manager.getState().queue).toHaveLength(0);
      expect(manager.getState().archive).toHaveLength(1);
      expect(manager.getState().archive[0].id).toBe(snippet.id);
    });

    it("returns error for non-existent snippet", () => {
      const manager = new QueueManager();

      const result = manager.consumeSnippet("nope");

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("Snippet not found");
      }
    });
  });

  describe("consumeNext", () => {
    it("consumes the first snippet in queue", () => {
      const manager = new QueueManager();
      const first = manager.addSnippet([textBlock("first")]);
      const second = manager.addSnippet([textBlock("second")]);

      const result = manager.consumeNext();

      expect("snippet" in result).toBe(true);
      if ("snippet" in result) {
        expect(result.snippet.id).toBe(first.id);
      }
      expect(manager.getState().queue).toHaveLength(1);
      expect(manager.getState().queue[0].id).toBe(second.id);
      expect(manager.getState().archive).toHaveLength(1);
      expect(manager.getState().archive[0].id).toBe(first.id);
    });

    it("returns error when queue is empty", () => {
      const manager = new QueueManager();

      const result = manager.consumeNext();

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("Queue is empty");
      }
    });
  });

  describe("restoreSnippet", () => {
    it("moves snippet from archive back to queue and clears consumedAt", () => {
      const manager = new QueueManager();
      const snippet = manager.addSnippet([textBlock("will archive")]);
      manager.consumeSnippet(snippet.id);

      expect(manager.getState().archive).toHaveLength(1);

      const result = manager.restoreSnippet(snippet.id);

      expect(result).toBe(true);
      expect(manager.getState().queue).toHaveLength(1);
      expect(manager.getState().archive).toHaveLength(0);
      expect(manager.getState().queue[0].id).toBe(snippet.id);
      expect(manager.getState().queue[0].consumedAt).toBeUndefined();
    });

    it("returns false for non-existent snippet", () => {
      const manager = new QueueManager();

      const result = manager.restoreSnippet("nowhere");

      expect(result).toBe(false);
    });

    it("returns false when snippet is already in queue", () => {
      const manager = new QueueManager();
      const snippet = manager.addSnippet([textBlock("in queue")]);

      const result = manager.restoreSnippet(snippet.id);

      expect(result).toBe(false);
    });
  });

  describe("deleteFromArchive", () => {
    it("permanently removes snippet from archive", () => {
      const manager = new QueueManager();
      const snippet = manager.addSnippet([textBlock("to delete")]);
      manager.consumeSnippet(snippet.id);

      expect(manager.getState().archive).toHaveLength(1);

      const result = manager.deleteFromArchive(snippet.id);

      expect(result).toBe(true);
      expect(manager.getState().archive).toHaveLength(0);
      expect(manager.getState().queue).toHaveLength(0);
    });

    it("returns false for non-existent ID", () => {
      const manager = new QueueManager();

      const result = manager.deleteFromArchive("nowhere");

      expect(result).toBe(false);
    });

    it("does not affect queue items", () => {
      const manager = new QueueManager();
      const queueItem = manager.addSnippet([textBlock("in queue")]);
      const archiveItem = manager.addSnippet([textBlock("will archive")]);
      manager.consumeSnippet(archiveItem.id);

      const result = manager.deleteFromArchive(archiveItem.id);

      expect(result).toBe(true);
      expect(manager.getState().archive).toHaveLength(0);
      expect(manager.getState().queue).toHaveLength(1);
      expect(manager.getState().queue[0].id).toBe(queueItem.id);
    });
  });
});
