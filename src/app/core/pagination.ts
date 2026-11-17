/** Page size used by every offset-paginated screen. */
export const PAGE_SIZE = 20;

/**
 * The list endpoints return rows only, so a page is fetched with
 * `pageSize + 1` rows: the extra row reveals whether "next" exists without a
 * separate count query.
 */
export function withHasMore<T>(rows: T[], pageSize: number): { rows: T[]; hasMore: boolean } {
  return {
    rows: rows.slice(0, pageSize),
    hasMore: rows.length > pageSize,
  };
}
