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

// src/i18n/index.ts

import en from './locales/en.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import it from './locales/it.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import pt from './locales/pt.json';
import ko from './locales/ko.json';

const locales: Record<string, Record<string, any>> = {
    en, fr, de, es, it, ru, zh, ja, pt, ko
};

let _locale = 'en';

/**
 * Initialize locale from Obsidian's current language setting.
 * Falls back to English if the locale is not supported.
 * Call once in plugin onload().
 */
export function initLocale(): void {
    const lang = window.moment.locale(); // e.g. "fr", "de", "zh", "ja"
    _locale = locales[lang] ? lang : 'en';
}

/**
 * Translate a key to the current locale string.
 * Supports dot-notation keys (e.g. "settings.folders.title").
 * Supports variable interpolation with {{variable}} syntax.
 * Falls back to English, then to the raw key if not found.
 *
 * @param key - Dot-notation key path into the locale JSON
 * @param vars - Optional map of variable substitutions
 * @returns Translated string
 */
export function t(key: string, vars?: Record<string, string>): string {
    const keys = key.split('.');
    const resolve = (obj: Record<string, any>): string | undefined =>
        keys.reduce((o: any, k: string) => (o && typeof o === 'object' ? o[k] : undefined), obj);

    let str: string =
        resolve(locales[_locale]) ??
        resolve(locales['en']) ??
        key;

    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            str = str.split(`{{${k}}}`).join(v);
        }
    }

    return str;
}
