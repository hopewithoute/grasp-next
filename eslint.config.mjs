import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default tseslint.config(
  {
    ignores: ["**/.mastra/**", "**/.next/**", "**/node_modules/**", "**/dist/**", "**/*.config.*"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["packages/domain/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "bullmq",
                "@mastra/*",
                "@ai-sdk/*",
                "openai",
                "anthropic",
                "better-auth",
                "better-auth/*",
                "@grasp/db",
                "@grasp/ai",
              ],
              message:
                "packages/domain must stay framework-agnostic. Wire concrete adapters in apps/web, apps/worker, packages/db, or packages/ai.",
            },
          ],
        },
      ],
    },
  }
);
