import { prisma } from "@/lib/prisma";
import { authorizedClientFor, deleteContestEvent } from "@/lib/google/calendar";

type RemovalResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function removeUserContest(userId: string, id: string): Promise<RemovalResult> {
  // Resolve the calendar event from an owned record, never from client input.
  const contest = await prisma.syncedContest.findFirst({ where: { id, userId } });
  if (!contest) return { ok: false, status: 404, error: "Contest not found." };
  if (contest.status === "DELETED") return { ok: true };
  if (contest.status !== "SUCCESS" || !contest.calendarEventId) {
    return { ok: false, status: 409, error: "This contest has no synced calendar event to remove." };
  }

  const credential = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!credential) {
    return { ok: false, status: 409, error: "Sign out and sign in with Google again to reconnect your calendar." };
  }

  const client = authorizedClientFor(userId, credential.encryptedRefreshToken);
  await deleteContestEvent(client, contest.calendarEventId);

  // Retain the record as an exclusion for both manual and scheduled syncs.
  // If this write fails, retrying is safe even though Google already deleted it.
  await prisma.syncedContest.update({
    where: { id, userId },
    data: { status: "DELETED", errorMessage: null },
  });
  return { ok: true };
}
