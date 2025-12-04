// Vitest global setup for Node environment.
// Some modules (like src/utils.ts) expect a browser-like `window` global.
// Provide a minimal stub so they can be imported in tests without errors.

if (!(globalThis as any).window) {
    (globalThis as any).window = {};
}

