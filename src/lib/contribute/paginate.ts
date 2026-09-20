/**
 * Contribute lists knowledge-gap places in short pages so the
 * "something we're missing" action stays on screen.
 */
export const TASKS_PER_PAGE = 5;

export function pageCount(total: number, pageSize = TASKS_PER_PAGE): number {
  if (total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

export function clampPage(page: number, total: number, pageSize = TASKS_PER_PAGE): number {
  const last = pageCount(total, pageSize);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.trunc(page), last);
}

export function pageSlice<T>(items: T[], page: number, pageSize = TASKS_PER_PAGE): T[] {
  const current = clampPage(page, items.length, pageSize);
  const start = (current - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function pageRange(
  page: number,
  total: number,
  pageSize = TASKS_PER_PAGE,
): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: 0 };
  const current = clampPage(page, total, pageSize);
  return {
    start: (current - 1) * pageSize + 1,
    end: Math.min(current * pageSize, total),
  };
}

/** 0-based index → 1-based page. */
export function pageOf(index: number, pageSize = TASKS_PER_PAGE): number {
  if (index < 0) return 1;
  return Math.floor(index / pageSize) + 1;
}

/** Read a 1-based page out of a search-param value. Out-of-range is the caller's job. */
export function pageFromParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === "") return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 1;
}
