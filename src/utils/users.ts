import { Pagination } from './pagination.ts';

export type PaginatedUsers = Pagination & {
  users: User[];
};

export type User = {
  name: string;
  email?: string;
  id: string;
};

export const getUserLabel = (user: User): string => {
  const name = user.name?.trim() ?? '';
  const email = user.email?.trim() ?? '';
  if (!name) return email;
  if (!email || email.toLowerCase() === name.toLowerCase()) return name;
  return `${name} (${email})`;
};
