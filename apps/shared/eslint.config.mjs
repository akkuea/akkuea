import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "dist/",
      "node_modules/",
      "src/contracts/generated/**/*.ts",
      "src/contracts/game/generated/**/*.ts",
      "src/contracts/game/generated/**/*.js",
      "**/*.test.ts",
      "**/*.spec.ts",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];
