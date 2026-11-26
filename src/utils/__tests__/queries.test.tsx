import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import React from 'react';
import { useGetSnippets, useGetSnippetById } from '../queries';
import { HttpSnippetOperations } from '../httpSnippetOperations';
import { PENDING_REFRESH_MS, pendingRefetchIntervalUnlessError } from '../pendingRefresh';
import { Snippet } from '../snippet';

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently: vi.fn() }),
}));

const snip = (compliance: Snippet['compliance']) => ({ id: '1', compliance }) as Snippet;
const page = (compliance: Snippet['compliance']) => ({
  page: 0,
  page_size: 10,
  count: 1,
  snippets: [snip(compliance)],
});

const wrapperFor = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

const flush = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe('pending polling', () => {
  let client: QueryClient;
  beforeEach(() => {
    vi.useFakeTimers();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    client.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('list polls while pending and stops once none is pending', async () => {
    const spy = vi
      .spyOn(HttpSnippetOperations.prototype, 'listSnippetDescriptors')
      .mockResolvedValueOnce(page('pending') as never)
      .mockResolvedValue(page('compliant') as never);
    renderHook(() => useGetSnippets(0, 10), { wrapper: wrapperFor(client) });
    await flush(0);
    expect(spy).toHaveBeenCalledTimes(1);
    await flush(PENDING_REFRESH_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    await flush(PENDING_REFRESH_MS * 3);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('list stops polling when the query errors', async () => {
    const spy = vi
      .spyOn(HttpSnippetOperations.prototype, 'listSnippetDescriptors')
      .mockResolvedValueOnce(page('pending') as never)
      .mockRejectedValue(new Error('boom'));
    renderHook(() => useGetSnippets(0, 10), { wrapper: wrapperFor(client) });
    await flush(0);
    await flush(PENDING_REFRESH_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    await flush(PENDING_REFRESH_MS * 3);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('detail polls while pending and stops when compliant', async () => {
    const spy = vi
      .spyOn(HttpSnippetOperations.prototype, 'getSnippetById')
      .mockResolvedValueOnce(snip('pending'))
      .mockResolvedValue(snip('compliant'));
    renderHook(() => useGetSnippetById('1'), { wrapper: wrapperFor(client) });
    await flush(0);
    await flush(PENDING_REFRESH_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    await flush(PENDING_REFRESH_MS * 3);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('decision helper returns false on error even if pending', () => {
    expect(
      pendingRefetchIntervalUnlessError([snip('pending')], { state: { status: 'error' } }),
    ).toBe(false);
    expect(
      pendingRefetchIntervalUnlessError([snip('pending')], { state: { status: 'success' } }),
    ).toBe(PENDING_REFRESH_MS);
  });
});
