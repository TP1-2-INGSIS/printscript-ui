import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { HttpSnippetOperations } from '../httpSnippetOperations';
import { CreateSnippet, UpdateSnippet } from '../snippet';

const BASE_URL = 'http://localhost:8080/api';
const FAKE_TOKEN = 'mock-jwt-token-xyz';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('HttpSnippetOperations - Phase 1: CRUD Operations', () => {
  const tokenProvider = vi.fn().mockResolvedValue(FAKE_TOKEN);
  const operations = new HttpSnippetOperations(BASE_URL, tokenProvider);

  it('listSnippetDescriptors maps query params and returns paginated snippets', async () => {
    let capturedAuth: string | null = null;
    let capturedUrl: string | null = null;

    server.use(
      http.get(`${BASE_URL}/snippets`, ({ request }) => {
        capturedAuth = request.headers.get('authorization');
        capturedUrl = request.url;

        return HttpResponse.json({
          items: [
            {
              id: 'snippet-1',
              name: 'Print Hello',
              language: 'printscript',
              version: '1.1',
              ownerId: 'user-ana',
              role: 'OWNER',
              lintStatus: 'COMPLIANT',
              updatedAt: '2026-11-01T10:00:00Z',
            },
            {
              id: 'snippet-2',
              name: 'Broken Script',
              language: 'printscript',
              version: '1.0',
              ownerId: 'user-juan',
              role: 'READ',
              lintStatus: 'FAILED',
              updatedAt: '2026-11-01T11:00:00Z',
            },
          ],
          page: 0,
          size: 10,
          total: 2,
        });
      }),
    );

    const result = await operations.listSnippetDescriptors(0, 10, 'Hello');

    expect(capturedAuth).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(capturedUrl).toContain('page=0');
    expect(capturedUrl).toContain('size=10');
    expect(capturedUrl).toContain('name=Hello');

    expect(result.page).toBe(0);
    expect(result.page_size).toBe(10);
    expect(result.count).toBe(2);
    expect(result.snippets).toHaveLength(2);

    expect(result.snippets[0]).toEqual({
      id: 'snippet-1',
      name: 'Print Hello',
      language: 'printscript',
      extension: 'prs',
      content: '',
      compliance: 'compliant',
      author: 'user-ana',
    });

    expect(result.snippets[1].compliance).toBe('failed');
    expect(result.snippets[1].author).toBe('user-juan');
  });

  it('fails fast when backend breaks schema contract in listSnippetDescriptors', async () => {
    server.use(
      http.get(`${BASE_URL}/snippets`, () => {
        // Backend devuelve datos corruptos o campos renombrados (ej. falta ownerId)
        return HttpResponse.json({
          items: [
            {
              id: 'snippet-broken',
              name: 'Missing Owner',
              language: 'printscript',
              // ownerId falta a propósito
            },
          ],
          page: 0,
          size: 10,
          total: 1,
        });
      }),
    );

    await expect(operations.listSnippetDescriptors()).rejects.toThrow(/Contract validation failed/);
  });

  it('getSnippetById retrieves snippet detail with content', async () => {
    server.use(
      http.get(`${BASE_URL}/snippets/snippet-123`, () => {
        return HttpResponse.json({
          id: 'snippet-123',
          name: 'Calculation',
          language: 'printscript',
          version: '1.1',
          content: 'let a: number = 5;\nprintln(a);',
          ownerId: 'user-ana',
          role: 'OWNER',
          lintStatus: 'COMPLIANT',
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-01T10:00:00Z',
        });
      }),
    );

    const snippet = await operations.getSnippetById('snippet-123');

    expect(snippet).toBeDefined();
    expect(snippet?.id).toBe('snippet-123');
    expect(snippet?.name).toBe('Calculation');
    expect(snippet?.content).toBe('let a: number = 5;\nprintln(a);');
    expect(snippet?.compliance).toBe('compliant');
  });

  it('getSnippetById returns undefined when backend responds 404', async () => {
    server.use(
      http.get(`${BASE_URL}/snippets/unknown-id`, () => {
        return new HttpResponse(JSON.stringify({ error: 'NOT_FOUND', message: 'Snippet 404' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const snippet = await operations.getSnippetById('unknown-id');
    expect(snippet).toBeUndefined();
  });

  it('createSnippet sends POST with json body and returns created snippet', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post(`${BASE_URL}/snippets`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            id: 'new-id-999',
            name: 'New Script',
            language: 'printscript',
            version: '1.1',
            content: 'println("hello world");',
            ownerId: 'user-ana',
            role: 'OWNER',
            lintStatus: 'PENDING',
          },
          { status: 201 },
        );
      }),
    );

    const createDto: CreateSnippet = {
      name: 'New Script',
      content: 'println("hello world");',
      language: 'printscript',
      extension: 'prs',
    };

    const created = await operations.createSnippet(createDto);

    expect(capturedBody).toEqual({
      name: 'New Script',
      content: 'println("hello world");',
      language: 'printscript',
      version: '1.1',
    });

    expect(created.id).toBe('new-id-999');
    expect(created.name).toBe('New Script');
    expect(created.content).toBe('println("hello world");');
    expect(created.compliance).toBe('pending');
  });

  it('updateSnippetById sends PUT /snippets/{id} with new content', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.put(`${BASE_URL}/snippets/snippet-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: 'snippet-1',
          name: 'Print Hello',
          language: 'printscript',
          version: '1.1',
          content: 'println("updated content");',
          ownerId: 'user-ana',
          role: 'OWNER',
          lintStatus: 'COMPLIANT',
        });
      }),
    );

    const updateDto: UpdateSnippet = {
      content: 'println("updated content");',
    };

    const updated = await operations.updateSnippetById('snippet-1', updateDto);

    expect(capturedBody).toEqual({
      content: 'println("updated content");',
    });
    expect(updated.id).toBe('snippet-1');
    expect(updated.content).toBe('println("updated content");');
  });

  it('deleteSnippet sends DELETE /snippets/{id} and returns id', async () => {
    let deleted = false;

    server.use(
      http.delete(`${BASE_URL}/snippets/snippet-to-delete`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const result = await operations.deleteSnippet('snippet-to-delete');

    expect(deleted).toBe(true);
    expect(result).toBe('snippet-to-delete');
  });

  it('throws descriptive error when server responds 500', async () => {
    server.use(
      http.get(`${BASE_URL}/snippets`, () => {
        return HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 });
      }),
    );

    await expect(operations.listSnippetDescriptors()).rejects.toThrow('Internal Server Error');
  });
});
