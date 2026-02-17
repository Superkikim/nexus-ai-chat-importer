/**
 * Orchestrates the import using plugin services with the Obsidian shim.
 * Supports ChatGPT, Claude, and Le Chat providers.
 */

import * as fs from "fs";
import * as path from "path";
import { App, Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "../../src/config/constants";
import { PluginSettings } from "../../src/types/plugin";
import { ImportService } from "../../src/services/import-service";
import { StorageService } from "../../src/services/storage-service";
import { FileService } from "../../src/services/file-service";
import { ImportReport } from "../../src/models/import-report";
import { Logger } from "../../src/logger";

export interface ImportOptions {
  vault: string;
  input: string[];
  provider?: string;
  conversationFolder?: string;
  attachmentFolder?: string;
  reportFolder?: string;
  datePrefix?: boolean;
  dateFormat?: "YYYY-MM-DD" | "YYYYMMDD";
  timestampFormat?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Shim for browser `File` API.
 *
 * JSZip 3.x in Node.js doesn't understand browser Blob/File, but it does
 * accept Buffer. We store the raw buffer and monkey-patch JSZip.loadAsync
 * to convert NodeFile → Buffer before loading.
 */
class NodeFile {
  name: string;
  lastModified: number;
  size: number;
  type = "application/zip";
  /** @internal raw file contents */
  _buffer: Buffer;

  constructor(filePath: string) {
    this._buffer = fs.readFileSync(filePath);
    this.name = path.basename(filePath);
    this.size = this._buffer.length;

    try {
      this.lastModified = fs.statSync(filePath).mtimeMs;
    } catch {
      this.lastModified = Date.now();
    }
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this._buffer.buffer.slice(
      this._buffer.byteOffset,
      this._buffer.byteOffset + this._buffer.byteLength
    );
  }
}

// Monkey-patch JSZip so loadAsync converts NodeFile → Buffer transparently
import JSZip from "jszip";
const origLoadAsync = JSZip.prototype.loadAsync;
JSZip.prototype.loadAsync = function (data: any, options?: any) {
  if (data && data._buffer instanceof Buffer) {
    return origLoadAsync.call(this, data._buffer, options);
  }
  return origLoadAsync.call(this, data, options);
};

/**
 * Read saved plugin settings from the vault's data.json.
 * Returns the settings object or {} if not found.
 */
function readPluginConfig(vaultPath: string): Partial<PluginSettings> {
  const dataPath = path.join(
    vaultPath,
    ".obsidian",
    "plugins",
    "nexus-ai-chat-importer",
    "data.json"
  );
  try {
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
      return data?.settings || {};
    }
  } catch {}
  return {};
}

/**
 * Build a mock plugin instance that the services expect.
 *
 * Settings are layered: DEFAULT_SETTINGS → saved plugin config → CLI flags.
 * CLI flags only override when explicitly provided (not undefined).
 */
function createMockPlugin(opts: ImportOptions): any {
  const app = new App(opts.vault);

  const manifest = {
    id: "nexus-ai-chat-importer",
    name: "Nexus AI Chat Importer",
    version: "1.3.3",
  };

  // Layer 1: hardcoded defaults
  // Layer 2: saved plugin config from the vault
  const savedConfig = readPluginConfig(opts.vault);
  const settings: PluginSettings = {
    ...DEFAULT_SETTINGS,
    ...savedConfig,
  };

  // Layer 3: explicit CLI flag overrides (only when provided)
  if (opts.conversationFolder !== undefined) settings.conversationFolder = opts.conversationFolder;
  if (opts.attachmentFolder !== undefined) settings.attachmentFolder = opts.attachmentFolder;
  if (opts.reportFolder !== undefined) settings.reportFolder = opts.reportFolder;
  if (opts.datePrefix !== undefined) settings.addDatePrefix = opts.datePrefix;
  if (opts.dateFormat !== undefined) settings.dateFormat = opts.dateFormat;
  if (opts.timestampFormat !== undefined) {
    if (opts.timestampFormat === "locale") {
      settings.useCustomMessageTimestampFormat = false;
      settings.messageTimestampFormat = "locale";
    } else {
      settings.useCustomMessageTimestampFormat = true;
      settings.messageTimestampFormat = opts.timestampFormat as any;
    }
  }

  // Create a Plugin-like object
  const plugin = new Plugin(app, manifest) as any;
  plugin.settings = settings;
  plugin.logger = new Logger();

  // Wire up StorageService
  const storageService = new StorageService(plugin);
  plugin.getStorageService = () => storageService;

  // Wire up FileService
  const fileService = new FileService(plugin);
  plugin.getFileService = () => fileService;

  // Wire up saveSettings
  plugin.saveSettings = async () => {
    try {
      const existingData = (await plugin.loadData()) || {};
      const mergedData = {
        ...existingData,
        settings: plugin.settings,
        importedArchives: storageService.getImportedArchives(),
        upgradeHistory: existingData.upgradeHistory || {
          completedUpgrades: {},
          completedOperations: {},
        },
      };
      await plugin.saveData(mergedData);
    } catch (error: any) {
      plugin.logger.error("saveSettings failed:", error);
    }
  };

  // Load storage data synchronously for simplicity
  plugin._initStorage = async () => {
    try {
      await storageService.loadData();
    } catch {
      // Fresh vault — no data yet
    }
  };

  return plugin;
}

export async function runImport(opts: ImportOptions): Promise<void> {
  // Validate vault path
  if (!fs.existsSync(opts.vault)) {
    throw new Error(`Vault path does not exist: ${opts.vault}`);
  }
  const obsidianDir = path.join(opts.vault, ".obsidian");
  if (!fs.existsSync(obsidianDir)) {
    throw new Error(
      `Not an Obsidian vault (missing .obsidian/): ${opts.vault}`
    );
  }

  // Validate input files
  for (const input of opts.input) {
    if (!fs.existsSync(input)) {
      throw new Error(`Input file does not exist: ${input}`);
    }
  }

  const provider = opts.provider!;

  if (opts.verbose) {
    // Show effective config sources
    const savedConfig = readPluginConfig(opts.vault);
    const hasPluginConfig = Object.keys(savedConfig).length > 0;
    console.error(`Vault:    ${opts.vault}`);
    console.error(`Config:   ${hasPluginConfig ? "loaded from plugin data.json" : "using defaults (no plugin config found)"}`);
    console.error(`Provider: ${provider}`);
    console.error(`Files:    ${opts.input.join(", ")}`);
  }

  if (opts.dryRun) {
    console.log("[dry-run] Would import the following files:");
    for (const input of opts.input) {
      console.log(`  - ${input}`);
    }
    console.log(`[dry-run] Provider: ${provider}`);
    console.log(`[dry-run] Vault: ${opts.vault}`);
    console.log("[dry-run] No files were written.");
    return;
  }

  // Create mock plugin
  const plugin = createMockPlugin({ ...opts, provider });
  await plugin._initStorage();

  // Create ImportService
  const importService = new ImportService(plugin);

  // Create shared report
  const report = new ImportReport();
  if (
    plugin.settings.useCustomMessageTimestampFormat &&
    plugin.settings.messageTimestampFormat
  ) {
    report.setCustomTimestampFormat(plugin.settings.messageTimestampFormat);
  }

  // Create File shims
  const files = opts.input.map((p) => new NodeFile(path.resolve(p)));

  // Process each file
  for (const file of files) {
    if (opts.verbose) {
      console.error(`\nProcessing: ${file.name}`);
    }
    try {
      await importService.handleZipFile(
        file as any, // NodeFile satisfies the shape JSZip/ImportService need
        provider,
        undefined, // all conversations
        report
      );
    } catch (error: any) {
      console.error(`Error processing ${file.name}: ${error.message}`);
    }
  }

  // Print summary
  const stats = report.getCompletionStats();
  console.log("\n--- Import Summary ---");
  console.log(`Created:  ${stats.created}`);
  console.log(`Updated:  ${stats.updated}`);
  console.log(`Skipped:  ${stats.skipped}`);
  console.log(`Failed:   ${stats.failed}`);
  if (stats.attachmentsTotal > 0) {
    console.log(
      `Attachments: ${stats.attachmentsFound}/${stats.attachmentsTotal}`
    );
  }
}
