import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { errorMessage } from "@/lib/util";
import { platformName } from "@/lib/contests/platforms";
import type { Contest } from "@/lib/contests/types";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

// Builds an OAuth client from an already-loaded credential. `googleapis`
// auto-refreshes the access token on demand; we persist whatever it hands back
// so the cached token stays warm (best-effort - a failed write must not break
// the calendar call in progress).
export function authorizedClientFor(userId: string, encryptedRefreshToken: string): OAuth2Client {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: decrypt(encryptedRefreshToken) });

  client.on("tokens", (tokens) => {
    prisma.googleCredential
      .update({
        where: { userId },
        data: {
          ...(tokens.access_token && { encryptedAccessToken: encrypt(tokens.access_token) }),
          ...(tokens.expiry_date && { accessTokenExpiresAt: new Date(tokens.expiry_date) }),
          ...(tokens.refresh_token && { encryptedRefreshToken: encrypt(tokens.refresh_token) }),
        },
      })
      .catch((err) => console.error("[calendar] token persist failed:", errorMessage(err)));
  });

  return client;
}

export async function createContestEvent(auth: OAuth2Client, contest: Contest, timeZone: string) {
  const name = platformName(contest.resource);
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `${contest.event} (${name})`,
      description: `Platform: ${name}\nContest link: ${contest.href}`,
      start: { dateTime: contest.start, timeZone },
      end: { dateTime: contest.end, timeZone },
      source: { title: name, url: contest.href },
      extendedProperties: { private: { contestId: contest.id, platform: contest.resource } },
      reminders: { useDefault: true },
    },
  });
  return res.data;
}

export async function deleteContestEvent(auth: OAuth2Client, eventId: string) {
  const calendar = google.calendar({ version: "v3", auth });
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (err) {
    // An event already removed in Google Calendar needs no further deletion.
    // Other failures must leave the local record available for a retry.
    const status = (err as { response?: { status?: number } } | null)?.response?.status;
    if (status !== 404 && status !== 410) throw err;
  }
}
