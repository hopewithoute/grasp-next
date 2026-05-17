import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/.mastra/**", "**/.next/**", "**/node_modules/**", "**/dist/**"],
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
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
