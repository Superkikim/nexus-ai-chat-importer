import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import {
    ClearChoice,
    CustomIdPropertyController,
    CustomIdPropertyUi,
} from "./custom-id-property-controller";

function setup(
    options: {
        name?: string;
        overwrite?: boolean;
        notes?: number;
        existing?: number;
        confirm?: boolean;
        clear?: ClearChoice;
    } = {}
) {
    const store = {
        name: options.name ?? "",
        overwrite: options.overwrite ?? false,
        save: vi.fn(async (name: string) => {
            store.name = name;
        }),
    };
    const files = Array.from({ length: options.notes ?? 3 }, () => new TFile());
    const service = {
        findConversationNotes: vi.fn(async () => files),
        countWithProperty: vi.fn(async () => options.existing ?? 0),
    };
    const ui = {
        confirmEnable: vi.fn(async () => options.confirm ?? true),
        confirmRename: vi.fn(async () => options.confirm ?? true),
        chooseClear: vi.fn(async () => options.clear ?? "keep"),
        run: vi.fn(async () => {}),
    } satisfies CustomIdPropertyUi;
    const controller = new CustomIdPropertyController(store, service, ui);
    return { controller, store, ui, files };
}

describe("CustomIdPropertyController", () => {
    describe("enabling", () => {
        it("asks with the counts, then saves and adds", async () => {
            const { controller, store, ui, files } = setup({ existing: 1 });

            expect(await controller.commit(" uid ")).toEqual({ value: "uid" });
            expect(ui.confirmEnable).toHaveBeenCalledWith("uid", 3, 1, false);
            expect(store.save).toHaveBeenCalledWith("uid");
            expect(ui.run).toHaveBeenCalledWith(
                { kind: "add", name: "uid", overwrite: false },
                files
            );
        });

        it("passes the overwrite toggle along", async () => {
            const { controller, ui } = setup({ overwrite: true });
            await controller.commit("uid");
            expect(ui.run).toHaveBeenCalledWith(
                { kind: "add", name: "uid", overwrite: true },
                expect.anything()
            );
        });

        it("Cancel restores the empty field and changes nothing", async () => {
            const { controller, store, ui } = setup({ confirm: false });

            expect(await controller.commit("uid")).toEqual({ value: "" });
            expect(store.save).not.toHaveBeenCalled();
            expect(ui.run).not.toHaveBeenCalled();
        });

        it("saves without asking when there is no note yet", async () => {
            const { controller, store, ui } = setup({ notes: 0 });

            expect(await controller.commit("uid")).toEqual({ value: "uid" });
            expect(ui.confirmEnable).not.toHaveBeenCalled();
            expect(store.save).toHaveBeenCalledWith("uid");
            expect(ui.run).not.toHaveBeenCalled();
        });
    });

    describe("renaming", () => {
        it("asks, then saves and renames", async () => {
            const { controller, store, ui } = setup({
                name: "uid",
                overwrite: true,
            });

            expect(await controller.commit("note_id")).toEqual({
                value: "note_id",
            });
            expect(ui.confirmRename).toHaveBeenCalledWith("uid", "note_id");
            expect(store.save).toHaveBeenCalledWith("note_id");
            expect(ui.run).toHaveBeenCalledWith(
                { kind: "rename", from: "uid", to: "note_id", overwrite: true },
                expect.anything()
            );
        });

        it("Cancel restores the previous name", async () => {
            const { controller, store, ui } = setup({
                name: "uid",
                confirm: false,
            });

            expect(await controller.commit("note_id")).toEqual({
                value: "uid",
            });
            expect(store.save).not.toHaveBeenCalled();
            expect(ui.run).not.toHaveBeenCalled();
        });
    });

    describe("clearing", () => {
        it.each([
            ["remove_plugin", true],
            ["remove_all", false],
        ] as const)("%s removes the property", async (clear, onlyPlugin) => {
            const { controller, store, ui } = setup({
                name: "uid",
                existing: 2,
                clear,
            });

            expect(await controller.commit("")).toEqual({ value: "" });
            expect(ui.chooseClear).toHaveBeenCalledWith("uid");
            expect(store.save).toHaveBeenCalledWith("");
            expect(ui.run).toHaveBeenCalledWith(
                { kind: "remove", name: "uid", onlyPluginValue: onlyPlugin },
                expect.anything()
            );
        });

        it("keep stops adding without touching notes", async () => {
            const { controller, store, ui } = setup({
                name: "uid",
                existing: 2,
                clear: "keep",
            });

            expect(await controller.commit("  ")).toEqual({ value: "" });
            expect(store.save).toHaveBeenCalledWith("");
            expect(ui.run).not.toHaveBeenCalled();
        });

        it("dismissing the dialog restores the name", async () => {
            const { controller, store } = setup({
                name: "uid",
                existing: 2,
                clear: "cancel",
            });

            expect(await controller.commit("")).toEqual({ value: "uid" });
            expect(store.save).not.toHaveBeenCalled();
        });

        it("does not ask when no note has the property", async () => {
            const { controller, store, ui } = setup({ name: "uid" });

            expect(await controller.commit("")).toEqual({ value: "" });
            expect(ui.chooseClear).not.toHaveBeenCalled();
            expect(store.save).toHaveBeenCalledWith("");
        });
    });

    describe("refused names", () => {
        it.each([
            ["Tags", "reserved"],
            ["CONVERSATION_ID", "reserved"],
            ["2id", "format"],
            ["my id", "format"],
        ] as const)("%s keeps the name in effect", async (typed, warning) => {
            const { controller, store, ui } = setup({ name: "uid" });

            expect(await controller.commit(typed)).toEqual({
                value: "uid",
                warning,
            });
            expect(store.save).not.toHaveBeenCalled();
            expect(ui.confirmRename).not.toHaveBeenCalled();
        });

        it("keeps the field empty when the feature is off", async () => {
            const { controller } = setup();
            expect(await controller.commit("aliases")).toEqual({
                value: "",
                warning: "reserved",
            });
        });
    });

    it("does nothing when the name is unchanged", async () => {
        const { controller, store, ui } = setup({ name: "uid" });

        expect(await controller.commit("uid ")).toEqual({ value: "uid" });
        expect(store.save).not.toHaveBeenCalled();
        expect(ui.run).not.toHaveBeenCalled();
    });

    it("treats an invalid stored name as off", async () => {
        const { controller, ui } = setup({ name: "tags" });

        await controller.commit("uid");
        expect(ui.confirmEnable).toHaveBeenCalled();
    });
});
