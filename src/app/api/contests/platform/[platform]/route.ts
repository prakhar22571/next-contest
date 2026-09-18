import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { removeUserPlatformContests } from "@/lib/sync/removeUserContest";
import { clearRemovedContests, syncUserContests } from "@/lib/sync/syncUser";
import { fetchContests } from "@/lib/contests";
import { isValidPlatformSlug } from "@/lib/contests/platforms";
import { daysFromNow, errorMessage } from "@/lib/util";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to remove calendar events." }, { status: 401 });
  }

  const { platform } = await params;
  try {
    const result = await removeUserPlatformContests(session.user.id, platform);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({
      removed: result.removed,
      failed: result.failed,
      ...(result.failed > 0 && {
        error: `Removed ${result.removed} events. ${result.failed} could not be removed. Please try again. If the problem continues, sign out and sign in with Google again.`,
      }),
    }, { status: result.failed > 0 ? 207 : 200 });
  } catch (err) {
    console.error("[calendar] platform removal failed:", errorMessage(err));
    return Response.json(
      { error: "Could not finish removing these events. Please try again." },
      { status: 502 }
    );
  }
}

// Undoes a previous removal for one platform: clears its DELETED exclusion,
// then re-fetches and re-syncs just that platform so removed contests
// reappear. Requires the platform to still be selected in the preference.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to restore calendar events." }, { status: 401 });
  }

  const { platform } = await params;
  if (!isValidPlatformSlug(platform)) {
    return Response.json({ error: "Unknown contest platform." }, { status: 400 });
  }

  const userId = session.user.id;
  const pref = await prisma.userPreference.findUnique({ where: { userId } });
  if (!pref || !pref.platforms.includes(platform)) {
    return Response.json(
      { error: "Select this platform in your preferences and save first." },
      { status: 409 }
    );
  }

  try {
    await clearRemovedContests(userId, [platform]);
    const contests = await fetchContests({
      resources: [platform],
      startGte: new Date(),
      startLte: daysFromNow(pref.daysAhead),
    });
    const sync = await syncUserContests(userId, "MANUAL", contests);
    if (!sync) {
      return Response.json(
        { error: "Sign out and sign in with Google again to reconnect your calendar." },
        { status: 409 }
      );
    }
    return Response.json({
      found: sync.found,
      created: sync.created,
      failed: sync.failed,
      ...(sync.failed > 0 && {
        error: `Restored ${sync.created} of ${sync.found} events. ${sync.failed} could not be added. Please try again.`,
      }),
    }, { status: sync.failed > 0 ? 207 : 200 });
  } catch (err) {
    console.error("[calendar] platform restore failed:", errorMessage(err));
    return Response.json(
      { error: "Could not finish restoring these events. Please try again." },
      { status: 502 }
    );
  }
}
