// SPDX-License-Identifier: GPL-3.0-or-later

import { StandardConversation } from "../../types/standard";
import type NexusAiChatImporterPlugin from "../../main";
import {
    AttachmentExtractor,
    BaseProviderAdapter,
} from "../base/base-provider-adapter";
import { DEFAULT_ITEM_CATEGORY } from "../provider-adapter";
import { GrokAttachmentExtractor } from "./grok-attachment-extractor";
import { GROK_IMAGINE_CATEGORY, GrokConverter } from "./grok-converter";
import { GrokReportNamingStrategy } from "./grok-report-naming";
import { GrokItem, isGrokConversation, isGrokMediaPost } from "./grok-types";

export class GrokAdapter extends BaseProviderAdapter<GrokItem> {
    private attachmentExtractor: GrokAttachmentExtractor;
    private reportNamingStrategy = new GrokReportNamingStrategy();

    constructor(plugin: NexusAiChatImporterPlugin) {
        super();
        this.attachmentExtractor = new GrokAttachmentExtractor(
            plugin,
            plugin.logger
        );
    }

    detect(rawConversations: unknown[]): boolean {
        const sample = rawConversations[0];
        return isGrokConversation(sample) || isGrokMediaPost(sample);
    }

    getId(chat: GrokItem): string {
        if (isGrokConversation(chat)) return chat.conversation.id;
        return isGrokMediaPost(chat) ? chat.id : "";
    }

    getTitle(chat: GrokItem): string {
        if (isGrokConversation(chat)) {
            return GrokConverter.conversationTitle(chat);
        }
        return isGrokMediaPost(chat)
            ? GrokConverter.mediaPostTitle(chat)
            : "Untitled";
    }

    getCreateTime(chat: GrokItem): number {
        return Math.floor(this.convertChat(chat).createTime);
    }

    getUpdateTime(chat: GrokItem): number {
        return Math.floor(this.convertChat(chat).updateTime);
    }

    convertChat(chat: GrokItem): StandardConversation {
        if (isGrokConversation(chat)) {
            return GrokConverter.convertConversation(chat);
        }
        if (isGrokMediaPost(chat)) {
            return GrokConverter.convertMediaPost(chat);
        }
        throw new Error("Unrecognized Grok export item");
    }

    getProviderName(): string {
        return "grok";
    }

    /**
     * Compared on converted messages: a response the note never shows (empty
     * text, no file) must not keep reading as new.
     */
    getNewMessages(chat: GrokItem, existingMessageIds: string[]): unknown[] {
        const existing = new Set(existingMessageIds);
        return this.convertChat(chat).messages.filter(
            (message) => !existing.has(message.id)
        );
    }

    getReportNamingStrategy() {
        return this.reportNamingStrategy;
    }

    getItemCategory(chat: GrokItem): string {
        return isGrokMediaPost(chat)
            ? GROK_IMAGINE_CATEGORY
            : DEFAULT_ITEM_CATEGORY;
    }

    getExclusionReason(chat: GrokItem): string | null {
        if (isGrokMediaPost(chat) && !(chat.original_prompt || "").trim()) {
            return "empty prompt";
        }
        return null;
    }

    protected getAttachmentExtractor(): AttachmentExtractor {
        return this.attachmentExtractor;
    }
}
