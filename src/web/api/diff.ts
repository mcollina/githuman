/**
 * Diff API client
 */
import { api } from './client';

export interface FileContent {
  path: string;
  version: 'staged' | 'head';
  content: string;
  lines: string[];
  lineCount: number;
}

export const diffApi = {
  /**
   * Get the full content of a file
   */
  getFileContent: (filePath: string, version: 'staged' | 'head' = 'staged') => {
    return api.get<FileContent>(`/diff/file/${filePath}?version=${version}`);
  },
};
