/**
 * Nexus AI Chat Importer CLI
 *
 * Non-interactive CLI that imports ChatGPT/Claude/Le Chat ZIP exports
 * into an Obsidian vault using the plugin's services.
 */

import { runImport, ImportOptions } from "./run-import";

const CLI_VERSION = "1.0.0";
const VALID_PROVIDERS = ["chatgpt", "claude", "lechat"] as const;
const VALID_DATE_FORMATS = ["YYYY-MM-DD", "YYYYMMDD"] as const;
const VALID_TIMESTAMP_FORMATS = ["locale", "iso", "us", "eu", "de", "jp"] as const;

function printGlobalHelp(): void {
  console.log(`nexus-cli ${CLI_VERSION}

Usage:
  nexus-cli import --vault <path> --input <files...> --provider <provider> [options]

Commands:
  import    Import one or more ZIP exports into a vault

Options:
  --vault <path>               Path to the Obsidian vault (required)
  --input <files...>           One or more ZIP export files (required)
  --provider <provider>        Provider: chatgpt, claude, or lechat (required)
  --conversation-folder <dir>  Override conversation folder
  --attachment-folder <dir>    Override attachment folder
  --report-folder <dir>        Override report folder
  --date-prefix                Add date prefix to filenames
  --date-format <format>       YYYY-MM-DD or YYYYMMDD
  --timestamp-format <format>  locale, iso, us, eu, de, jp
  --dry-run                    Preview import without writing files
  --verbose                    Enable verbose output
  -h, --help                   Show help
  -v, --version                Show CLI version`);
}

function isFlag(token: string | undefined): boolean {
  return !!token && token.startsWith("--");
}

function requireValue(args: string[], index: number, optionName: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}`);
  }
  return value;
}

function parseImportArgs(args: string[]): ImportOptions {
  const options: ImportOptions = {
    vault: "",
    input: [],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case "--vault": {
        options.vault = requireValue(args, i, "--vault");
        i += 2;
        break;
      }
      case "--input": {
        const values: string[] = [];
        let cursor = i + 1;
        while (cursor < args.length && !isFlag(args[cursor])) {
          values.push(args[cursor]);
          cursor++;
        }
        if (values.length === 0) {
          throw new Error("Missing value for --input");
        }
        options.input = values;
        i = cursor;
        break;
      }
      case "--provider": {
        options.provider = requireValue(args, i, "--provider");
        i += 2;
        break;
      }
      case "--conversation-folder": {
        options.conversationFolder = requireValue(args, i, "--conversation-folder");
        i += 2;
        break;
      }
      case "--attachment-folder": {
        options.attachmentFolder = requireValue(args, i, "--attachment-folder");
        i += 2;
        break;
      }
      case "--report-folder": {
        options.reportFolder = requireValue(args, i, "--report-folder");
        i += 2;
        break;
      }
      case "--date-prefix": {
        options.datePrefix = true;
        i += 1;
        break;
      }
      case "--date-format": {
        options.dateFormat = requireValue(args, i, "--date-format") as ImportOptions["dateFormat"];
        i += 2;
        break;
      }
      case "--timestamp-format": {
        options.timestampFormat = requireValue(args, i, "--timestamp-format");
        i += 2;
        break;
      }
      case "--dry-run": {
        options.dryRun = true;
        i += 1;
        break;
      }
      case "--verbose": {
        options.verbose = true;
        i += 1;
        break;
      }
      case "--help":
      case "-h": {
        printGlobalHelp();
        process.exit(0);
      }
      default: {
        throw new Error(`Unknown option: ${arg}`);
      }
    }
  }

  if (!options.vault) {
    throw new Error("Missing required option --vault <path>");
  }
  if (!options.input || options.input.length === 0) {
    throw new Error("Missing required option --input <files...>");
  }
  if (!options.provider) {
    throw new Error("Missing required option --provider <provider>");
  }

  if (!VALID_PROVIDERS.includes(options.provider as (typeof VALID_PROVIDERS)[number])) {
    throw new Error(
      `Invalid provider "${options.provider}". Must be one of: ${VALID_PROVIDERS.join(", ")}`
    );
  }

  if (
    options.dateFormat &&
    !VALID_DATE_FORMATS.includes(options.dateFormat as (typeof VALID_DATE_FORMATS)[number])
  ) {
    throw new Error(
      `Invalid date format "${options.dateFormat}". Must be one of: ${VALID_DATE_FORMATS.join(", ")}`
    );
  }

  if (
    options.timestampFormat &&
    !VALID_TIMESTAMP_FORMATS.includes(
      options.timestampFormat as (typeof VALID_TIMESTAMP_FORMATS)[number]
    )
  ) {
    throw new Error(
      `Invalid timestamp format "${options.timestampFormat}". Must be one of: ${VALID_TIMESTAMP_FORMATS.join(", ")}`
    );
  }

  return options;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printGlobalHelp();
    return;
  }

  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(CLI_VERSION);
    return;
  }

  const command = argv[0];
  if (command !== "import") {
    throw new Error(`Unknown command: ${command}`);
  }

  const options = parseImportArgs(argv.slice(1));
  await runImport(options);
}

main().catch((error: any) => {
  console.error(`\nError: ${error?.message || String(error)}`);
  process.exit(1);
});
