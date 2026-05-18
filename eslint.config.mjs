import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

// Scope obsidianmd configs to src/ only.
// Configs without a files filter get scoped to src/**/*.ts.
// Configs with **/*.ts or **/*.js patterns get restricted to src/ to avoid applying to cli/.
// package.json-specific configs are kept as-is.
const obsidianSrcCfgs = obsidianmd.configs.recommended.map((cfg) => {
    const files = cfg.files;
    if (!files) {
        return { ...cfg, files: ["src/**/*.ts", "src/**/*.tsx"] };
    }
    const flatFiles = [files].flat(Infinity);
    const hasBroadTsJs = flatFiles.some(
        (f) =>
            typeof f === "string" &&
            (f.startsWith("**/*.ts") ||
                f.startsWith("**/*.js") ||
                f.startsWith("**/*.tsx") ||
                f.startsWith("**/*.jsx")),
    );
    if (hasBroadTsJs) {
        return { ...cfg, files: ["src/**/*.ts", "src/**/*.tsx"] };
    }
    return cfg;
});

// Rules shared by both src and override blocks
const typeCheckedOverrides = {
    // From recommended-type-checked bundled inside obsidianmd.configs.recommended.
    // These represent pre-existing tech debt and are turned off to keep the config
    // focused on Obsidian-specific and type-correctness violations we actually fix.
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/no-redundant-type-constituents": "off",
    // These are addressed in P3.1 (reduce-any work)
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unnecessary-type-assertion": "off",
};

export default tseslint.config(
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "build/**",
            "eslint.config.mjs",
            "esbuild.config.mjs",
            "**/*.js",
            "**/*.cjs",
            // Test files are not Obsidian plugin code — they run in Node.js/test environments
            "src/**/*.test.ts",
            "src/tests/**",
        ],
    },
    // Plugin source — TypeScript parsing + project-aware rules
    {
        files: ["src/**/*.ts"],
        extends: [...tseslint.configs.recommended],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            ...prettierConfig.rules,
            "prettier/prettier": [
                "error",
                {
                    tabWidth: 4,
                    useTabs: false,
                    endOfLine: "auto",
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_" },
            ],
            "no-console": "off",
            "no-debugger": "warn",
            ...typeCheckedOverrides,
        },
    },
    // Obsidianmd configs — spread after src config
    ...obsidianSrcCfgs,
    // Override block — must come after obsidianmd spread to take precedence
    {
        files: ["src/**/*.ts"],
        rules: {
            ...typeCheckedOverrides,
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_" },
            ],
        },
    },
    // CLI code — Node.js shim, not part of the Obsidian plugin bundle
    {
        files: ["cli/**/*.ts"],
        extends: [...tseslint.configs.recommended],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: "./cli/tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                require: "readonly",
                module: "readonly",
                exports: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                process: "readonly",
                Buffer: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
            },
        },
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            ...prettierConfig.rules,
            "prettier/prettier": [
                "error",
                {
                    tabWidth: 4,
                    useTabs: false,
                    endOfLine: "auto",
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_" },
            ],
            "no-console": "off",
            "no-debugger": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-require-imports": "off",
        },
    },
);
