import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { SnippetExecution, SnippetExecutionHandle } from './SnippetExecution';

const getToken = vi.fn();
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently: getToken }),
}));

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

const setup = () => {
  const ref = createRef<SnippetExecutionHandle>();
  const view = render(<SnippetExecution ref={ref} snippetId="s1" />);
  return { ref, ...view };
};
const run = (ref: React.RefObject<SnippetExecutionHandle>) =>
  act(async () => {
    await ref.current!.run();
  });
const input = () => screen.getByRole('textbox') as HTMLInputElement;

describe('SnippetExecution', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    getToken.mockReset().mockResolvedValue('tok');
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the socket with the right URL', async () => {
    const { ref } = setup();
    await run(ref);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toMatch(/\/snippets\/s1\/run\?access_token=tok$/);
    expect(FakeWebSocket.instances[0].url).toMatch(/^wss?:\/\//);
  });

  it('appends outputs and enables input only after input-request', async () => {
    const { ref } = setup();
    await run(ref);
    const ws = FakeWebSocket.instances[0];
    act(() => ws.open());
    act(() => ws.receive({ type: 'output', value: 'hello' }));
    act(() => ws.receive({ type: 'output', value: 'world' }));
    expect(screen.getByTestId('execution-output').textContent).toBe('hello\nworld');
    expect(input().disabled).toBe(true);

    act(() => ws.receive({ type: 'input-request', prompt: 'name?' }));
    expect(input().disabled).toBe(false);
    fireEvent.change(input(), { target: { value: 'bob' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(ws.sent).toEqual(['{"type":"input","value":"bob"}']);
    expect(input().disabled).toBe(true);
  });

  it('shows errors with line and column and closes the socket', async () => {
    const { ref } = setup();
    await run(ref);
    const ws = FakeWebSocket.instances[0];
    act(() => ws.open());
    act(() => ws.receive({ type: 'error', message: 'boom', line: 3, column: 4 }));
    expect(screen.getByText('boom (line 3, col 4)')).toBeTruthy();
    expect(ws.closed).toBe(true);
  });

  it('stop sends stop and closes', async () => {
    const { ref } = setup();
    await run(ref);
    const ws = FakeWebSocket.instances[0];
    act(() => ws.open());
    act(() => ref.current!.stop());
    expect(ws.sent).toEqual(['{"type":"stop"}']);
    expect(ws.closed).toBe(true);
  });

  it('stop while the token is pending creates no socket', async () => {
    let resolve!: (t: string) => void;
    getToken.mockReturnValue(new Promise<string>((r) => (resolve = r)));
    const { ref } = setup();
    let pending!: Promise<void>;
    act(() => {
      pending = ref.current!.run();
    });
    act(() => ref.current!.stop());
    await act(async () => {
      resolve('tok');
      await pending;
    });
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('a double run creates only one socket', async () => {
    const { ref } = setup();
    await act(async () => {
      await Promise.all([ref.current!.run(), ref.current!.run()]);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('unmount closes the socket and prevents pending sockets', async () => {
    const { ref, unmount } = setup();
    await run(ref);
    const ws = FakeWebSocket.instances[0];
    unmount();
    expect(ws.closed).toBe(true);

    let resolve!: (t: string) => void;
    getToken.mockReturnValue(new Promise<string>((r) => (resolve = r)));
    const second = setup();
    let pending!: Promise<void>;
    act(() => {
      pending = second.ref.current!.run();
    });
    second.unmount();
    await act(async () => {
      resolve('tok');
      await pending;
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('can run again after finished', async () => {
    const { ref } = setup();
    await run(ref);
    const first = FakeWebSocket.instances[0];
    act(() => first.open());
    act(() => first.receive({ type: 'output', value: 'a' }));
    act(() => first.receive({ type: 'finished' }));
    expect(screen.getByText('Execution finished')).toBeTruthy();
    expect(first.closed).toBe(true);

    await run(ref);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(screen.getByTestId('execution-output').textContent).toBe('');
  });
});
