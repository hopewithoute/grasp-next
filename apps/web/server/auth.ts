import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createDbClient, schema } from "@grasp/db";
import { serverEnv } from "./env";

export const auth = betterAuth({
  database: drizzleAdapter(createDbClient(serverEnv.DATABASE_URL), {
    provider: "pg",
    schema,
  }),
  socialProviders: {
    google: {
      clientId: serverEnv.GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [nextCookies()],
});
