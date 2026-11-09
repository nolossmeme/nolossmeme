import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  // SonarQube rules (SonarSource's own ESLint plugin), same checks the Sonar scanner runs.
  sonarjs.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
    },
  },
  {
    // Test fixtures use fake client addresses (faucet rate limiting by IP).
    files: ["test/**/*.ts"],
    rules: { "sonarjs/no-hardcoded-ip": "off" },
  },
  { ignores: ["dist/**"] },
);
