import type { Contest } from "../types";
import { httpGet } from "./http";

const RESOURCE = "atcoder.jp";

// AtCoder has no public contest API and the common Kenkoooo mirror only carries
// finished contests, so the upcoming list is scraped from the contests page.
// The "Upcoming Contests" table is plain server-rendered HTML:
//   <time class='fixtime fixtime-full'>2026-08-29 21:00:00+0900</time>
//   ... <a href="/contests/abc473">AtCoder Beginner Contest 473</a>
//   ... <td class="text-center">01:40</td>   (duration HH:MM)
const ROW_RE =
  /<time[^>]*>([^<]+)<\/time>[\s\S]*?<a href="\/contests\/([^"]+)">([^<]+)<\/a>[\s\S]*?<td class="text-center">(\d{1,4}):(\d{2})<\/td>/g;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function fetchAtCoder(): Promise<Contest[]> {
  const res = await httpGet("https://atcoder.jp/contests/?lang=en", {
    Accept: "text/html",
  });
  if (!res.ok) throw new Error(`AtCoder contests page returned ${res.status}`);

  const html = await res.text();
  const tableStart = html.indexOf('id="contest-table-upcoming"');
  if (tableStart === -1) {
    throw new Error("AtCoder contests page: upcoming table not found (layout changed?)");
  }
  const section = html.slice(tableStart, html.indexOf("</table>", tableStart));

  const contests: Contest[] = [];
  for (const m of section.matchAll(ROW_RE)) {
    const [, rawTime, slug, name, hh, mm] = m;
    // "2026-08-29 21:00:00+0900" -> "2026-08-29T21:00:00+09:00"
    const iso = rawTime.trim().replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
    const start = new Date(iso);
    if (Number.isNaN(start.getTime())) continue;
    const end = new Date(start.getTime() + (Number(hh) * 60 + Number(mm)) * 60_000);

    contests.push({
      id: `${RESOURCE}:${slug}`,
      resource: RESOURCE,
      event: decodeEntities(name).trim(),
      href: `https://atcoder.jp/contests/${slug}`,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }
  return contests;
}
