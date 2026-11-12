import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["public/**"] },
  js.configs.recommended,
  sonarjs.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/consistent-type-imports": "error" } },
);
