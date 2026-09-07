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

/**
 * English is the source of truth and `t()` silently falls back to it, so a key
 * missing from a translation is invisible until a user running that language
 * hits the string. The whole `archive_messages` block sat untranslated in all
 * nine locales that way. This compares full key sets instead of one block at a
 * time, so the next gap fails here rather than shipping.
 */

const translations: Record<string, unknown> = {
    de: deLocale,
    es: esLocale,
    fr: frLocale,
    it: itLocale,
    ja: jaLocale,
    ko: koLocale,
    pt: ptLocale,
    ru: ruLocale,
    zh: zhLocale,
};

/** Every leaf path, e.g. "import_completion.stats.not_selected". */
function leafKeys(value: unknown, prefix = ""): string[] {
    if (value === null || typeof value !== "object") {
        return [prefix];
    }
    return Object.entries(value as Record<string, unknown>).flatMap(
        ([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key)
    );
}

/** Placeholders a string expects, e.g. {{count}}. */
function placeholders(value: string): string[] {
    return (value.match(/\{\{\w+\}\}/g) ?? []).sort();
}

function leafAt(locale: unknown, path: string): unknown {
    return path
        .split(".")
        .reduce<unknown>(
            (node, key) =>
                node !== null && typeof node === "object"
                    ? (node as Record<string, unknown>)[key]
                    : undefined,
            locale
        );
}

const englishKeys = leafKeys(enLocale).sort();

describe("locale parity", () => {
    it("english carries a non-trivial number of keys", () => {
        // Guards the guard: an empty source would make every check below pass.
        expect(englishKeys.length).toBeGreaterThan(300);
    });

    it.each(Object.keys(translations))(
        "%s defines every english key",
        (name) => {
            const missing = englishKeys.filter(
                (key) => leafAt(translations[name], key) === undefined
            );

            expect(missing).toEqual([]);
        }
    );

    it.each(Object.keys(translations))(
        "%s defines no key english lacks",
        (name) => {
            const englishSet = new Set(englishKeys);
            const extra = leafKeys(translations[name])
                .filter((key) => !englishSet.has(key))
                .sort();

            expect(extra).toEqual([]);
        }
    );

    it.each(Object.keys(translations))(
        "%s keeps the same placeholders as english",
        (name) => {
            const mismatched = englishKeys
                .map((key) => {
                    const source = leafAt(enLocale, key);
                    const target = leafAt(translations[name], key);
                    if (
                        typeof source !== "string" ||
                        typeof target !== "string"
                    ) {
                        return null;
                    }
                    const expected = placeholders(source);
                    const actual = placeholders(target);
                    return expected.join() === actual.join()
                        ? null
                        : { key, expected, actual };
                })
                .filter((entry) => entry !== null);

            expect(mismatched).toEqual([]);
        }
    );

    it.each(Object.keys(translations))("%s leaves no value empty", (name) => {
        const blank = leafKeys(translations[name]).filter((key) => {
            const value = leafAt(translations[name], key);
            return typeof value === "string" && value.trim() === "";
        });

        expect(blank).toEqual([]);
    });
});
