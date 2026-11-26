import { describe, it, expect } from 'vitest';
import { pendingRefetchInterval, PENDING_REFRESH_MS } from '../pendingRefresh';

describe('pendingRefetchInterval', () => {
  it('polls while any snippet in the list is pending', () => {
    expect(pendingRefetchInterval([{ compliance: 'compliant' }, { compliance: 'pending' }])).toBe(
      PENDING_REFRESH_MS,
    );
  });
  it('stops when none is pending', () => {
    expect(pendingRefetchInterval([{ compliance: 'failed' }])).toBe(false);
    expect(pendingRefetchInterval([])).toBe(false);
  });
  it('handles a single snippet and missing data', () => {
    expect(pendingRefetchInterval({ compliance: 'pending' })).toBe(PENDING_REFRESH_MS);
    expect(pendingRefetchInterval({ compliance: 'compliant' })).toBe(false);
    expect(pendingRefetchInterval(undefined)).toBe(false);
    expect(pendingRefetchInterval(null)).toBe(false);
  });
});
