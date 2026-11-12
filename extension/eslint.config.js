import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "coverage/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      "no-unused-vars": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: "error",
    },
  },
  {
    files: ["tests/**/*.js", "*.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];