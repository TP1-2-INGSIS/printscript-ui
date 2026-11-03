import { useMutation, UseMutationResult, useQuery } from 'react-query';
import { CreateSnippet, PaginatedSnippets, Snippet, UpdateSnippet } from './snippet.ts';
import { SnippetFilterOptions, SnippetOperations } from './snippetOperations.ts';
import { PaginatedUsers } from './users.ts';
import { HttpSnippetOperations } from './httpSnippetOperations.ts';
import { BACKEND_URL } from './constants.ts';
import { useMemo } from 'react';
import { TestCase } from '../types/TestCase.ts';
import { FileType } from '../types/FileType.ts';
import { Rule } from '../types/Rule.ts';
import { useAuth0 } from '@auth0/auth0-react';

export type TokenProvider = () => Promise<string>;

export const useSnippetsOperations = () => {
  const { getAccessTokenSilently } = useAuth0();

  const snippetOperations: SnippetOperations = useMemo(
    () => new HttpSnippetOperations(BACKEND_URL, getAccessTokenSilently),
    [getAccessTokenSilently],
  );

  return snippetOperations;
};

export const useGetSnippets = (
  page: number = 0,
  pageSize: number = 10,
  filterOrName?: string | SnippetFilterOptions,
) => {
  const snippetOperations = useSnippetsOperations();

  return useQuery<PaginatedSnippets, Error>(['listSnippets', page, pageSize, filterOrName], () =>
    snippetOperations.listSnippetDescriptors(page, pageSize, filterOrName),
  );
};

export const useGetSnippetById = (id: string) => {
  const snippetOperations = useSnippetsOperations();

  return useQuery<Snippet | undefined, Error>(
    ['snippet', id],
    () => snippetOperations.getSnippetById(id),
    {
      enabled: !!id, // This query will not execute until the id is provided
    },
  );
};

export const useCreateSnippet = ({
  onSuccess,
}: {
  onSuccess: () => void;
}): UseMutationResult<Snippet, Error, CreateSnippet> => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<Snippet, Error, CreateSnippet>(
    (createSnippet) => snippetOperations.createSnippet(createSnippet),
    { onSuccess },
  );
};

export const useUpdateSnippetById = ({
  onSuccess,
}: {
  onSuccess: () => void;
}): UseMutationResult<
  Snippet,
  Error,
  {
    id: string;
    updateSnippet: UpdateSnippet;
  }
> => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<Snippet, Error, { id: string; updateSnippet: UpdateSnippet }>(
    ({ id, updateSnippet }) => snippetOperations.updateSnippetById(id, updateSnippet),
    {
      onSuccess,
    },
  );
};

export const useGetUsers = (name: string = '', page: number = 0, pageSize: number = 10) => {
  const snippetOperations = useSnippetsOperations();

  return useQuery<PaginatedUsers, Error>(['users', name, page, pageSize], () =>
    snippetOperations.getUserFriends(name, page, pageSize),
  );
};

export const useShareSnippet = () => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<Snippet, Error, { snippetId: string; userId: string }>(
    ({ snippetId, userId }) => snippetOperations.shareSnippet(snippetId, userId),
  );
};

export const useDownloadSnippet = () => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<{ blob: Blob; filename: string }, Error, { id: string; formatted?: boolean }>(
    ({ id, formatted }) => snippetOperations.downloadSnippet(id, formatted),
  );
};

export const useGetTestCases = (snippetId?: string) => {
  const snippetOperations = useSnippetsOperations();

  return useQuery<TestCase[] | undefined, Error>(
    ['testCases', snippetId],
    () => snippetOperations.getTestCases(snippetId),
    {},
  );
};

export const usePostTestCase = ({ onSuccess }: { onSuccess?: () => void } = {}) => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<
    TestCase,
    Error,
    { testCase: Partial<TestCase>; snippetId?: string } | Partial<TestCase>
  >(
    (variables) => {
      if ('testCase' in variables) {
        return snippetOperations.postTestCase(variables.testCase, variables.snippetId);
      }
      return snippetOperations.postTestCase(variables);
    },
    {
      onSuccess,
    },
  );
};

export const useRemoveTestCase = ({ onSuccess }: { onSuccess?: () => void } = {}) => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<string, Error, { id: string; snippetId?: string } | string>(
    ['removeTestCase'],
    (variables) => {
      if (typeof variables === 'string') {
        return snippetOperations.removeTestCase(variables);
      }
      return snippetOperations.removeTestCase(variables.id, variables.snippetId);
    },
    {
      onSuccess,
    },
  );
};

export type TestCaseResult = 'success' | 'fail';

export const useTestSnippet = () => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<
    TestCaseResult,
    Error,
    { testCase: Partial<TestCase>; snippetId?: string } | Partial<TestCase>
  >((variables) => {
    if ('testCase' in variables) {
      return snippetOperations.testSnippet(variables.testCase, variables.snippetId);
    }
    return snippetOperations.testSnippet(variables);
  });
};

export const useGetFormatRules = () => {
  const snippetOperations = useSnippetsOperations();

  return useQuery<Rule[], Error>('formatRules', () => snippetOperations.getFormatRules());
};

export const useModifyFormatRules = ({ onSuccess }: { onSuccess: () => void }) => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<Rule[], Error, Rule[]>((rule) => snippetOperations.modifyFormatRule(rule), {
    onSuccess,
  });
};

export const useGetLintingRules = () => {
  const snippetOperations = useSnippetsOperations();

  return useQuery<Rule[], Error>('lintingRules', () => snippetOperations.getLintingRules());
};

export const useModifyLintingRules = ({ onSuccess }: { onSuccess: () => void }) => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<Rule[], Error, Rule[]>((rule) => snippetOperations.modifyLintingRule(rule), {
    onSuccess,
  });
};

export const useFormatSnippet = () => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<string, Error, string>((snippetContent) =>
    snippetOperations.formatSnippet(snippetContent),
  );
};

export const useDeleteSnippet = ({ onSuccess }: { onSuccess: () => void }) => {
  const snippetOperations = useSnippetsOperations();

  return useMutation<string, Error, string>((id) => snippetOperations.deleteSnippet(id), {
    onSuccess,
  });
};

export const useGetFileTypes = () => {
  const snippetOperations = useSnippetsOperations();

  return useQuery<FileType[], Error>('fileTypes', () => snippetOperations.getFileTypes());
};
