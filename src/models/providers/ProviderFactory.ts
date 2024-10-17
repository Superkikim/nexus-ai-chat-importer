import path from "path"; // Node.js path module for managing file paths
import fs from "fs-extra"; // Use fs-extra to read directory contents

/**
 * Factory class to create provider models and standardize the output data.
 */
export class ProviderFactory {
    /**
     * Creates a provider model based on the type of input data.
     * @param providerType The type of provider this data is coming from (ChatGPT, Claude, Continue).
     * @param jsonData The JSON data to be processed.
     * @returns A standardized representation of the conversation data.
     */
    static async createProviderModel(
        providerType: string,
        jsonData: any
    ): Promise<any> {
        try {
            // Get the path to the provider's model file dynamically
            const providerPath = path.join(
                __dirname,
                `${providerType}/JsonModel.js`
            );
            const providerModule = await import(providerPath); // Dynamically import the provider module

            // Assuming each provider model exports a class with a constructor accepting jsonData
            const ProviderModel = providerModule[`${providerType}JsonModel`];

            if (!ProviderModel) {
                throw new Error(
                    `Provider model for ${providerType} not found.`
                );
            }

            const modelInstance = new ProviderModel(jsonData);
            const standardizedData = {
                conversation_id:
                    modelInstance.getConversations()[0].uuid || null,
                conversation_model: "Unspecified",
                create_time: modelInstance.getConversations()[0].created_at,
                update_time: modelInstance.getConversations()[0].updated_at,
                chat_messages:
                    modelInstance.getConversations()[0].chat_messages,
            };

            return standardizedData; // Return the standardized data for further processing
        } catch (error) {
            console.error(`Error creating provider model: ${error.message}`);
            throw error; // Rethrow after logging for further handling
        }
    }

    /**
     * Lists the available providers based on the files in the providers directory.
     * @returns An array of provider types available for use.
     */
    static async listAvailableProviders(): Promise<string[]> {
        const providerDir = path.join(__dirname, "."); // Adjust to your provider directory, if different
        const files = await fs.readdir(providerDir);
        return files
            .filter((file) => file.endsWith("JsonModel.js")) // Filter to include only model files
            .map((file) => file.replace("JsonModel.js", "")); // Extract and return provider type names
    }
}
