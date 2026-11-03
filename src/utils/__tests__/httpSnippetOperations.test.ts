import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { HttpSnippetOperations, HttpError, triggerBlobDownload } from '../httpSnippetOperations';
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

  it('listSnippetDescriptors maps filter options to query params', async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get(`${BASE_URL}/snippets`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          items: [],
          page: 1,
          size: 20,
          total: 0,
        });
      }),
    );

    await operations.listSnippetDescriptors(1, 20, {
      name: 'fibonacci',
      relation: 'OWNED',
      language: 'printscript',
      lintStatus: 'COMPLIANT',
      sort: 'updatedAt',
      order: 'desc',
    });

    expect(capturedUrl).toContain('page=1');
    expect(capturedUrl).toContain('size=20');
    expect(capturedUrl).toContain('name=fibonacci');
    expect(capturedUrl).toContain('relation=OWNED');
    expect(capturedUrl).toContain('language=printscript');
    expect(capturedUrl).toContain('lintStatus=COMPLIANT');
    expect(capturedUrl).toContain('sort=updatedAt');
    expect(capturedUrl).toContain('order=desc');
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
    expect(snippet?.lintViolations).toEqual([]);
  });

  it('getSnippetById maps description and lintViolations correctly', async () => {
    server.use(
      http.get(`${BASE_URL}/snippets/snippet-with-violations`, () => {
        return HttpResponse.json({
          id: 'snippet-with-violations',
          name: 'Calculation with lint issue',
          description: 'A test calculation',
          language: 'printscript',
          version: '1.1',
          content: 'let a = 5;',
          ownerId: 'user-ana',
          role: 'OWNER',
          lintStatus: 'NON_COMPLIANT',
          lintViolations: [
            {
              rule: 'camel-case-rule',
              message: 'Variable should be camelCase',
              line: 1,
              column: 5,
            },
          ],
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-01T10:00:00Z',
        });
      }),
    );

    const snippet = await operations.getSnippetById('snippet-with-violations');

    expect(snippet).toBeDefined();
    expect(snippet?.description).toBe('A test calculation');
    expect(snippet?.compliance).toBe('not-compliant');
    expect(snippet?.lintViolations).toHaveLength(1);
    expect(snippet?.lintViolations?.[0]).toEqual({
      rule: 'camel-case-rule',
      message: 'Variable should be camelCase',
      line: 1,
      column: 5,
    });
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

  it('getFileTypes maps /languages to file types with extension', async () => {
    server.use(
      http.get(`${BASE_URL}/languages`, () => {
        return HttpResponse.json([
          { id: 'printscript', versions: ['1.0', '1.1'] },
          { id: 'python', versions: ['3.12'] },
        ]);
      }),
    );

    const types = await operations.getFileTypes();

    expect(types).toHaveLength(2);
    expect(types[0]).toEqual({
      language: 'printscript',
      extension: 'prs',
      versions: ['1.0', '1.1'],
    });
    expect(types[1]).toEqual({
      language: 'python',
      extension: 'python',
      versions: ['3.12'],
    });
  });

  it('getUserFriends queries /users and maps to PaginatedUsers', async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get(`${BASE_URL}/users`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([
          { id: 'user-1', name: 'Ana', email: 'ana@example.com' },
          { id: 'user-2', name: '', email: 'juan@example.com' },
        ]);
      }),
    );

    const result = await operations.getUserFriends('an', 1, 5);

    expect(capturedUrl).toContain('search=an');
    expect(capturedUrl).toContain('limit=5');
    expect(result.count).toBe(2);
    expect(result.users[0]).toEqual({ id: 'user-1', name: 'Ana' });
    expect(result.users[1]).toEqual({ id: 'user-2', name: 'juan@example.com' });
  });

  it('shareSnippet calls POST /snippets/{id}/share and returns updated snippet', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post(`${BASE_URL}/snippets/snippet-99/share`, async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${BASE_URL}/snippets/snippet-99`, () => {
        return HttpResponse.json({
          id: 'snippet-99',
          name: 'Shared Script',
          language: 'printscript',
          version: '1.1',
          content: 'println(42);',
          ownerId: 'user-ana',
          role: 'OWNER',
          lintStatus: 'COMPLIANT',
          sharedWith: ['user-juan'],
        });
      }),
    );

    const shared = await operations.shareSnippet('snippet-99', 'user-juan');

    expect(capturedBody).toEqual({ userId: 'user-juan' });
    expect(shared.id).toBe('snippet-99');
    expect(shared.name).toBe('Shared Script');
  });

  it('getFormatRules queries /rules/printscript/format and maps config to Rule[]', async () => {
    server.use(
      http.get(`${BASE_URL}/rules/printscript/format`, () => {
        return HttpResponse.json({
          language: 'printscript',
          kind: 'FORMAT',
          isDefault: true,
          config: {
            indentSize: 4,
            enforceSpacing: true,
          },
        });
      }),
    );

    const rules = await operations.getFormatRules();

    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({
      id: '1',
      name: 'indentSize',
      isActive: true,
      value: 4,
    });
    expect(rules[1]).toEqual({
      id: '2',
      name: 'enforceSpacing',
      isActive: true,
      value: null,
    });
  });

  it('modifyFormatRule sends PUT /rules/printscript/format with transformed config', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.put(`${BASE_URL}/rules/printscript/format`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          language: 'printscript',
          kind: 'FORMAT',
          config: { indentSize: 2 },
          processed: 1,
          failed: 0,
        });
      }),
    );

    const newRules = [
      { id: '1', name: 'indentSize', isActive: true, value: 2 },
      { id: '2', name: 'disabledRule', isActive: false, value: null },
    ];

    const result = await operations.modifyFormatRule(newRules);

    expect(capturedBody).toEqual({
      config: {
        indentSize: 2,
        disabledRule: false,
      },
    });
    expect(result).toEqual(newRules);
  });

  it('getLintingRules queries /rules/printscript/lint and maps config to Rule[]', async () => {
    server.use(
      http.get(`${BASE_URL}/rules/printscript/lint`, () => {
        return HttpResponse.json({
          language: 'printscript',
          kind: 'LINT',
          config: {
            identifierFormat: 'snake case',
          },
        });
      }),
    );

    const rules = await operations.getLintingRules();

    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      id: '1',
      name: 'identifierFormat',
      isActive: true,
      value: 'snake case',
    });
  });

  it('modifyLintingRule sends PUT /rules/printscript/lint with updated config', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.put(`${BASE_URL}/rules/printscript/lint`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          language: 'printscript',
          kind: 'LINT',
          config: { identifierFormat: 'camelCase' },
          processed: 1,
          failed: 0,
        });
      }),
    );

    const newRules = [{ id: '1', name: 'identifierFormat', isActive: true, value: 'camelCase' }];

    const result = await operations.modifyLintingRule(newRules);

    expect(capturedBody).toEqual({
      config: {
        identifierFormat: 'camelCase',
      },
    });
    expect(result).toEqual(newRules);
  });

  it('formatSnippet returns snippet string content', async () => {
    const formatted = await operations.formatSnippet('let a = 1;');
    expect(formatted).toBe('let a = 1;');
  });

  it('getTestCases fetches tests for the active snippet', async () => {
    operations.setActiveSnippetId('snippet-123');

    server.use(
      http.get(`${BASE_URL}/snippets/snippet-123/tests`, () => {
        return HttpResponse.json([
          {
            id: 'test-1',
            name: 'Test Positive',
            inputs: ['1', '2'],
            expectedOutputs: ['3'],
            lastStatus: 'PASSED',
          },
        ]);
      }),
    );

    const testCases = await operations.getTestCases();

    expect(testCases).toHaveLength(1);
    expect(testCases[0]).toEqual({
      id: 'test-1',
      name: 'Test Positive',
      input: ['1', '2'],
      output: ['3'],
    });
  });

  it('postTestCase creates new test case when id is missing', async () => {
    operations.setActiveSnippetId('snippet-123');
    let capturedBody: unknown = null;

    server.use(
      http.post(`${BASE_URL}/snippets/snippet-123/tests`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: 'test-new-1',
          name: 'New Test',
          inputs: ['4'],
          expectedOutputs: ['16'],
          lastStatus: 'NOT_RUN',
        });
      }),
    );

    const created = await operations.postTestCase({
      name: 'New Test',
      input: ['4'],
      output: ['16'],
    });

    expect(capturedBody).toEqual({
      name: 'New Test',
      inputs: ['4'],
      expectedOutputs: ['16'],
    });
    expect(created.id).toBe('test-new-1');
  });

  it('postTestCase updates existing test case when id is provided', async () => {
    operations.setActiveSnippetId('snippet-123');
    let capturedBody: unknown = null;

    server.use(
      http.put(`${BASE_URL}/snippets/snippet-123/tests/test-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: 'test-1',
          name: 'Updated Test',
          inputs: ['5'],
          expectedOutputs: ['25'],
          lastStatus: 'NOT_RUN',
        });
      }),
    );

    const updated = await operations.postTestCase({
      id: 'test-1',
      name: 'Updated Test',
      input: ['5'],
      output: ['25'],
    });

    expect(capturedBody).toEqual({
      name: 'Updated Test',
      inputs: ['5'],
      expectedOutputs: ['25'],
    });
    expect(updated.name).toBe('Updated Test');
  });

  it('removeTestCase deletes test case by id', async () => {
    operations.setActiveSnippetId('snippet-123');
    let deleted = false;

    server.use(
      http.delete(`${BASE_URL}/snippets/snippet-123/tests/test-1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const removedId = await operations.removeTestCase('test-1');

    expect(deleted).toBe(true);
    expect(removedId).toBe('test-1');
  });

  it('testSnippet runs test and returns success or fail', async () => {
    operations.setActiveSnippetId('snippet-123');

    server.use(
      http.post(`${BASE_URL}/snippets/snippet-123/tests/test-1/run`, () => {
        return HttpResponse.json({
          testId: 'test-1',
          status: 'PASSED',
          expectedOutputs: ['3'],
          actualOutputs: ['3'],
        });
      }),
    );

    const result = await operations.testSnippet({ id: 'test-1' });
    expect(result).toBe('success');
  });

  it('removeTestCase throws when no snippetId is provided or active', async () => {
    const unattachedOps = new HttpSnippetOperations(BASE_URL, async () => 'token');
    await expect(unattachedOps.removeTestCase('test-1')).rejects.toThrow(
      'Cannot remove test case without active snippetId',
    );
  });

  it('testSnippet returns fail when no snippetId or testCase.id is provided', async () => {
    const unattachedOps = new HttpSnippetOperations(BASE_URL, async () => 'token');
    const result1 = await unattachedOps.testSnippet({ id: 'test-1' });
    expect(result1).toBe('fail');

    operations.setActiveSnippetId('snippet-123');
    const result2 = await operations.testSnippet({});
    expect(result2).toBe('fail');
  });

  it('getTestCases returns empty array when no snippetId is active or provided', async () => {
    const unattachedOps = new HttpSnippetOperations(BASE_URL, async () => 'token');
    const tests = await unattachedOps.getTestCases();
    expect(tests).toEqual([]);
  });

  it('postTestCase throws when no snippetId is active or provided', async () => {
    const unattachedOps = new HttpSnippetOperations(BASE_URL, async () => 'token');
    await expect(unattachedOps.postTestCase({ name: 'Fail' })).rejects.toThrow(
      'Cannot save test case without active snippetId',
    );
  });

  it('testSnippet returns fail when backend test run fails', async () => {
    operations.setActiveSnippetId('snippet-123');
    server.use(
      http.post(`${BASE_URL}/snippets/snippet-123/tests/test-fail/run`, () => {
        return HttpResponse.json({
          testId: 'test-fail',
          status: 'FAILED',
          expectedOutputs: ['1'],
          actualOutputs: ['2'],
        });
      }),
    );

    const result = await operations.testSnippet({ id: 'test-fail' });
    expect(result).toBe('fail');
  });

  it('getSnippetById rethrows non-404 errors', async () => {
    server.use(
      http.get(`${BASE_URL}/snippets/snippet-500`, () => {
        return HttpResponse.json({ message: 'Internal crash' }, { status: 500 });
      }),
    );

    await expect(operations.getSnippetById('snippet-500')).rejects.toThrow('Internal crash');
  });

  it('shareSnippet throws if snippet is not found after sharing', async () => {
    server.use(
      http.post(`${BASE_URL}/snippets/snippet-ghost/share`, () => {
        return HttpResponse.json({ success: true });
      }),
      http.get(`${BASE_URL}/snippets/snippet-ghost`, () => {
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      }),
    );

    await expect(operations.shareSnippet('snippet-ghost', 'user-2')).rejects.toThrow(
      'Snippet snippet-ghost not found after sharing',
    );
  });

  describe('Phase 2: Downloads, Syntax Feedback, and Versions', () => {
    it('downloadSnippet downloads original snippet and extracts filename from header', async () => {
      let capturedUrl = '';
      server.use(
        http.get(`${BASE_URL}/snippets/snippet-dl-1/download`, ({ request }) => {
          capturedUrl = request.url;
          return new HttpResponse('let a: number = 5;', {
            status: 200,
            headers: {
              'Content-Disposition': 'attachment; filename="my-snippet.prs"',
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
        }),
      );

      const result = await operations.downloadSnippet('snippet-dl-1', false);
      expect(capturedUrl).toContain('formatted=false');
      expect(result.filename).toBe('my-snippet.prs');
      const text = await result.blob.text();
      expect(text).toBe('let a: number = 5;');
    });

    it('downloadSnippet downloads formatted snippet', async () => {
      let capturedUrl = '';
      server.use(
        http.get(`${BASE_URL}/snippets/snippet-dl-2/download`, ({ request }) => {
          capturedUrl = request.url;
          return new HttpResponse('let a : number = 5 ;', {
            status: 200,
            headers: {
              'Content-Disposition': 'attachment; filename="formatted.prs"',
            },
          });
        }),
      );

      const result = await operations.downloadSnippet('snippet-dl-2', true);
      expect(capturedUrl).toContain('formatted=true');
      expect(result.filename).toBe('formatted.prs');
      const text = await result.blob.text();
      expect(text).toBe('let a : number = 5 ;');
    });

    it('downloadSnippet throws HttpError on failure', async () => {
      server.use(
        http.get(`${BASE_URL}/snippets/snippet-err/download`, () => {
          return HttpResponse.json({ message: 'Snippet not found' }, { status: 404 });
        }),
      );

      await expect(operations.downloadSnippet('snippet-err')).rejects.toThrow('Snippet not found');
    });

    it('createSnippet sends description and version in payload', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE_URL}/snippets`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'snippet-new-1',
            name: 'New Snippet',
            description: 'My Description',
            language: 'printscript',
            version: '1.1',
            content: 'println("hi");',
            ownerId: 'user-me',
            role: 'OWNER',
            lintStatus: 'COMPLIANT',
            updatedAt: '2026-11-03T10:00:00Z',
          });
        }),
      );

      const snippet = await operations.createSnippet({
        name: 'New Snippet',
        description: 'My Description',
        version: '1.1',
        content: 'println("hi");',
        language: 'printscript',
        extension: 'prs',
      });

      expect(capturedBody).toEqual({
        name: 'New Snippet',
        content: 'println("hi");',
        description: 'My Description',
        language: 'printscript',
        version: '1.1',
      });
      expect(snippet.description).toBe('My Description');
      expect(snippet.version).toBe('1.1');
    });

    it('captures syntax error code and details in HttpError when snippet is invalid', async () => {
      server.use(
        http.post(`${BASE_URL}/snippets`, () => {
          return HttpResponse.json(
            {
              code: 'INVALID_SNIPPET',
              message: 'Snippet is not valid',
              details: [
                {
                  rule: 'syntax',
                  message: 'mismatched input',
                  line: 2,
                  column: 5,
                },
              ],
            },
            { status: 400 },
          );
        }),
      );

      try {
        await operations.createSnippet({
          name: 'Invalid Snippet',
          content: 'let a = ;',
          language: 'printscript',
          extension: 'prs',
        });
        expect.unreachable('Should have thrown HttpError');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        const httpErr = err as HttpError;
        expect(httpErr.status).toBe(400);
        expect(httpErr.code).toBe('INVALID_SNIPPET');
        expect(httpErr.details).toHaveLength(1);
        expect(httpErr.details?.[0]).toEqual({
          rule: 'syntax',
          message: 'mismatched input',
          line: 2,
          column: 5,
        });
      }
    });

    it('getFileTypes returns versions list', async () => {
      server.use(
        http.get(`${BASE_URL}/languages`, () => {
          return HttpResponse.json([{ id: 'printscript', versions: ['1.0', '1.1'] }]);
        }),
      );

      const types = await operations.getFileTypes();
      expect(types).toEqual([
        { language: 'printscript', extension: 'prs', versions: ['1.0', '1.1'] },
      ]);
    });

    it('downloadSnippet uses default filename when Content-Disposition is absent', async () => {
      server.use(
        http.get(`${BASE_URL}/snippets/snippet-no-cd/download`, () => {
          return new HttpResponse('raw code', { status: 200 });
        }),
      );

      const result = await operations.downloadSnippet('snippet-no-cd');
      expect(result.filename).toBe('snippet-snippet-no-cd.txt');
      expect(await result.blob.text()).toBe('raw code');
    });

    it('downloadSnippet handles non-json error responses gracefully', async () => {
      server.use(
        http.get(`${BASE_URL}/snippets/snippet-bad-err/download`, () => {
          return new HttpResponse('Bad Gateway', { status: 502 });
        }),
      );

      await expect(operations.downloadSnippet('snippet-bad-err')).rejects.toThrow(
        'Download failed with status 502',
      );
    });

    it('downloadSnippet works when tokenProvider is absent', async () => {
      const opsNoToken = new HttpSnippetOperations(BASE_URL);
      server.use(
        http.get(`${BASE_URL}/snippets/snippet-no-token/download`, () => {
          return new HttpResponse('no auth code', { status: 200 });
        }),
      );

      const result = await opsNoToken.downloadSnippet('snippet-no-token');
      expect(await result.blob.text()).toBe('no auth code');
    });

    it('updateSnippetById sends name, description, and version if provided', async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put(`${BASE_URL}/snippets/snippet-up-1`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'snippet-up-1',
            name: 'Updated Name',
            description: 'Updated Desc',
            language: 'printscript',
            version: '1.0',
            content: 'let b = 10;',
            ownerId: 'user-1',
            role: 'OWNER',
            lintStatus: 'COMPLIANT',
            updatedAt: '2026-11-03T11:00:00Z',
          });
        }),
      );

      const updated = await operations.updateSnippetById('snippet-up-1', {
        name: 'Updated Name',
        description: 'Updated Desc',
        version: '1.0',
        content: 'let b = 10;',
      });

      expect(capturedBody).toEqual({
        name: 'Updated Name',
        description: 'Updated Desc',
        version: '1.0',
        content: 'let b = 10;',
      });
      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated Desc');
      expect(updated.version).toBe('1.0');
    });

    it('triggerBlobDownload creates an anchor and triggers download', () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
      const revokeObjectURLMock = vi.fn();
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = revokeObjectURLMock;

      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      const blob = new Blob(['sample']);
      triggerBlobDownload(blob, 'sample.prs');

      expect(createObjectURLMock).toHaveBeenCalledWith(blob);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });
});
