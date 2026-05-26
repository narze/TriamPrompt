import type { Block } from "../shared/types";

export interface PasteDeps {
  writeText: (text: string) => void;
  writeImage: (data: Uint8Array) => void;
  sendPasteKeystroke: () => Promise<boolean>;
}

const BLOCK_DELAY_MS = 200;

export class PasteOrchestrator {
  private writeText: (text: string) => void;
  private writeImage: (data: Uint8Array) => void;
  private sendPasteKeystroke: () => Promise<boolean>;

  constructor(deps: PasteDeps) {
    this.writeText = deps.writeText;
    this.writeImage = deps.writeImage;
    this.sendPasteKeystroke = deps.sendPasteKeystroke;
  }

  async execute(blocks: Block[]): Promise<boolean> {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      if (block.type === "text") {
        this.writeText(block.content);
      } else {
        const data = new Uint8Array(Buffer.from(block.content, "base64"));
        this.writeImage(data);
      }

      const ok = await this.sendPasteKeystroke();
      if (!ok) return false;

      if (i < blocks.length - 1) {
        await new Promise((r) => setTimeout(r, BLOCK_DELAY_MS));
      }
    }

    return true;
  }
}
