// ProviderManager.ts
import { App } from "obsidian"; // For the Obsidian app instance
import FileManager from "./FileManager"; // Named import for FileManager
import { Provider } from "../types"; // Path to your Provider type definition

class ProviderManager {
    private app: App;
    private providers: { [key: string]: Provider }; // Mapping of provider names to provider configurations
    private fileManager: FileManager; // Declare the fileManager property

    constructor(app: App) {
        this.app = app;
        this.providers = {};
        this.fileManager = new FileManager(app); // Instantiate the FileManager
    }

    /**
     * Load providers from the specified directory.
     * @param directory The directory where provider YAML files are stored.
     */
    async loadProviders(directory: string): Promise<void> {
        const files = await fs.readdir(directory); // Still need this line to get file names
        for (const file of files) {
            if (file.endsWith(".yaml")) {
                const filePath = path.join(directory, file);
                const fileContent = await this.fileManager.readFile(filePath); // Use readFile from FileManager
                const providerConfig = YAML.parse(fileContent);
                this.providers[providerConfig.provider.name] =
                    providerConfig.provider; // Storing the provider by name
            }
        }
    }

    /**
     * Initialize the ProviderManager by loading providers.
     * @param directory The directory to load provider configurations from.
     */
    async initialize(directory: string): Promise<void> {
        await this.loadProviders(directory);
    }

    /**
     * Teardown the ProviderManager by cleaning up any resources.
     */
    async teardown(): Promise<void> {
        this.providers = {};
    }

    /**
     * Identify the provider for a given uploaded file.
     * This method checks the file against all registered providers by their name regex,
     * verifies the required files for ZIP formats, and validates required fields present
     * in the parsed JSON structure.
     *
     * @param file The uploaded File object to be processed.
     * @returns A JSON object associated with a single matched provider if found,
     *          an indication of multiple provider matches, or null if no valid
     *          provider is found.
     * @throws Error If an unexpected error occurs during the provider identification process.
     */
    async identifyProvider(file: File): Promise<any> {
        const matchingProviders: Provider[] = [];
        let jsonData: any;

        try {
            for (const providerName in this.providers) {
                const provider = this.providers[providerName];
                const regex = new RegExp(provider.file_format.filename_regex);

                // Check if the file name matches the provider's regex
                if (!regex.test(file.name)) {
                    continue; // Skip to the next provider if regex does not match
                }

                // If the file is a ZIP
                if (provider.file_format.type === "zip") {
                    const zipFileContent =
                        await this.fileManager.listZipFileContents(file);

                    // Check if all required files are present in the ZIP file
                    const allRequiredFilesPresent =
                        provider.file_format.required_files.every(
                            (requiredFile) =>
                                zipFileContent.includes(requiredFile)
                        );

                    // If required files are not present, skip to the next provider
                    if (!allRequiredFilesPresent) {
                        continue;
                    }

                    // Ensure provider.conversation.file is not null before passing it
                    if (provider.conversation.file) {
                        // Check if it's non-null
                        jsonData =
                            await this.fileManager.extractConversationFileFromZip(
                                file,
                                provider.conversation.file
                            );
                    } else {
                        // Handle the case where conversation.file is null (skip this provider, log an error, etc.)
                        console.warn(
                            `Conversation file is null for provider: ${providerName}`
                        );
                        continue; // Skip to the next provider
                    }
                }

                // Check if non-null fields from the provider's schema are present in the JSON
                const requiredFields = Object.keys(
                    provider.conversation.schema.required_fields
                );
                const allRequiredFieldsPresent = requiredFields.every((field) =>
                    jsonData.hasOwnProperty(field)
                );

                // If required fields are missing, skip to the next provider
                if (!allRequiredFieldsPresent) {
                    continue;
                }

                // Add the matching provider to the list
                matchingProviders.push(provider);
            }

            // Post loop evaluation
            if (matchingProviders.length > 1) {
                // Placeholder for multi-provider match handling
                return {
                    status: "multi-provider match",
                    providers: matchingProviders,
                };
            } else if (matchingProviders.length === 1) {
                // Return the successfully matched JSON data
                return jsonData;
            }

            // If no provider matched
            return null;
        } catch (error: any) {
            // Handle unexpected errors during the provider identification process
            throw new Error(
                `Error identifying provider for file '${file.name}': ${error.message}`
            );
        }
    }
}

export { ProviderManager };
