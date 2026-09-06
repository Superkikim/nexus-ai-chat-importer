import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import prettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default defineConfig([
    // ── Ignored paths ────────────────────────────────────────────────────────
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            // Build scripts are plain JS — not Obsidian plugin source.
            "**/*.mjs",
            "**/*.cjs",
            // Test-runner config: outside every tsconfig project, so the
            // type-aware rules cannot be applied to it.
            "**/vitest.config.ts",
            "vitest.setup.ts",
        ],
    },

    // ── Base: obsidianmd recommended ─────────────────────────────────────────
    // Provides: ESLint recommended + typescript-eslint v8 (with type-checked
    // rules for .ts files) + Obsidian-specific rules + eslint-plugin-import
    // + no-unsanitized + depend/ban-dependencies.
    // Parser is set to typescript-eslint/parser for .ts files by this config.
    ...obsidianmd.configs.recommended,

    // ── Type-aware parsing for plugin source ─────────────────────────────────
    // obsidianmd recommended enables type-checked rules that require a project.
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // ── Plugin source rule overrides ─────────────────────────────────────────
    {
        files: ["src/**/*.ts"],
        rules: {
            // ── Tech-debt: no-unsafe-* family ────────────────────────────────
            // These fire wherever an `unknown` or inferred-any value is used in
            // a typed context (e.g. JSON.parse results, index-signature access).
            // Deferred to a follow-up PR focused on full narrowing hygiene.
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-base-to-string": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/no-redundant-type-constituents": "off",
            // ─────────────────────────────────────────────────────────────────
            // Stricter unused-vars than the obsidianmd default (warn/args:none).
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_" },
            ],
            // Not a sample/starter plugin.
            "obsidianmd/sample-names": "off",
            // Existing UI strings predate sentence-case enforcement — deferred.
            "obsidianmd/ui/sentence-case": "off",
            // Allow warn/error/debug; bare console.log is still flagged.
            "no-console": ["warn", { allow: ["warn", "error", "debug"] }],
        },
    },

    // ── Test files (vitest, Node.js context) ────────────────────────────────
    // Tests run in Node.js via vitest — not in the Obsidian plugin sandbox.
    {
        files: ["src/**/*.test.ts", "src/tests/**/*.ts"],
        languageOptions: {
            globals: {
                process: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                Buffer: "readonly",
            },
        },
        rules: {
            // Console output is expected in tests.
            "no-console": "off",
            "obsidianmd/rule-custom-message": "off",
            // Tests may import Node.js built-ins directly.
            "import/no-nodejs-modules": "off",
            "depend/ban-dependencies": "off",
        },
    },

    // ── Prettier (must be last to override formatting rules) ─────────────────
    prettier,
    {
        plugins: { prettier: prettierPlugin },
        rules: {
            "prettier/prettier": [
                "error",
                { tabWidth: 4, useTabs: false, endOfLine: "auto" },
            ],
        },
    },
]);
