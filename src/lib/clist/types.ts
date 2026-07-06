// Shape of a contest object returned by clist.by API v4 (/api/v4/contest/).
// https://clist.by/api/v4/doc/
export interface ClistContest {
  id: number;
  event: string;
  href: string;
  start: string;
  end: string;
  duration: number;
  resource: string;
  host: string;
}

export interface ClistContestListResponse {
  meta: { total_count: number };
  objects: ClistContest[];
}
