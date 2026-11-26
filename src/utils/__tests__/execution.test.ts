import { describe, it, expect } from 'vitest';
import {
  buildExecutionUrl,
  formatExecutionError,
  parseServerMessage,
  serializeClientMessage,
} from '../execution';

const https = { protocol: 'https:', host: 'app.example.com' };
const http = { protocol: 'http:', host: 'localhost:5173' };

describe('buildExecutionUrl', () => {
  it('uses wss on the page host for relative /api under https', () => {
    expect(buildExecutionUrl('/api', 's1', 'tok', https)).toBe(
      'wss://app.example.com/api/snippets/s1/run?access_token=tok',
    );
  });
  it('uses ws for relative /api under http', () => {
    expect(buildExecutionUrl('/api/', 's1', 'tok', http)).toBe(
      'ws://localhost:5173/api/snippets/s1/run?access_token=tok',
    );
  });
  it('swaps the scheme for absolute urls', () => {
    expect(buildExecutionUrl('http://localhost:8080/api', 's1', 'a b', http)).toBe(
      'ws://localhost:8080/api/snippets/s1/run?access_token=a%20b',
    );
    expect(buildExecutionUrl('https://x.org/api', 's1', 't', http)).toBe(
      'wss://x.org/api/snippets/s1/run?access_token=t',
    );
  });
});

describe('parseServerMessage', () => {
  it('parses valid messages', () => {
    expect(parseServerMessage('{"type":"output","value":"hi"}')).toEqual({
      type: 'output',
      value: 'hi',
    });
    expect(parseServerMessage('{"type":"input-request","prompt":"name?"}')).toEqual({
      type: 'input-request',
      prompt: 'name?',
    });
    expect(parseServerMessage('{"type":"input-request"}')).toEqual({
      type: 'input-request',
      prompt: '',
    });
    expect(parseServerMessage('{"type":"finished"}')).toEqual({ type: 'finished' });
    expect(parseServerMessage('{"type":"error","message":"bad","line":2,"column":3}')).toEqual({
      type: 'error',
      message: 'bad',
      line: 2,
      column: 3,
    });
    expect(parseServerMessage('{"type":"error","message":"bad","line":"x"}')).toEqual({
      type: 'error',
      message: 'bad',
      line: undefined,
      column: undefined,
    });
  });
  it('rejects invalid payloads', () => {
    expect(parseServerMessage(5)).toBeNull();
    expect(parseServerMessage('nope')).toBeNull();
    expect(parseServerMessage('null')).toBeNull();
    expect(parseServerMessage('{"type":"output"}')).toBeNull();
    expect(parseServerMessage('{"type":"error"}')).toBeNull();
    expect(parseServerMessage('{"type":"unknown"}')).toBeNull();
  });
});

describe('client messages and error formatting', () => {
  it('serializes', () => {
    expect(serializeClientMessage({ type: 'stop' })).toBe('{"type":"stop"}');
    expect(serializeClientMessage({ type: 'input', value: 'x' })).toBe(
      '{"type":"input","value":"x"}',
    );
  });
  it('formats errors with location', () => {
    expect(formatExecutionError({ type: 'error', message: 'm', line: 1, column: 2 })).toBe(
      'm (line 1, col 2)',
    );
    expect(formatExecutionError({ type: 'error', message: 'm', line: 1 })).toBe('m (line 1)');
    expect(formatExecutionError({ type: 'error', message: 'm' })).toBe('m');
  });
});
