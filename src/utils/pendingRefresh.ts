import { Snippet } from './snippet.ts';

export const PENDING_REFRESH_MS = 3000;

export const isPending = (snippet?: Pick<Snippet, 'compliance'> | null): boolean =>
  snippet?.compliance === 'pending';

/** Intervalo de refetch: PENDING_REFRESH_MS mientras haya algun snippet pending; false si no. */
export const pendingRefetchInterval = (
  snippets?: Pick<Snippet, 'compliance'> | Pick<Snippet, 'compliance'>[] | null,
): number | false => {
  const list = Array.isArray(snippets) ? snippets : snippets ? [snippets] : [];
  return list.some(isPending) ? PENDING_REFRESH_MS : false;
};

type QueryLike = { state: { status: string } };

/** Igual que pendingRefetchInterval, pero nunca hace polling si la query esta en error. */
export const pendingRefetchIntervalUnlessError = (
  snippets: Parameters<typeof pendingRefetchInterval>[0],
  query: QueryLike,
): number | false => (query.state.status === 'error' ? false : pendingRefetchInterval(snippets));
