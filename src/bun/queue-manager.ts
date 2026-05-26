import type { Snippet, Block } from "../shared/types";

export class QueueManager {
  private queue: Snippet[] = [];
  private archive: Snippet[] = [];

  constructor(initial?: { queue: Snippet[]; archive: Snippet[] }) {
    if (initial) {
      this.queue = initial.queue;
      this.archive = initial.archive;
    }
  }

  restoreSnippet(id: string): boolean {
    const index = this.archive.findIndex((s) => s.id === id);
    if (index === -1) return false;

    const [snippet] = this.archive.splice(index, 1);
    snippet.consumedAt = undefined;
    this.queue.push(snippet);
    return true;
  }

  consumeSnippet(id: string): { snippet: Snippet } | { error: string } {
    const index = this.queue.findIndex((s) => s.id === id);
    if (index === -1) return { error: "Snippet not found" };

    const [snippet] = this.queue.splice(index, 1);
    snippet.consumedAt = Date.now();
    this.archive.push(snippet);
    return { snippet };
  }

  consumeNext(): { snippet: Snippet } | { error: string } {
    if (this.queue.length === 0) return { error: "Queue is empty" };
    return this.consumeSnippet(this.queue[0].id);
  }

  reorderSnippets(ids: string[]): boolean {
    if (ids.length !== this.queue.length) return false;
    const idSet = new Set(ids);
    const queueSet = new Set(this.queue.map((s) => s.id));
    if (idSet.size !== queueSet.size) return false;
    for (const id of ids) {
      if (!queueSet.has(id)) return false;
    }

    const map = new Map(this.queue.map((s) => [s.id, s]));
    this.queue = ids.map((id) => map.get(id)!);
    return true;
  }

  removeSnippet(id: string): boolean {
    const index = this.queue.findIndex((s) => s.id === id);
    if (index === -1) return false;
    const [snippet] = this.queue.splice(index, 1);
    snippet.consumedAt = Date.now();
    this.archive.push(snippet);
    return true;
  }

  deleteFromArchive(id: string): boolean {
    const index = this.archive.findIndex((s) => s.id === id);
    if (index === -1) return false;
    this.archive.splice(index, 1);
    return true;
  }

  getSnippetFromArchive(id: string): Snippet | null {
    return this.archive.find((s) => s.id === id) ?? null;
  }

  addSnippet(blocks: Block[]): Snippet {
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      blocks,
      createdAt: Date.now(),
    };
    this.queue.push(snippet);
    return snippet;
  }

  getState(): { queue: Snippet[]; archive: Snippet[] } {
    return {
      queue: this.queue,
      archive: this.archive,
    };
  }
}
