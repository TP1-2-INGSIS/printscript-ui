export type ServerMessage =
  | { type: 'output'; value: string }
  | { type: 'input-request'; prompt: string }
  | { type: 'finished' }
  | { type: 'error'; message: string; line?: number; column?: number };

export type ClientMessage = { type: 'input'; value: string } | { type: 'stop' };

/**
 * Builds the execution WebSocket URL from the backend base URL.
 * Relative bases (e.g. "/api") use the page location; absolute http(s) bases swap the scheme.
 */
export const buildExecutionUrl = (
  backendUrl: string,
  snippetId: string,
  token: string,
  pageLocation: { protocol: string; host: string } = window.location,
): string => {
  const base = backendUrl.replace(/\/+$/, '');
  let origin: string;
  if (/^https?:\/\//i.test(base)) {
    origin = base.replace(/^http/i, 'ws');
  } else {
    const scheme = pageLocation.protocol === 'https:' ? 'wss:' : 'ws:';
    origin = `${scheme}//${pageLocation.host}${base.startsWith('/') ? '' : '/'}${base}`;
  }
  return `${origin}/snippets/${encodeURIComponent(snippetId)}/run?access_token=${encodeURIComponent(token)}`;
};

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Parses and validates a raw WebSocket payload. Returns null when invalid. */
export const parseServerMessage = (raw: unknown): ServerMessage | null => {
  if (typeof raw !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;
  switch (msg.type) {
    case 'output':
      return typeof msg.value === 'string' ? { type: 'output', value: msg.value } : null;
    case 'input-request':
      return { type: 'input-request', prompt: typeof msg.prompt === 'string' ? msg.prompt : '' };
    case 'finished':
      return { type: 'finished' };
    case 'error':
      if (typeof msg.message !== 'string') return null;
      return {
        type: 'error',
        message: msg.message,
        line: optionalNumber(msg.line),
        column: optionalNumber(msg.column),
      };
    default:
      return null;
  }
};

export const serializeClientMessage = (message: ClientMessage): string => JSON.stringify(message);

export const formatExecutionError = (error: Extract<ServerMessage, { type: 'error' }>): string => {
  const location =
    error.line != null
      ? ` (line ${error.line}${error.column != null ? `, col ${error.column}` : ''})`
      : '';
  return `${error.message}${location}`;
};
