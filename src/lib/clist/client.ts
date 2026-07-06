import type { ClistContest, ClistContestListResponse } from "./types";

const BASE_URL = "https://clist.by/api/v4/contest/";
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 250;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 2000;

interface FetchContestsParams {
  resources: string[];
  startGte: Date;
  startLte: Date;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: URL): Promise<ClistContestListResponse> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_BACKOFF_MS * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      throw new Error(`clist.by request failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as ClistContestListResponse;
  }
}

// Verified against clist.by's tastypie-style v4 API conventions: username/api_key
// query auth, `field__operator` filters (resource__in, start__gte/__lte), and a
// { meta: { total_count }, objects: [...] } paginated response shape. Re-check
// against https://clist.by/api/v4/doc/ once real API credentials are available -
// the docs are only browsable when authenticated.
export async function fetchContests({
  resources,
  startGte,
  startLte,
}: FetchContestsParams): Promise<ClistContest[]> {
  const username = process.env.CLIST_USERNAME;
  const apiKey = process.env.CLIST_API_KEY;
  if (!username || !apiKey) {
    throw new Error("CLIST_USERNAME/CLIST_API_KEY environment variables are not set");
  }
  if (resources.length === 0) return [];

  const results: ClistContest[] = [];
  let offset = 0;

  while (true) {
    const url = new URL(BASE_URL);
    url.searchParams.set("username", username);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("resource__in", resources.join(","));
    url.searchParams.set("start__gte", startGte.toISOString());
    url.searchParams.set("start__lte", startLte.toISOString());
    url.searchParams.set("order_by", "start");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const json = await fetchWithRetry(url);
    results.push(...json.objects);

    offset += PAGE_SIZE;
    if (json.objects.length === 0 || offset >= json.meta.total_count) break;
    await sleep(PAGE_DELAY_MS);
  }

  return results;
}
