import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    // Runs on every sign-in (unlike events.linkAccount, which only fires once
    // per account link). Because we request prompt=consent, Google re-issues
    // tokens on every login, so this is the reliable place to capture them -
    // the cron job depends on GoogleCredential always being up to date.
    async signIn({ user, account }) {
      if (account?.provider === "google" && account.refresh_token && user.id) {
        await prisma.googleCredential.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            encryptedRefreshToken: encrypt(account.refresh_token),
            encryptedAccessToken: account.access_token ? encrypt(account.access_token) : null,
            accessTokenExpiresAt: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
            scope: account.scope ?? "",
          },
          update: {
            encryptedRefreshToken: encrypt(account.refresh_token),
            encryptedAccessToken: account.access_token ? encrypt(account.access_token) : null,
            accessTokenExpiresAt: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
            scope: account.scope ?? "",
          },
        });
      }
      return true;
    },
  },
});
