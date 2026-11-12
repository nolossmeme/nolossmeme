import { useState } from "react";

import { applyList, type ListResult, type ListSpec, type ListState } from "../lib/list";

export interface ListControl<T> extends ListResult<T> {
  state: ListState;
  set: (patch: Partial<ListState>) => void;
  spec: ListSpec<T>;
}

/** List state for `applyList`; any change other than the page goes back to page 1. */
export function useList<T>(all: readonly T[], spec: ListSpec<T>): ListControl<T> {
  const [state, setState] = useState<ListState>({
    query: "",
    filter: Object.keys(spec.filters ?? {})[0] ?? "",
    sort: Object.keys(spec.sorts)[0] ?? "",
    page: 1,
  });
  const set = (patch: Partial<ListState>) => setState((s) => ({ ...s, page: 1, ...patch }));
  return { ...applyList(all, spec, state), state, set, spec };
}
