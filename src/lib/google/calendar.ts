import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import type { ClistContest } from "@/lib/clist/types";

export async function getAuthorizedClient(userId: string) {
  const cred = await prisma.googleCredential.findUniqueOrThrow({ where: { userId } });
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: decrypt(cred.encryptedRefreshToken) });

  // googleapis auto-refreshes the access token on demand using the refresh
  // token; persist whatever it hands back so the cached access token stays warm.
  oauth2Client.on("tokens", async (tokens) => {
    await prisma.googleCredential.update({
      where: { userId },
      data: {
        ...(tokens.access_token ? { encryptedAccessToken: encrypt(tokens.access_token) } : {}),
        ...(tokens.expiry_date ? { accessTokenExpiresAt: new Date(tokens.expiry_date) } : {}),
        ...(tokens.refresh_token ? { encryptedRefreshToken: encrypt(tokens.refresh_token) } : {}),
      },
    });
  });

  return oauth2Client;
}

export async function createContestEvent(
  auth: InstanceType<typeof google.auth.OAuth2>,
  contest: ClistContest,
  platformName: string,
  timeZone: string
) {
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `${contest.event} (${platformName})`,
      description: `Platform: ${platformName}\nContest link: ${contest.href}`,
      start: { dateTime: contest.start, timeZone },
      end: { dateTime: contest.end, timeZone },
      source: { title: platformName, url: contest.href },
      extendedProperties: {
        private: { clistContestId: String(contest.id), platform: contest.resource },
      },
      reminders: { useDefault: true },
    },
  });
  return res.data;
}
