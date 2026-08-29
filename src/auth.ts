import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  events: {
    // Runs on every sign-in, *after* the adapter has persisted the User and
    // Account rows - unlike the `signIn` callback, which for a brand-new user
    // fires before createUser and would violate GoogleCredential's FK to User.
    // Because we request prompt=consent, Google re-issues tokens on every
    // login, so this keeps GoogleCredential up to date for the cron job.
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !account.refresh_token || !user.id) return;

      const data = {
        encryptedRefreshToken: encrypt(account.refresh_token),
        encryptedAccessToken: account.access_token ? encrypt(account.access_token) : null,
        accessTokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
        scope: account.scope ?? "",
      };

      try {
        await prisma.googleCredential.upsert({
          where: { userId: user.id },
          create: { userId: user.id, ...data },
          update: data,
        });
      } catch (err) {
        // Don't fail the login over this - the user can still use the app;
        // background sync just won't run until credentials are captured.
        console.error("[auth] failed to persist GoogleCredential", err);
      }
    },
  },
});
