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

// src/tests/date-parser.test.ts
import { DateParser } from '../utils/date-parser';

/**
 * Test suite for DateParser
 * Run this in the browser console after loading the plugin
 */
export function testDateParser() {
    console.log('🧪 Testing DateParser...\n');

    const tests = [
        // ISO 8601 formats
        {
            name: 'ISO 8601 with milliseconds',
            input: '2024-06-28T22:34:21.000Z',
            expected: 1719606861
        },
        {
            name: 'ISO 8601 without milliseconds',
            input: '2024-06-28T22:34:21Z',
            expected: 1719606861
        },
        {
            name: 'ISO 8601 with space separator',
            input: '2024-06-28 22:34:21',
            expected: 1719606861
        },

        // US format (MM/DD/YYYY)
        {
            name: 'US format with seconds and AM/PM',
            input: '06/28/2024 at 10:34:21 PM',
            expected: 1719606861
        },
        {
            name: 'US format without seconds',
            input: '06/28/2024 at 10:34 PM',
            expected: 1719606840
        },

        // EU format (DD/MM/YYYY)
        {
            name: 'EU format with seconds',
            input: '28/06/2024 at 22:34:21',
            expected: 1719606861
        },
        {
            name: 'EU format without seconds',
            input: '28/06/2024 at 22:34',
            expected: 1719606840
        },

        // German format (DD.MM.YYYY)
        {
            name: 'German format with seconds',
            input: '28.06.2024 22:34:21',
            expected: 1719606861
        },
        {
            name: 'German format without seconds',
            input: '28.06.2024 22:34',
            expected: 1719606840
        },

        // Japanese format (YYYY/MM/DD)
        {
            name: 'Japanese format with seconds',
            input: '2024/06/28 22:34:21',
            expected: 1719606861
        },
        {
            name: 'Japanese format without seconds',
            input: '2024/06/28 22:34',
            expected: 1719606840
        },

        // Edge cases
        {
            name: 'Ambiguous date (both ≤ 12) - should default to DMY',
            input: '05/06/2024 at 10:30',
            expected: 1717667400 // June 5, 2024 (DMY interpretation)
        },
        {
            name: 'Unambiguous EU date (day > 12)',
            input: '15/03/2024 at 14:30',
            expected: 1710512200 // March 15, 2024
        },
        {
            name: 'Unambiguous US date (day > 12 in second position)',
            input: '03/15/2024 at 2:30 PM',
            expected: 1710512200 // March 15, 2024
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        const result = DateParser.parseDate(test.input);
        const success = result === test.expected;

        if (success) {
            console.log(`✅ ${test.name}`);
            console.log(`   Input: "${test.input}"`);
            console.log(`   Result: ${result} (expected: ${test.expected})\n`);
            passed++;
        } else {
            console.error(`❌ ${test.name}`);
            console.error(`   Input: "${test.input}"`);
            console.error(`   Result: ${result} (expected: ${test.expected})`);
            console.error(`   Difference: ${result - test.expected} seconds\n`);
            failed++;
        }
    }

    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

    // Test conversion to ISO 8601
    console.log('\n🔄 Testing conversion to ISO 8601...\n');

    const conversionTests = [
        {
            name: 'EU format to ISO',
            input: '28/06/2024 at 22:34:21',
            expectedPattern: /^2024-06-28T22:34:21\.\d{3}Z$/
        },
        {
            name: 'US format to ISO',
            input: '06/28/2024 at 10:34:21 PM',
            expectedPattern: /^2024-06-28T22:34:21\.\d{3}Z$/
        },
        {
            name: 'German format to ISO',
            input: '28.06.2024 22:34:21',
            expectedPattern: /^2024-06-28T22:34:21\.\d{3}Z$/
        }
    ];

    for (const test of conversionTests) {
        const result = DateParser.convertToISO8601(test.input);
        const success = result && test.expectedPattern.test(result);

        if (success) {
            console.log(`✅ ${test.name}`);
            console.log(`   Input: "${test.input}"`);
            console.log(`   Result: "${result}"\n`);
        } else {
            console.error(`❌ ${test.name}`);
            console.error(`   Input: "${test.input}"`);
            console.error(`   Result: "${result}"`);
            console.error(`   Expected pattern: ${test.expectedPattern}\n`);
        }
    }

    return { passed, failed };
}

// Auto-run tests if in development mode
if (typeof window !== 'undefined' && (window as any).testDateParser === undefined) {
    (window as any).testDateParser = testDateParser;
    console.log('💡 DateParser tests loaded. Run testDateParser() in console to test.');
}

