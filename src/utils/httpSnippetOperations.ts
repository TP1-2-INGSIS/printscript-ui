import { z } from 'zod';
import {
  ComplianceEnum,
  CreateSnippet,
  PaginatedSnippets,
  Snippet,
  UpdateSnippet,
} from './snippet';
import { SnippetOperations } from './snippetOperations';
import { PaginatedUsers } from './users';
import { TestCase } from '../types/TestCase';
import { TestCaseResult } from './queries';
import { FileType } from '../types/FileType';
import { Rule } from '../types/Rule';

export type TokenProvider = () => Promise<string>;

export const BackendSnippetSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  version: z.string().optional().default('1.1'),
  ownerId: z.string(),
  role: z.string().optional().default('OWNER'),
  lintStatus: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type BackendSnippetSummary = z.infer<typeof BackendSnippetSummarySchema>;

export const BackendSnippetDetailSchema = BackendSnippetSummarySchema.extend({
  content: z.string(),
  description: z.string().nullable().optional(),
  lintViolations: z
    .array(
      z.object({
        line: z.number(),
        column: z.number(),
        message: z.string(),
      }),
    )
    .optional(),
  sharedWith: z.array(z.string()).nullable().optional(),
  createdAt: z.string().optional(),
});

export type BackendSnippetDetail = z.infer<typeof BackendSnippetDetailSchema>;

export const BackendSnippetPageSchema = z.object({
  items: z.array(BackendSnippetSummarySchema),
  page: z.number(),
  size: z.number(),
  total: z.number(),
});

export type BackendSnippetPage = z.infer<typeof BackendSnippetPageSchema>;

const mapLintStatus = (status?: string): ComplianceEnum => {
  switch (status?.toUpperCase()) {
    case 'COMPLIANT':
      return 'compliant';
    case 'NON_COMPLIANT':
    case 'NOT-COMPLIANT':
      return 'not-compliant';
    case 'FAILED':
      return 'failed';
    default:
      return 'pending';
  }
};

const mapSummaryToSnippet = (summary: BackendSnippetSummary): Snippet => ({
  id: summary.id,
  name: summary.name,
  language: summary.language,
  extension: summary.language === 'printscript' ? 'prs' : summary.language,
  content: '',
  compliance: mapLintStatus(summary.lintStatus),
  author: summary.ownerId,
});

const mapDetailToSnippet = (detail: BackendSnippetDetail): Snippet => ({
  id: detail.id,
  name: detail.name,
  language: detail.language,
  extension: detail.language === 'printscript' ? 'prs' : detail.language,
  content: detail.content ?? '',
  compliance: mapLintStatus(detail.lintStatus),
  author: detail.ownerId,
});

export class HttpSnippetOperations implements SnippetOperations {
  private readonly baseUrl: string;
  private readonly tokenProvider?: TokenProvider;

  constructor(baseUrl: string, tokenProvider?: TokenProvider) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.tokenProvider = tokenProvider;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = new Headers(options.headers || {});

    if (this.tokenProvider) {
      const token = await this.tokenProvider();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody && typeof errorBody === 'object' && 'message' in errorBody) {
          errorMessage = String(errorBody.message);
        } else if (errorBody && typeof errorBody === 'object' && 'error' in errorBody) {
          errorMessage = String(errorBody.error);
        }
      } catch {
        // Ignora falla de parsing del body si no es JSON
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const rawData: unknown = await response.json();

    if (schema) {
      const parseResult = schema.safeParse(rawData);
      if (!parseResult.success) {
        throw new Error(
          `Contract validation failed: Backend response does not match expected schema. Errors: ${JSON.stringify(
            parseResult.error.format(),
          )}`,
        );
      }
      return parseResult.data;
    }

    return rawData as T;
  }

  async listSnippetDescriptors(
    page: number = 0,
    pageSize: number = 10,
    snippetName?: string,
  ): Promise<PaginatedSnippets> {
    const query = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
    });

    if (snippetName) {
      query.set('name', snippetName);
    }

    const data = await this.request<BackendSnippetPage>(
      `/snippets?${query.toString()}`,
      {
        method: 'GET',
      },
      BackendSnippetPageSchema,
    );

    return {
      page: data.page,
      page_size: data.size,
      count: data.total,
      snippets: (data.items || []).map(mapSummaryToSnippet),
    };
  }

  async getSnippetById(id: string): Promise<Snippet | undefined> {
    try {
      const detail = await this.request<BackendSnippetDetail>(
        `/snippets/${id}`,
        {
          method: 'GET',
        },
        BackendSnippetDetailSchema,
      );
      return mapDetailToSnippet(detail);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return undefined;
      }
      throw error;
    }
  }

  async createSnippet(createSnippet: CreateSnippet): Promise<Snippet> {
    const payload = {
      name: createSnippet.name,
      content: createSnippet.content,
      language: createSnippet.language || 'printscript',
      version: '1.1',
    };

    const detail = await this.request<BackendSnippetDetail>(
      '/snippets',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      BackendSnippetDetailSchema,
    );

    return mapDetailToSnippet(detail);
  }

  async updateSnippetById(id: string, updateSnippet: UpdateSnippet): Promise<Snippet> {
    const payload = {
      content: updateSnippet.content,
    };

    const detail = await this.request<BackendSnippetDetail>(
      `/snippets/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      BackendSnippetDetailSchema,
    );

    return mapDetailToSnippet(detail);
  }

  async deleteSnippet(id: string): Promise<string> {
    await this.request<void>(`/snippets/${id}`, {
      method: 'DELETE',
    });
    return id;
  }

  async getUserFriends(): Promise<PaginatedUsers> {
    throw new Error('Method not implemented.');
  }

  async shareSnippet(): Promise<Snippet> {
    throw new Error('Method not implemented.');
  }

  async getFormatRules(): Promise<Rule[]> {
    throw new Error('Method not implemented.');
  }

  async getLintingRules(): Promise<Rule[]> {
    throw new Error('Method not implemented.');
  }

  async getTestCases(): Promise<TestCase[]> {
    throw new Error('Method not implemented.');
  }

  async formatSnippet(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async postTestCase(): Promise<TestCase> {
    throw new Error('Method not implemented.');
  }

  async removeTestCase(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async testSnippet(): Promise<TestCaseResult> {
    throw new Error('Method not implemented.');
  }

  async getFileTypes(): Promise<FileType[]> {
    throw new Error('Method not implemented.');
  }

  async modifyFormatRule(): Promise<Rule[]> {
    throw new Error('Method not implemented.');
  }

  async modifyLintingRule(): Promise<Rule[]> {
    throw new Error('Method not implemented.');
  }
}
