/**
 * Obsidian API shim for Node.js CLI
 *
 * Provides mock implementations of Obsidian classes/functions that the
 * plugin's services import. Backed by Node.js `fs` and `js-yaml`.
 */

import * as fs from "fs";
import * as pathMod from "path";
import * as yaml from "js-yaml";
import momentLib from "moment";
import * as crypto from "crypto";

// Re-export moment so `import { moment } from "obsidian"` works
export const moment = momentLib;

// ---------------------------------------------------------------------------
// TFile / TFolder
// ---------------------------------------------------------------------------

export class TFolder {
  path: string;
  name: string;
  parent: TFolder | null;
  children: (TFile | TFolder)[] = [];

  constructor(path: string) {
    this.path = path;
    this.name = pathMod.basename(path);
    this.parent = null;
  }
}

export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  stat: { ctime: number; mtime: number; size: number };
  parent: TFolder | null = null;

  constructor(path: string, private vaultRoot: string) {
    this.path = path;
    this.name = pathMod.basename(path);
    const ext = pathMod.extname(path);
    this.extension = ext.replace(".", "");
    this.basename = pathMod.basename(path, ext);

    const abs = pathMod.join(vaultRoot, path);
    try {
      const s = fs.statSync(abs);
      this.stat = { ctime: s.ctimeMs, mtime: s.mtimeMs, size: s.size };
    } catch {
      this.stat = { ctime: 0, mtime: 0, size: 0 };
    }
  }
}

// ---------------------------------------------------------------------------
// Vault adapter (low-level filesystem operations)
// ---------------------------------------------------------------------------

class VaultAdapter {
  constructor(private root: string) {}

  async exists(path: string): Promise<boolean> {
    return fs.existsSync(pathMod.join(this.root, path));
  }

  async read(path: string): Promise<string> {
    return fs.readFileSync(pathMod.join(this.root, path), "utf-8");
  }

  async write(path: string, data: string): Promise<void> {
    const abs = pathMod.join(this.root, path);
    fs.mkdirSync(pathMod.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, data, "utf-8");
  }

  async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    const abs = pathMod.join(this.root, path);
    fs.mkdirSync(pathMod.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.from(data));
  }

  async list(
    path: string
  ): Promise<{ files: string[]; folders: string[] }> {
    const abs = pathMod.join(this.root, path);
    if (!fs.existsSync(abs)) return { files: [], folders: [] };
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    const files: string[] = [];
    const folders: string[] = [];
    for (const e of entries) {
      const entryPath = path ? `${path}/${e.name}` : e.name;
      if (e.isDirectory()) folders.push(entryPath);
      else files.push(entryPath);
    }
    return { files, folders };
  }

  async rmdir(path: string, recursive?: boolean): Promise<void> {
    const abs = pathMod.join(this.root, path);
    if (fs.existsSync(abs)) {
      fs.rmSync(abs, { recursive: !!recursive, force: true });
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const absOld = pathMod.join(this.root, oldPath);
    const absNew = pathMod.join(this.root, newPath);
    fs.mkdirSync(pathMod.dirname(absNew), { recursive: true });
    fs.renameSync(absOld, absNew);
  }
}

// ---------------------------------------------------------------------------
// Vault
// ---------------------------------------------------------------------------

export class Vault {
  adapter: VaultAdapter;
  private root: string;

  constructor(root: string) {
    this.root = root;
    this.adapter = new VaultAdapter(root);
  }

