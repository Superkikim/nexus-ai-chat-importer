// SPDX-License-Identifier: GPL-3.0-or-later

import {
    ProviderSpecificColumn,
    ReportNamingStrategy,
} from "../../types/standard";
import { extractReportPrefixFromZip } from "../../utils/report-naming-utils";
import { isGrokConversation } from "./grok-types";

export class GrokReportNamingStrategy implements ReportNamingStrategy {
    extractReportPrefix(zipFileName: string): string {
        // Grok names its archive after a UUID: the import date stands in.
        return extractReportPrefixFromZip(zipFileName, [
            /(\d{4})-(\d{2})-(\d{2})/,
        ]);
    }

    getProviderName(): string {
        return "grok";
    }

    getProviderSpecificColumn(): ProviderSpecificColumn {
        return {
            header: "Attachments",
            countsImportedAttachments: true,
            getValue: (_adapter: unknown, chat: unknown) => {
                if (!isGrokConversation(chat)) return 0;
                return chat.responses.reduce(
                    (sum, r) =>
                        sum + (r.response?.file_attachments?.length ?? 0),
                    0
                );
            },
        };
    }
}
