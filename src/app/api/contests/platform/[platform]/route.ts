import { auth } from "@/auth";
import { removeUserPlatformContests } from "@/lib/sync/removeUserContest";
import { errorMessage } from "@/lib/util";

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
