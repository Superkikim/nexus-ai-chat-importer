import { describe, expect, it } from "vitest";
import { ImportService } from "./import-service";
import { buildInnerExport, buildZip, toFile } from "../tests/zip-fixtures";
import type NexusAiChatImporterPlugin from "../main";

function createTestPlugin(): NexusAiChatImporterPlugin {
    const logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        child: () => logger,
    };
    return {
        logger,
        settings: {},
        app: { vault: {} },
        manifest: { id: "nexus-ai-chat-importer" },
    } as unknown as NexusAiChatImporterPlugin;
}

describe("ImportService.buildAttachmentMapForMultiZip", () => {
    it("keeps every mapped location on the right archive when one cannot be opened", async () => {
        const service = new ImportService(createTestPlugin());
        const unreadable = toFile(new Uint8Array([1, 2, 3, 4]), "broken.zip");
        const part1 = toFile(await buildInnerExport(), "export-part-0001.zip");
        const part2 = toFile(
            await buildZip([
                {
                    name: "file_00000000aaaa1111bbbb2222cccc3333.dat",
                    data: new Uint8Array([9, 9, 9]),
                },
            ]),
            "export-part-0002.zip"
        );

        await service.buildAttachmentMapForMultiZip(
            [unreadable, part1, part2],
            "chatgpt"
        );

        const internals = service as unknown as {
            currentAttachmentMap: Map<
                string,
                { zipIndex: number; path: string }[]
            >;
            currentZips: { has(path: string): boolean }[];
        };
        const locations = internals.currentAttachmentMap.get(
            "file_00000000aaaa1111bbbb2222cccc3333"
        );
        expect(locations).toHaveLength(1);
        for (const location of internals.currentAttachmentMap.values()) {
            for (const { zipIndex, path } of location) {
                expect(internals.currentZips[zipIndex]?.has(path)).toBe(true);
            }
        }
    });
});
