import { describe, expect, it } from "vitest";

import { applyList, by } from "../lib/list";

const rows = Array.from({ length: 25 }, (_, i) => ({ n: i + 1, name: i % 2 ? "odd" : "even" }));
const spec = {
  text: (r: (typeof rows)[number]) => r.name,
  filters: { All: () => true, Big: (r: (typeof rows)[number]) => r.n > 20 },
  sorts: {
    Desc: by((r: (typeof rows)[number]) => r.n, -1),
    Asc: by((r: (typeof rows)[number]) => r.n),
  },
  pageSize: 10,
};

describe("applyList", () => {
  it("sorts with the default comparator and pages", () => {
    const r = applyList(rows, spec, { query: "", filter: "All", sort: "Desc", page: 3 });
    expect(r).toMatchObject({ total: 25, pages: 3, page: 3 });
    expect(r.rows.map((x) => x.n)).toEqual([5, 4, 3, 2, 1]);
  });

  it("searches, filters and clamps the page", () => {
    const r = applyList(rows, spec, { query: "ODD", filter: "Big", sort: "Asc", page: 9 });
    expect(r.rows.map((x) => x.n)).toEqual([22, 24]);
    expect(r).toMatchObject({ total: 2, pages: 1, page: 1 });
  });
});
