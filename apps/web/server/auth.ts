import "./load-env";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createDbClient, schema } from "@grasp/db";

const databaseUrl = process.env.DATABASE_URL;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

if (!googleClientId || !googleClientSecret) {
  throw new Error("Google OAuth credentials are required.");
}

export const auth = betterAuth({
  database: drizzleAdapter(createDbClient(databaseUrl), {
    provider: "pg",
    schema,
  }),
  socialProviders: {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    },
  },
  plugins: [nextCookies()],
});
