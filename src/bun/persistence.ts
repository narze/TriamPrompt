import type { PersistedData } from "../shared/types";

const DEFAULTS: PersistedData = {
  queue: [],
  archive: [],
  shortcuts: {
    toggle: "CommandOrControl+Shift+Space",
    pasteNext: "CommandOrControl+Shift+V",
  },
};

export class Persistence {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async save(data: PersistedData): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await Bun.write(this.filePath, json);
  }

  async load(): Promise<PersistedData> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) {
      return { ...DEFAULTS, queue: [], archive: [], shortcuts: { ...DEFAULTS.shortcuts } };
    }

    try {
      const json = await file.text();
      const parsed = JSON.parse(json) as PersistedData;

      return {
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
        archive: Array.isArray(parsed.archive) ? parsed.archive : [],
        shortcuts: {
          toggle: parsed.shortcuts?.toggle || DEFAULTS.shortcuts.toggle,
          pasteNext: parsed.shortcuts?.pasteNext || DEFAULTS.shortcuts.pasteNext,
        },
        windowPosition: parsed.windowPosition,
      };
    } catch {
      return { ...DEFAULTS, queue: [], archive: [], shortcuts: { ...DEFAULTS.shortcuts } };
    }
  }
}
