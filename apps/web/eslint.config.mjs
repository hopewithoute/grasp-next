import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const clientBoundaryRules = {
  files: [
    "components/**/*.tsx",
    "features/**/*form*.tsx",
    "features/**/concept-graph-review.tsx",
    "features/**/concept-graph-view.tsx",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "@grasp/domain",
              "@grasp/db",
              "@grasp/ai",
              "@/server/*",
              "next/cache",
              "next/headers",
              "next/server",
              "better-auth",
              "better-auth/*",
            ],
            message:
              "Client UI must not import domain, server, database, queue, auth, or AI runtime modules. Pass DTO-shaped props or call Server Actions instead.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = [...nextVitals, ...nextTypeScript, clientBoundaryRules, prettier];

export default eslintConfig;