  async create(path: string, content: string): Promise<TFile> {
    const abs = pathMod.join(this.root, path);
    fs.mkdirSync(pathMod.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
    return new TFile(path, this.root);
  }

  async createBinary(path: string, data: ArrayBuffer): Promise<TFile> {
    const abs = pathMod.join(this.root, path);
    fs.mkdirSync(pathMod.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.from(data));
    return new TFile(path, this.root);
  }

  async modify(file: TFile, content: string): Promise<void> {
    const abs = pathMod.join(this.root, file.path);
    fs.writeFileSync(abs, content, "utf-8");
  }

  async read(file: TFile): Promise<string> {
    const abs = pathMod.join(this.root, file.path);
    return fs.readFileSync(abs, "utf-8");
  }

  async readBinary(file: TFile): Promise<ArrayBuffer> {
    const abs = pathMod.join(this.root, file.path);
    const buf = fs.readFileSync(abs);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  async createFolder(path: string): Promise<void> {
    const abs = pathMod.join(this.root, path);
    if (fs.existsSync(abs)) {
      throw new Error("Folder already exists.");
    }
    fs.mkdirSync(abs, { recursive: true });
  }

  async rename(file: TFile | TFolder, newPath: string): Promise<void> {
    const absOld = pathMod.join(this.root, file.path);
    const absNew = pathMod.join(this.root, newPath);
    fs.mkdirSync(pathMod.dirname(absNew), { recursive: true });
    fs.renameSync(absOld, absNew);
  }

  getAbstractFileByPath(path: string): TFile | TFolder | null {
    const abs = pathMod.join(this.root, path);
    if (!fs.existsSync(abs)) return null;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) return new TFolder(path);
    return new TFile(path, this.root);
  }

  getMarkdownFiles(): TFile[] {
    const results: TFile[] = [];
    const walk = (dir: string, rel: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(pathMod.join(dir, entry.name), entryRel);
        } else if (entry.name.endsWith(".md")) {
          results.push(new TFile(entryRel, this.root));
        }
      }
    };
    walk(this.root, "");
    return results;
  }
}

// ---------------------------------------------------------------------------
// MetadataCache (parses YAML frontmatter from files)
// ---------------------------------------------------------------------------

class MetadataCache {
  private root: string;

  constructor(root: string) {
    this.root = root;
  }

  getFileCache(file: TFile): { frontmatter?: Record<string, any> } | null {
    try {
      const abs = pathMod.join(this.root, file.path);
      const content = fs.readFileSync(abs, "utf-8");
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return { frontmatter: undefined };
      const frontmatter = yaml.load(match[1]) as Record<string, any>;
      return { frontmatter };
    } catch {
      return null;
    }
  }

  /** Stub for StorageService.waitForCacheClean — always "clean" in CLI */
  isCacheClean(): boolean {
    return true;
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export class App {
  vault: Vault;
  metadataCache: MetadataCache;

  constructor(vaultRoot: string) {
    this.vault = new Vault(vaultRoot);
    this.metadataCache = new MetadataCache(vaultRoot);
  }
}

// ---------------------------------------------------------------------------
// Notice → stderr
// ---------------------------------------------------------------------------

export class Notice {
  constructor(message: string, _duration?: number) {
    process.stderr.write(`[notice] ${message}\n`);
  }
}

// ---------------------------------------------------------------------------
// Modal (no-op in CLI)
// ---------------------------------------------------------------------------

/**
 * Create a recursive no-op DOM element stub.
 * Any property access returns a similar stub, so chained DOM calls work.
 */
function createDomStub(): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === "style") return new Proxy({}, { set: () => true, get: () => "" });
      if (prop === "cssText") return "";
      if (typeof prop === "symbol") return undefined;
      // Return existing own properties
      if (prop in _target) return _target[prop];
      // Methods that should return a new stub
      if (["createEl", "createDiv", "createSpan", "appendChild"].includes(prop as string)) {
        return (..._args: any[]) => createDomStub();
      }
      // Methods that are no-ops
      if (["empty", "addClass", "removeClass", "addEventListener", "removeEventListener", "setAttribute"].includes(prop as string)) {
        return (..._args: any[]) => {};
      }
      // String properties
      if (["textContent", "innerHTML", "innerText", "value", "className", "id"].includes(prop as string)) {
        return "";
      }
      return undefined;
    },
    set(_target, prop, value) {
      _target[prop] = value;
      return true;
    },
  };
  return new Proxy({}, handler);
}

