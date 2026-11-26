import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, OutlinedInput } from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';
import { Bòx } from '../components/snippet-table/SnippetBox.tsx';
import { BACKEND_URL } from '../utils/constants.ts';
import {
  buildExecutionUrl,
  formatExecutionError,
  parseServerMessage,
  serializeClientMessage,
  ClientMessage,
} from '../utils/execution.ts';

export type ExecutionStatus = 'idle' | 'connecting' | 'running' | 'finished' | 'error';

export type SnippetExecutionHandle = { run: () => Promise<void>; stop: () => void };

type Props = {
  snippetId: string;
  onStatusChange?: (status: ExecutionStatus) => void;
};

export const SnippetExecution = forwardRef<SnippetExecutionHandle, Props>(
  ({ snippetId, onStatusChange }, ref) => {
    const { getAccessTokenSilently } = useAuth0();
    const [input, setInput] = useState('');
    const [output, setOutput] = useState<string[]>([]);
    const [prompt, setPrompt] = useState<string | null>(null);
    const [status, setStatus] = useState<ExecutionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const runIdRef = useRef(0);
    const statusRef = useRef<ExecutionStatus>('idle');

    const updateStatus = (next: ExecutionStatus) => {
      statusRef.current = next;
      setStatus(next);
      onStatusChange?.(next);
    };

    const detach = (socket: WebSocket) => {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
    };

    const closeSocket = () => {
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        detach(socket);
        socket.close();
      }
    };

    useEffect(
      () => () => {
        runIdRef.current++;
        closeSocket();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    const send = (message: ClientMessage) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(serializeClientMessage(message));
      }
    };

    const run = async () => {
      if (statusRef.current === 'connecting' || statusRef.current === 'running') return;
      const id = ++runIdRef.current;
      closeSocket();
      setOutput([]);
      setError(null);
      setPrompt(null);
      setInput('');
      updateStatus('connecting');
      try {
        const token = await getAccessTokenSilently();
        if (id !== runIdRef.current) return;
        const socket = new WebSocket(buildExecutionUrl(BACKEND_URL, snippetId, token));
        socketRef.current = socket;
        socket.onopen = () => updateStatus('running');
        socket.onmessage = (event) => {
          const message = parseServerMessage(event.data);
          if (!message) return;
          switch (message.type) {
            case 'output':
              setOutput((prev) => [...prev, message.value]);
              break;
            case 'input-request':
              setPrompt(message.prompt || 'Input required');
              break;
            case 'finished':
              setPrompt(null);
              updateStatus('finished');
              socket.close();
              break;
            case 'error':
              setPrompt(null);
              setError(formatExecutionError(message));
              updateStatus('error');
              socket.close();
              break;
          }
        };
        socket.onerror = () => {
          setError('Connection error');
          setPrompt(null);
          updateStatus('error');
        };
        socket.onclose = () => {
          socketRef.current = null;
          setPrompt(null);
          if (statusRef.current === 'running' || statusRef.current === 'connecting') {
            updateStatus('finished');
          }
        };
      } catch (e) {
        if (id !== runIdRef.current) return;
        setError(e instanceof Error ? e.message : 'Could not start execution');
        updateStatus('error');
      }
    };

    const stop = () => {
      runIdRef.current++;
      send({ type: 'stop' });
      closeSocket();
      setPrompt(null);
      updateStatus('idle');
    };

    useImperativeHandle(ref, () => ({ run, stop }));

    const submitInput = () => {
      if (prompt === null) return;
      send({ type: 'input', value: input });
      setOutput((prev) => [...prev, `> ${input}`]);
      setInput('');
      setPrompt(null);
    };

    const code = output.join('\n');

    return (
      <>
        <Bòx
          flex={1}
          overflow={'none'}
          minHeight={200}
          bgcolor={'black'}
          color={'white'}
          code={code}
        >
          <pre
            data-testid="execution-output"
            style={{
              margin: 0,
              padding: 10,
              fontFamily: 'monospace',
              fontSize: 17,
              whiteSpace: 'pre-wrap',
            }}
          >
            {code}
          </pre>
        </Bòx>
        {error && <Alert severity="error">{error}</Alert>}
        {status === 'finished' && <Alert severity="success">Execution finished</Alert>}
        <OutlinedInput
          onKeyDown={(event) => event.key === 'Enter' && submitInput()}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={prompt ?? 'Type here'}
          disabled={prompt === null}
          fullWidth
        />
      </>
    );
  },
);
SnippetExecution.displayName = 'SnippetExecution';
