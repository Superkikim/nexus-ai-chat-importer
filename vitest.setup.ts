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

// Obsidian injects moment on `window`, and src/utils.ts captures it at module
// load. Tests get a deterministic UTC stub rather than the real library: the
// locale-aware tokens ("L", "LTS") would otherwise render differently from one
// machine to the next and make timestamp assertions flaky.
if (!(globalThis as any).window.moment) {
    const pad = (value: number, width = 2) =>
        String(value).padStart(width, "0");

    (globalThis as any).window.moment = (input: number | string) => {
        const date = new Date(input);
        const hours24 = date.getUTCHours();
        const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
        const tokens: Record<string, string> = {
            YYYY: String(date.getUTCFullYear()),
            MM: pad(date.getUTCMonth() + 1),
            DD: pad(date.getUTCDate()),
            HH: pad(hours24),
            mm: pad(date.getUTCMinutes()),
            ss: pad(date.getUTCSeconds()),
            h: String(hours12),
            A: hours24 < 12 ? "AM" : "PM",
        };
        tokens.L = `${tokens.MM}/${tokens.DD}/${tokens.YYYY}`;
        tokens.LTS = `${tokens.h}:${tokens.mm}:${tokens.ss} ${tokens.A}`;
        tokens.YYYYMMDD = `${tokens.YYYY}${tokens.MM}${tokens.DD}`;

        return {
            format: (pattern: string) =>
                pattern.replace(
                    /YYYYMMDD|YYYY|LTS|MM|DD|HH|mm|ss|L|h|A/g,
                    (token) => tokens[token] ?? token
                ),
        };
    };
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
