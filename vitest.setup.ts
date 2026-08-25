// Vitest global setup for Node environment.
// Some modules (like src/utils.ts) expect a browser-like `window` global.
// Provide a minimal stub so they can be imported in tests without errors.

if (!(globalThis as any).window) {
    (globalThis as any).window = {};
}

if (!(globalThis as any).window.setTimeout) {
    (globalThis as any).window.setTimeout =
        globalThis.setTimeout.bind(globalThis);
}

// The ZIP reader pulls byte ranges through `FileReader`, which Node does not
// provide. Backing it with `Blob.arrayBuffer()` lets tests drive the real
// reader against real archives instead of a stand-in.
if (!(globalThis as any).FileReader) {
    (globalThis as any).FileReader = class {
        result: ArrayBuffer | null = null;
        error: unknown = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        readAsArrayBuffer(blob: Blob): void {
            blob.arrayBuffer().then(
                (buffer) => {
                    this.result = buffer;
                    this.onload?.();
                },
                (error) => {
                    this.error = error;
                    this.onerror?.();
                }
            );
        }
    };
}
