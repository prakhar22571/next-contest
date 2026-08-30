// Shared fetch wrapper for the platform sources: consistent User-Agent (some of
// these are unofficial endpoints that 403 without one), timeout, and a thrown
// error on non-2xx so each source doesn't repeat that check.
const USER_AGENT = "contest-calendar-sync (+https://github.com/prakhar22571/next-contest)";
const TIMEOUT_MS = 15_000;

async function request(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, ...init?.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res;
}

export const fetchJson = <T>(url: string, init?: RequestInit): Promise<T> =>
  request(url, { ...init, headers: { Accept: "application/json", ...init?.headers } }).then(
    (r) => r.json() as Promise<T>
  );

export const fetchText = (url: string, init?: RequestInit): Promise<string> =>
  request(url, { ...init, headers: { Accept: "text/html", ...init?.headers } }).then((r) =>
    r.text()
  );
