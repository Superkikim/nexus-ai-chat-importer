// src/providers/provider-registry.ts
import { DefaultProviderRegistry } from "./provider-adapter";
import { ChatGPTAdapter } from "./chatgpt/chatgpt-adapter";
import type NexusAiChatImporterPlugin from "../main";

/**
 * Create and configure the provider registry with all available providers
 */
export function createProviderRegistry(plugin: NexusAiChatImporterPlugin): DefaultProviderRegistry {
    const registry = new DefaultProviderRegistry();
    
    // Register ChatGPT provider
    registry.register("chatgpt", new ChatGPTAdapter(plugin));
    
    // Future providers will be registered here:
    // registry.register("claude", new ClaudeAdapter(plugin));
    // registry.register("gemini", new GeminiAdapter(plugin));
    
    return registry;
}
