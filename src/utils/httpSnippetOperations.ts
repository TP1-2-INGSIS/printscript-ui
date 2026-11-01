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

export const BackendLanguageInfoSchema = z.object({
  id: z.string(),
  versions: z.array(z.string()),
});

export type BackendLanguageInfo = z.infer<typeof BackendLanguageInfoSchema>;

export const BackendUserSummarySchema = z.object({
  id: z.string(),
  name: z.string().optional().default(''),
  email: z.string(),
});

export type BackendUserSummary = z.infer<typeof BackendUserSummarySchema>;

export const BackendRuleConfigResponseSchema = z.object({
  language: z.string(),
  kind: z.string(),
  isDefault: z.boolean().optional(),
  config: z.record(z.unknown()),
});

export type BackendRuleConfigResponse = z.infer<typeof BackendRuleConfigResponseSchema>;

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

const mapConfigToRules = (config: Record<string, unknown>): Rule[] => {
  return Object.entries(config).map(([name, value], index) => {
    const isActive = value !== null && value !== undefined && value !== false;
    let ruleValue: string | number | null = null;

    if (typeof value === 'number') {
      ruleValue = value;
    } else if (typeof value === 'string') {
      ruleValue = value;
    } else if (typeof value === 'boolean') {
      ruleValue = null;
    } else if (value !== null && value !== undefined) {
      ruleValue = JSON.stringify(value);
    }

    return {
      id: String(index + 1),
      name,
      isActive,
      value: ruleValue,
    };
  });
};

const mapRulesToConfig = (rules: Rule[]): Record<string, unknown> => {
  const config: Record<string, unknown> = {};

  for (const rule of rules) {
    if (!rule.isActive) {
      config[rule.name] = false;
      continue;
    }

    if (rule.value === null || rule.value === undefined || rule.value === '') {
      config[rule.name] = true;
    } else if (typeof rule.value === 'number') {
      config[rule.name] = rule.value;
    } else if (!isNaN(Number(rule.value)) && !isNaN(parseFloat(String(rule.value)))) {
      config[rule.name] = Number(rule.value);
    } else {
      config[rule.name] = rule.value;
    }
  }

  return config;
};

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

  async getFileTypes(): Promise<FileType[]> {
    const languages = await this.request<BackendLanguageInfo[]>(
      '/languages',
      {
        method: 'GET',
      },
      z.array(BackendLanguageInfoSchema),
    );

    return languages.map((lang) => ({
      language: lang.id,
      extension: lang.id === 'printscript' ? 'prs' : lang.id,
    }));
  }

  async getUserFriends(
    name: string = '',
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedUsers> {
    const query = new URLSearchParams({
      search: name,
      limit: String(pageSize),
    });

    const users = await this.request<BackendUserSummary[]>(
      `/users?${query.toString()}`,
      {
        method: 'GET',
      },
      z.array(BackendUserSummarySchema),
    );

    return {
      page,
      page_size: pageSize,
      count: users.length,
      users: users.map((u) => ({
        id: u.id,
        name: u.name || u.email,
      })),
    };
  }

  async shareSnippet(snippetId: string, userId: string): Promise<Snippet> {
    await this.request<void>(`/snippets/${snippetId}/share`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });

    const snippet = await this.getSnippetById(snippetId);
    if (!snippet) {
      throw new Error(`Snippet ${snippetId} not found after sharing`);
    }

    return snippet;
  }

  async getFormatRules(): Promise<Rule[]> {
    const response = await this.request<BackendRuleConfigResponse>(
      '/rules/printscript/format',
      {
        method: 'GET',
      },
      BackendRuleConfigResponseSchema,
    );

    return mapConfigToRules(response.config || {});
  }

  async modifyFormatRule(newRules: Rule[]): Promise<Rule[]> {
    const config = mapRulesToConfig(newRules);

    await this.request<unknown>('/rules/printscript/format', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });

    return newRules;
  }

  async getLintingRules(): Promise<Rule[]> {
    const response = await this.request<BackendRuleConfigResponse>(
      '/rules/printscript/lint',
      {
        method: 'GET',
      },
      BackendRuleConfigResponseSchema,
    );

    return mapConfigToRules(response.config || {});
  }

  async modifyLintingRule(newRules: Rule[]): Promise<Rule[]> {
    const config = mapRulesToConfig(newRules);

    await this.request<unknown>('/rules/printscript/lint', {
      method: 'PUT',
      body: JSON.stringify({ config }),
    });

    return newRules;
  }

  async formatSnippet(snippet: string): Promise<string> {
    return snippet;
  }

  async getTestCases(): Promise<TestCase[]> {
    throw new Error('Method not implemented.');
  }

  async removeTestCase(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  async testSnippet(): Promise<TestCaseResult> {
    throw new Error('Method not implemented.');
  }
}
