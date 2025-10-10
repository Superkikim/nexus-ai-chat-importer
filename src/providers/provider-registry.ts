/**
 * Nexus AI Chat Importer - Obsidian Plugin
 * Copyright (C) 2024 Akim Sissaoui
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


// src/providers/provider-registry.ts
import { DefaultProviderRegistry } from "./provider-adapter";
import { ChatGPTAdapter } from "./chatgpt/chatgpt-adapter";
import { ClaudeAdapter } from "./claude/claude-adapter";
import type NexusAiChatImporterPlugin from "../main";

/**
 * Create and configure the provider registry with all available providers
 */
export function createProviderRegistry(plugin: NexusAiChatImporterPlugin): DefaultProviderRegistry {
    const registry = new DefaultProviderRegistry();

    // Register ChatGPT provider
    registry.register("chatgpt", new ChatGPTAdapter(plugin));

    // Register Claude provider
    registry.register("claude", new ClaudeAdapter(plugin));

    // Future providers will be registered here:
    // registry.register("gemini", new GeminiAdapter(plugin));

    return registry;
}
