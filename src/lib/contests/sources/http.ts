// Some of these are unofficial endpoints that 403 a request with no User-Agent.
export const USER_AGENT =
  "contest-calendar-sync/0.1 (+https://github.com/; Google Calendar contest sync)";

export async function httpGet(url: string, headers: Record<string, string> = {}, timeoutMs = 15_000) {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
}
