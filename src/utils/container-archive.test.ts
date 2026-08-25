import { describe, expect, it } from "vitest";
import {
    expandContainerArchives,
    findNestedConversationArchives,
} from "./container-archive";
import { buildZip, buildInnerExport, toFile } from "../tests/zip-fixtures";

const encoder = new TextEncoder();

async function buildContainer(
    entries: { name: string; data: Uint8Array; compress?: boolean }[]
): Promise<Uint8Array> {
    return buildZip([
        { name: "report.html", data: encoder.encode("<h2>Hi</h2>") },
        { name: "Financial/Invoice Items.csv", data: encoder.encode("a,b\n") },
        ...entries,
    ]);
}

describe("findNestedConversationArchives", () => {
    it("finds the conversation archive and ignores its siblings", () => {
        expect(
            findNestedConversationArchives([
                "report.html",
                "User Online Activity/Conversations__abc-chatgpt-0001.zip",
                "User Online Activity/Files__abc-files-0001.zip",
                "User Online Activity/Ads__abc-ads-0001.zip",
                "Financial/Invoice Items.csv",
            ])
        ).toEqual(["User Online Activity/Conversations__abc-chatgpt-0001.zip"]);
    });

    it("matches the single-underscore naming reported in the wild", () => {
        expect(
            findNestedConversationArchives([
                "User Online Activity/Conversations_xxxxx-chatgpt-0001.zip",
            ])
        ).toHaveLength(1);
    });

    it("ignores unrelated archives", () => {
        expect(
            findNestedConversationArchives(["backup.zip", "photos/holiday.zip"])
        ).toEqual([]);
    });
});

describe("expandContainerArchives", () => {
    it("replaces a container with the archives it carries", async () => {
        const container = await buildContainer([
            {
                name: "User Online Activity/Conversations__abc-chatgpt-0001.zip",
                data: await buildInnerExport(),
            },
        ]);

        const result = await expandContainerArchives([
            toFile(container, "OpenAI-export.zip"),
        ]);

        expect(result.expandedContainers).toEqual(["OpenAI-export.zip"]);
        expect(result.files.map((file) => file.name)).toEqual([
            "Conversations__abc-chatgpt-0001.zip",
        ]);
    });

    it("leaves the attachment archive behind", async () => {
        const container = await buildContainer([
            {
                name: "User Online Activity/Files__abc-files-0001.zip",
                data: await buildZip([
                    {
                        name: "personal/files/avatar.png",
                        data: new Uint8Array([1, 2, 3]),
                    },
                ]),
            },
            {
                name: "User Online Activity/Conversations__abc-chatgpt-0001.zip",
                data: await buildInnerExport(),
            },
        ]);

        const result = await expandContainerArchives([
            toFile(container, "OpenAI-export.zip"),
        ]);

        expect(result.files.map((file) => file.name)).toEqual([
            "Conversations__abc-chatgpt-0001.zip",
        ]);
    });

    it("leaves an ordinary export untouched and unwrapped", async () => {
        const exportFile = toFile(
            await buildInnerExport(),
            "chatgpt-export.zip"
        );

        const result = await expandContainerArchives([exportFile]);

        expect(result.expandedContainers).toEqual([]);
        // Same object: re-wrapping would drop the desktop `path` property.
        expect(result.files[0]).toBe(exportFile);
    });

    it("leaves the container untouched when the inner archive is compressed", async () => {
        const container = await buildContainer([
            {
                name: "User Online Activity/Conversations__abc-chatgpt-0001.zip",
                data: await buildInnerExport(),
                compress: true,
            },
        ]);
        const containerFile = toFile(container, "OpenAI-export.zip");

        const result = await expandContainerArchives([containerFile]);

        expect(result.expandedContainers).toEqual([]);
        expect(result.files).toEqual([containerFile]);
    });

    it("leaves the container untouched when the inner archive is not a supported export", async () => {
        const container = await buildContainer([
            {
                name: "User Online Activity/Conversations__abc-chatgpt-0001.zip",
                data: await buildZip([
                    { name: "readme.txt", data: encoder.encode("nothing") },
                ]),
            },
        ]);
        const containerFile = toFile(container, "OpenAI-export.zip");

        const result = await expandContainerArchives([containerFile]);

        expect(result.expandedContainers).toEqual([]);
        expect(result.files).toEqual([containerFile]);
    });

    it("leaves an unrelated nested-zip archive untouched", async () => {
        const container = await buildZip([
            { name: "photos/holiday.zip", data: await buildInnerExport() },
        ]);
        const containerFile = toFile(container, "backup.zip");

        const result = await expandContainerArchives([containerFile]);

        expect(result.files).toEqual([containerFile]);
    });

    it("keeps inner names unique across two containers", async () => {
        const inner = await buildInnerExport();
        const makeContainer = async () =>
            buildContainer([
                {
                    name: "User Online Activity/Conversations__abc-chatgpt-0001.zip",
                    data: inner,
                },
            ]);

        const result = await expandContainerArchives([
            toFile(await makeContainer(), "export-a.zip"),
            toFile(await makeContainer(), "export-b.zip"),
        ]);

        expect(result.files.map((file) => file.name)).toEqual([
            "Conversations__abc-chatgpt-0001.zip",
            "Conversations__abc-chatgpt-0001 (2).zip",
        ]);
    });

    it("expands a container while passing other selections through", async () => {
        const container = await buildContainer([
            {
                name: "User Online Activity/Conversations__abc-chatgpt-0001.zip",
                data: await buildInnerExport(),
            },
        ]);
        const plainExport = toFile(await buildInnerExport(), "direct.zip");

        const result = await expandContainerArchives([
            plainExport,
            toFile(container, "OpenAI-export.zip"),
        ]);

        expect(result.files.map((file) => file.name)).toEqual([
            "direct.zip",
            "Conversations__abc-chatgpt-0001.zip",
        ]);
    });
});
