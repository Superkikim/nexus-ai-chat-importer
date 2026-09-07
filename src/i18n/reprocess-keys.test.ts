import { describe, expect, it } from "vitest";
import deLocale from "./locales/de.json";
import enLocale from "./locales/en.json";
import esLocale from "./locales/es.json";
import frLocale from "./locales/fr.json";
import itLocale from "./locales/it.json";
import jaLocale from "./locales/ja.json";
import koLocale from "./locales/ko.json";
import ptLocale from "./locales/pt.json";
import ruLocale from "./locales/ru.json";
import zhLocale from "./locales/zh.json";

const locales: Record<string, unknown> = {
    de: deLocale,
    en: enLocale,
    es: esLocale,
    fr: frLocale,
    it: itLocale,
    ja: jaLocale,
    ko: koLocale,
    pt: ptLocale,
    ru: ruLocale,
    zh: zhLocale,
};

function reprocessBlock(locale: unknown): Record<string, string> | undefined {
    return (
        locale as {
            file_selection: { reprocess?: Record<string, string> };
        }
    ).file_selection.reprocess;
}

describe("reprocess toggle translations", () => {
    it.each(Object.keys(locales))(
        "%s carries a complete, translated reprocess block",
        (name) => {
            const block = reprocessBlock(locales[name]);

            expect(block).toBeDefined();
            for (const key of [
                "label",
                "description",
                "selective_hint",
                "warning",
            ]) {
                expect(block?.[key], `${name}.${key}`).toBeTruthy();
            }

            if (name !== "en") {
                // A verbatim copy of the English label means the locale was
                // added to the file but never actually translated.
                expect(block?.label).not.toBe(reprocessBlock(enLocale)?.label);
            }
        }
    );
});
