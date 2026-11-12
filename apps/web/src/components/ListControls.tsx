import type { ListControl } from "../hooks/useList";

/** Search box, filter tabs and sort select above a list. */
export function ListToolbar<T>({
  ctl,
  placeholder = "Search",
  label,
}: {
  ctl: ListControl<T>;
  placeholder?: string;
  /** Names the list for screen readers, e.g. "draws". */
  label: string;
}) {
  const filters = Object.keys(ctl.spec.filters ?? {});
  const sorts = Object.keys(ctl.spec.sorts);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {ctl.spec.text && (
        <input
          type="search"
          className="input max-w-xs py-2"
          placeholder={placeholder}
          aria-label={`Search ${label}`}
          value={ctl.state.query}
          onChange={(e) => ctl.set({ query: e.target.value })}
        />
      )}
      {filters.length > 1 && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={`Filter ${label}`}>
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={ctl.state.filter === f}
              className={`tab ${ctl.state.filter === f ? "tab-active" : ""}`}
              onClick={() => ctl.set({ filter: f })}
            >
              {f}
            </button>
          ))}
        </div>
      )}
      {sorts.length > 1 && (
        <select
          className="input ml-auto w-auto py-2"
          aria-label={`Sort ${label}`}
          value={ctl.state.sort}
          onChange={(e) => ctl.set({ sort: e.target.value })}
        >
          {sorts.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** "1–10 of 64" with previous / next; hidden when everything fits on one page. */
export function Pager<T>({ ctl }: { ctl: ListControl<T> }) {
  if (ctl.pages <= 1) return null;
  const size = ctl.spec.pageSize;
  const from = (ctl.page - 1) * size + 1;
  const to = Math.min(ctl.total, ctl.page * size);
  return (
    <nav className="mt-3 flex items-center justify-between text-sm" aria-label="Pages">
      <span className="text-muted">
        {from}–{to} of {ctl.total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary px-3 py-1.5"
          disabled={ctl.page <= 1}
          onClick={() => ctl.set({ page: ctl.page - 1 })}
        >
          ← Prev
        </button>
        <span className="font-mono text-muted">
          {ctl.page} / {ctl.pages}
        </span>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5"
          disabled={ctl.page >= ctl.pages}
          onClick={() => ctl.set({ page: ctl.page + 1 })}
        >
          Next →
        </button>
      </div>
    </nav>
  );
}

/** Shown when search or filter leaves nothing. */
export function NoMatch<T>({ ctl }: { ctl: ListControl<T> }) {
  if (ctl.total > 0) return null;
  return <p className="py-4 text-sm text-muted">Nothing matches.</p>;
}
