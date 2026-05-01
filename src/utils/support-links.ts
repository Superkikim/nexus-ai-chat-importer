const NEXUS_DOCS_BASE = "https://nexus-prod.dev";
const NEXUS_DOCS_SLUG = "nexus-ai-chat-importer";
const SUPPORTED_NEXUS_LOCALES = ["fr", "de", "es", "it", "ru", "zh", "ja", "pt", "ko"] as const;

type SupportedNexusLocale = typeof SUPPORTED_NEXUS_LOCALES[number];

function normalizeLocale(locale?: string): string {
    const runtimeLocale =
        locale ??
        ((globalThis as any)?.window?.moment?.locale?.() as string | undefined) ??
        "en";

    return runtimeLocale.toLowerCase().split(/[-_]/)[0];
}

function isSupportedLocale(locale?: string): locale is SupportedNexusLocale {
    if (!locale) return false;
    return (SUPPORTED_NEXUS_LOCALES as readonly string[]).includes(locale);
}

export function getSupportedNexusLocales(): readonly string[] {
    return [...SUPPORTED_NEXUS_LOCALES];
}

export function getLocalizedDocsUrl(locale?: string): string {
    const normalized = normalizeLocale(locale);
    if (isSupportedLocale(normalized)) {
        return `${NEXUS_DOCS_BASE}/${normalized}/${NEXUS_DOCS_SLUG}`;
    }

    return `${NEXUS_DOCS_BASE}/${NEXUS_DOCS_SLUG}`;
}

export function getLocalizedSupportUrl(locale?: string): string {
    return `${getLocalizedDocsUrl(locale)}/support`;
}

