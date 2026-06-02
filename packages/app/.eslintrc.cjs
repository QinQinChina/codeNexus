// ESLint 配置：统一约束 TypeScript、Vue 与脚本目录的静态检查规则。
const tsParser = require.resolve("@typescript-eslint/parser");

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: ["dist/", "release/", "node_modules/"],
  overrides: [
    {
      files: ["**/*.ts"],
      parser: tsParser,
      plugins: ["@typescript-eslint", "unused-imports"],
      rules: {
        "no-undef": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
        ],
        "unused-imports/no-unused-imports": "error",
        "unused-imports/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
        ],
      },
    },
    {
      files: ["**/*.vue"],
      parser: "vue-eslint-parser",
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: [".vue"],
        ecmaVersion: "latest",
        sourceType: "module",
      },
      extends: ["plugin:vue/vue3-essential"],
      plugins: ["@typescript-eslint", "unused-imports"],
      rules: {
        "no-undef": "off",
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
        ],
        "unused-imports/no-unused-imports": "error",
        "unused-imports/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
        ],
        "vue/multi-word-component-names": "off",
      },
    },
    {
      files: ["scripts/**/*.mjs", "*.mjs"],
      extends: ["eslint:recommended"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      plugins: ["unused-imports"],
      rules: {
        "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
        "unused-imports/no-unused-imports": "error",
        "unused-imports/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
        ],
      },
    },
  ],
};
