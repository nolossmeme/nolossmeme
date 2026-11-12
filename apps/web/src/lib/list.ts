/** Client-side search, filter, sort and pagination for lists the app already holds in memory. */
export interface ListSpec<T> {
  /** Text a query is matched against (case-insensitive substring). */
  text?: (row: T) => string;
  /** Filter label → predicate. The first entry is the default. */
  filters?: Record<string, (row: T) => boolean>;
  /** Sort label → comparator. The first entry is the default. */
  sorts: Record<string, (a: T, b: T) => number>;
  pageSize: number;
}

export interface ListState {
  query: string;
  filter: string;
  sort: string;
  page: number;
}

export interface ListResult<T> {
  rows: T[];
  /** Rows left after search and filter. */
  total: number;
  pages: number;
  /** The page actually shown (clamped to the last page). */
  page: number;
}

export function applyList<T>(all: readonly T[], spec: ListSpec<T>, s: ListState): ListResult<T> {
  const q = s.query.trim().toLowerCase();
  const keep = spec.filters?.[s.filter];
  const cmp = spec.sorts[s.sort] ?? Object.values(spec.sorts)[0];
  const rows = all.filter(
    (r) => (!keep || keep(r)) && (!q || !spec.text || spec.text(r).toLowerCase().includes(q)),
  );
  if (cmp) rows.sort(cmp);
  const pages = Math.max(1, Math.ceil(rows.length / spec.pageSize));
  const page = Math.min(Math.max(1, s.page), pages);
  const start = (page - 1) * spec.pageSize;
  return { rows: rows.slice(start, start + spec.pageSize), total: rows.length, pages, page };
}

/** Comparator helpers. */
export const by =
  <T>(key: (row: T) => number | bigint | string, dir: 1 | -1 = 1) =>
  (a: T, b: T): number => {
    const x = key(a);
    const y = key(b);
    if (x === y) return 0;
    return (x < y ? -1 : 1) * dir;
  };