export class Modal {
  app: App;
  contentEl: any;

  constructor(app: App) {
    this.app = app;
    this.contentEl = createDomStub();
  }
  open() { this.onOpen(); }
  close() { this.onClose(); }
  onOpen() {}
  onClose() {}
}

// ---------------------------------------------------------------------------
// Plugin base class
// ---------------------------------------------------------------------------

export class Plugin {
  app: App;
  manifest: { id: string; version: string; name: string; [k: string]: any };
  private dataPath: string;

  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
    const pluginDir = pathMod.join(
      (app.vault as any).root || (app.vault as any).adapter?.root || ".",
      ".obsidian",
      "plugins",
      manifest.id
    );
    this.dataPath = pathMod.join(pluginDir, "data.json");
  }

  async loadData(): Promise<any> {
    try {
      if (fs.existsSync(this.dataPath)) {
        return JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
      }
    } catch {}
    return null;
  }

  async saveData(data: any): Promise<void> {
    const dir = pathMod.dirname(this.dataPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), "utf-8");
  }

  addSettingTab(_tab: any) {}
  addRibbonIcon(_icon: string, _title: string, _cb: () => void) {
    return { addClass: () => {} };
  }
  addCommand(_cmd: any) {}
  registerEvent(_evt: any) {}
}

// ---------------------------------------------------------------------------
// Setting / PluginSettingTab / MarkdownRenderer (no-ops for CLI)
// ---------------------------------------------------------------------------

export class Setting {
  constructor(_el: any) {}
  setName(_n: string) { return this; }
  setDesc(_d: string) { return this; }
  addText(_cb: any) { return this; }
  addToggle(_cb: any) { return this; }
  addDropdown(_cb: any) { return this; }
  addButton(_cb: any) { return this; }
}

export class PluginSettingTab {
  app: App;
  constructor(app: App, _plugin: any) {
    this.app = app;
  }
  display() {}
  hide() {}
}

export class MarkdownRenderer {
  static renderMarkdown(_md: string, _el: any, _path: string, _component: any) {}
}

// ---------------------------------------------------------------------------
// requestUrl shim (minimal — not used in import path)
// ---------------------------------------------------------------------------

export async function requestUrl(opts: { url: string; method?: string }): Promise<{ status: number }> {
  // The plugin uses requestUrl for checking conversation links — not needed for import
  return { status: 200 };
}

// ---------------------------------------------------------------------------
// crypto shim for getFileHash
// ---------------------------------------------------------------------------

// The plugin's getFileHash uses browser `crypto.subtle.digest`.
// We polyfill the global `crypto.subtle` so the original code works.
if (typeof globalThis.crypto === "undefined") {
  (globalThis as any).crypto = {};
}
if (typeof globalThis.crypto.subtle === "undefined") {
  (globalThis as any).crypto.subtle = {
    async digest(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> {
      const alg = algorithm.replace("-", "").toLowerCase(); // SHA-256 → sha256
      const hash = crypto.createHash(alg);
      hash.update(Buffer.from(data));
      return hash.digest().buffer;
    },
  };
}

// ---------------------------------------------------------------------------
// Polyfill window for code that uses window.setTimeout
// ---------------------------------------------------------------------------
if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = globalThis;
}

// ---------------------------------------------------------------------------
// Additional exports the plugin might reference
// ---------------------------------------------------------------------------

export type PluginManifest = {
  id: string;
  version: string;
  name: string;
  [k: string]: any;
};

// ISuggestOwner, Scope, TextComponent — used by settings UI only
export class Scope {}
export interface ISuggestOwner<T> {}
export class TextComponent {
  inputEl: any = { value: "" };
  setValue(_v: string) { return this; }
  getValue() { return ""; }
}
