/**
 * Nexus AI Chat Importer CLI
 *
 * Non-interactive CLI that imports ChatGPT/Claude ZIP exports
 * into an Obsidian vault using the plugin's services.
 */

import { Command } from "commander";
import { runImport } from "./run-import";

const program = new Command();

program
  .name("nexus-cli")
  .description("Import ChatGPT/Claude chat exports into an Obsidian vault")
  .version("1.0.0");

program
  .command("import")
  .description("Import one or more ZIP exports into a vault")
  .requiredOption("--vault <path>", "Path to the Obsidian vault")
  .requiredOption(
    "--input <files...>",
    "One or more ZIP export files to import"
  )
  .option(
    "--provider <provider>",
    "Provider: chatgpt or claude (auto-detected if omitted)"
  )
  .option(
    "--conversation-folder <folder>",
    "Conversation folder path (default: from plugin config or Nexus/Conversations)"
  )
  .option(
    "--attachment-folder <folder>",
    "Attachment folder path (default: from plugin config or Nexus/Attachments)"
  )
  .option(
    "--report-folder <folder>",
    "Report folder path (default: from plugin config or Nexus/Reports)"
  )
  .option("--date-prefix", "Add date prefix to filenames")
  .option(
    "--date-format <format>",
    "Date format for prefix: YYYY-MM-DD or YYYYMMDD"
  )
  .option(
    "--timestamp-format <format>",
    "Message timestamp format: locale, iso, us, eu, de, jp"
  )
  .option("--dry-run", "Print what would be imported without writing files")
  .option("--verbose", "Enable verbose output")
  .action(async (opts) => {
    try {
      // Validate provider if explicitly given
      if (opts.provider) {
        const validProviders = ["chatgpt", "claude"];
        if (!validProviders.includes(opts.provider)) {
          console.error(
            `Error: Invalid provider "${opts.provider}". Must be one of: ${validProviders.join(", ")}`
          );
          process.exit(1);
        }
      }

      // Validate date format if provided
      if (opts.dateFormat) {
        const validDateFormats = ["YYYY-MM-DD", "YYYYMMDD"];
        if (!validDateFormats.includes(opts.dateFormat)) {
          console.error(
            `Error: Invalid date format "${opts.dateFormat}". Must be one of: ${validDateFormats.join(", ")}`
          );
          process.exit(1);
        }
      }

      // Validate timestamp format if provided
      if (opts.timestampFormat) {
        const validTimestampFormats = [
          "locale",
          "iso",
          "us",
          "eu",
          "de",
          "jp",
        ];
        if (!validTimestampFormats.includes(opts.timestampFormat)) {
          console.error(
            `Error: Invalid timestamp format "${opts.timestampFormat}". Must be one of: ${validTimestampFormats.join(", ")}`
          );
          process.exit(1);
        }
      }

      await runImport({
        vault: opts.vault,
        input: opts.input,
        provider: opts.provider,
        conversationFolder: opts.conversationFolder,
        attachmentFolder: opts.attachmentFolder,
        reportFolder: opts.reportFolder,
        datePrefix: opts.datePrefix,
        dateFormat: opts.dateFormat as "YYYY-MM-DD" | "YYYYMMDD",
        timestampFormat: opts.timestampFormat,
        dryRun: opts.dryRun,
        verbose: opts.verbose,
      });
    } catch (error: any) {
      console.error(`\nError: ${error.message}`);
      if (opts.verbose && error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
