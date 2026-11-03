import { Pagination } from './pagination.ts';
import { FileType } from '../types/FileType.ts';

export type ComplianceEnum = 'pending' | 'failed' | 'not-compliant' | 'compliant';

export type CreateSnippet = {
  name: string;
  content: string;
  language: string;
  extension: string;
};

export type CreateSnippetWithLang = CreateSnippet & { language: string };

export type UpdateSnippet = {
  content: string;
};

export type LintViolation = {
  rule: string;
  message: string;
  line?: number | null;
  column?: number | null;
};

export type Snippet = CreateSnippet & {
  id: string;
  description?: string | null;
  lintViolations?: LintViolation[];
} & SnippetStatus;

type SnippetStatus = {
  compliance: ComplianceEnum;
  author: string;
};
export type PaginatedSnippets = Pagination & {
  snippets: Snippet[];
};

export const getFileLanguage = (fileTypes: FileType[], fileExt?: string) => {
  return fileExt && fileTypes?.find((x) => x.extension == fileExt);
};
