import type { RPCSchema } from "electrobun/bun";

export interface TextBlock {
  type: "text";
  content: string;
}

export interface ImageBlock {
  type: "image";
  content: string;
  filename?: string;
}

export type Block = TextBlock | ImageBlock;

export interface Snippet {
  id: string;
  blocks: Block[];
  createdAt: number;
  consumedAt?: number;
}

export interface PersistedData {
  queue: Snippet[];
  archive: Snippet[];
  shortcuts: {
    toggle: string;
    pasteNext: string;
  };
  refocusAfterPaste?: boolean;
  windowPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type TriamPromptRPC = {
  bun: RPCSchema<{
    requests: {
      addSnippet: {
        params: { blocks: Block[] };
        response: { success: boolean; snippet: Snippet };
      };
      removeSnippet: {
        params: { id: string };
        response: { success: boolean };
      };
      reorderSnippets: {
        params: { ids: string[] };
        response: { success: boolean };
      };
      restoreSnippet: {
        params: { id: string };
        response: { success: boolean };
      };
      pasteSnippet: {
        params: { id: string };
        response: { success: boolean; error?: string };
      };
      pasteFromArchive: {
        params: { id: string };
        response: { success: boolean; error?: string };
      };
      pasteNextInQueue: {
        params: {};
        response: { success: boolean; error?: string; snippet?: Snippet };
      };
      deleteSnippetFromArchive: {
        params: { id: string };
        response: { success: boolean };
      };
      getSettings: {
        params: {};
        response: { toggle: string; pasteNext: string; refocusAfterPaste: boolean };
      };
      updateSettings: {
        params: { toggle?: string; pasteNext?: string; refocusAfterPaste?: boolean };
        response: { success: boolean; error?: string };
      };
      getState: {
        params: {};
        response: { queue: Snippet[]; archive: Snippet[] };
      };
    };
    messages: {
      stateChanged: {
        queue: Snippet[];
        archive: Snippet[];
      };
      shortcutsUpdated: {
        toggle: string;
        pasteNext: string;
        refocusAfterPaste: boolean;
      };
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};
