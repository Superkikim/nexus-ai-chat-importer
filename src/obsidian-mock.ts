/**
 * Minimal Obsidian API stubs for running Vitest in Node.
 *
 * These are NOT full implementations, only the pieces needed by unit tests.
 */

export class App {}

export class TAbstractFile {
    path = "";
    name = "";
}

export class TFile extends TAbstractFile {}

export class TFolder extends TAbstractFile {}

export class Vault {
    getAbstractFileByPath(_path: string): TAbstractFile | null {
        return null;
    }

    async create(_path: string, _data: string): Promise<TFile> {
        return new TFile();
    }

    async modify(_file: TFile, _data: string): Promise<void> {
        // no-op
    }
}

export class Plugin {
    app: App;
    constructor(app: App) {
        this.app = app;
    }
}

export class Modal {
    open(): void {}
    close(): void {}
}

export class Notice {
    constructor(_message: string, _timeout?: number) {}
}

export interface RequestUrlParam {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string | ArrayBuffer;
}

export interface RequestUrlResponse {
    status: number;
    json: () => Promise<any>;
    text: () => Promise<string>;
}

export async function requestUrl(_request: string | RequestUrlParam): Promise<RequestUrlResponse> {
    return {
        status: 200,
        json: async () => ({}),
        text: async () => "",
    };
}

