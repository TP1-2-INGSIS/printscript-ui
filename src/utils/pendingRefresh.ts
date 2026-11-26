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
