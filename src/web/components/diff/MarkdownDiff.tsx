/**
 * MarkdownDiff - renders markdown files with preview toggle
 */
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { DiffHunk } from './DiffHunk';
import { diffApi, type FileContent } from '../../api/diff';
import type { DiffFile, DiffHunk as DiffHunkType } from '../../../shared/types';

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx', 'mdown', 'mkd']);

export function isMarkdownFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return MARKDOWN_EXTENSIONS.has(ext);
}

interface MarkdownDiffProps {
  file: DiffFile;
  allowComments?: boolean;
}

type ViewMode = 'diff' | 'preview' | 'split';

export function MarkdownDiff({ file, allowComments = false }: MarkdownDiffProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('diff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);

  const filePath = file.newPath || file.oldPath;
  const canShowPreview = file.status !== 'deleted';

  useEffect(() => {
    if (viewMode === 'diff') {
      return;
    }

    if (fileContent) {
      return;
    }

    setLoading(true);
    setError(null);

    diffApi
      .getFileContent(filePath, 'staged')
      .then(setFileContent)
      .catch((err) => setError(err.message || 'Failed to load markdown'))
      .finally(() => setLoading(false));
  }, [filePath, viewMode, fileContent]);

  const markdownContent = fileContent?.lines.join('\n') ?? '';

  return (
    <div>
      {/* View mode toggle */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500 mr-2">View:</span>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('diff')}
            className={cn(
              'px-3 py-1 text-xs',
              viewMode === 'diff'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            )}
          >
            Diff
          </button>
          {canShowPreview && (
            <>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={cn(
                  'px-3 py-1 text-xs border-l border-gray-300',
                  viewMode === 'preview'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                )}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={cn(
                  'px-3 py-1 text-xs border-l border-gray-300',
                  viewMode === 'split'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                )}
              >
                Split
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content area */}
      {viewMode === 'diff' ? (
        <DiffContent hunks={file.hunks} filePath={filePath} allowComments={allowComments} />
      ) : viewMode === 'preview' ? (
        <PreviewContent
          content={markdownContent}
          loading={loading}
          error={error}
        />
      ) : (
        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 lg:border-r border-gray-200 min-w-0">
            <div className="p-2 bg-gray-100 border-b border-gray-200 text-xs text-gray-500 font-medium">
              Diff
            </div>
            <DiffContent hunks={file.hunks} filePath={filePath} allowComments={allowComments} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="p-2 bg-gray-100 border-b border-gray-200 text-xs text-gray-500 font-medium">
              Preview
            </div>
            <PreviewContent
              content={markdownContent}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface DiffContentProps {
  hunks: DiffHunkType[];
  filePath: string;
  allowComments?: boolean;
}

function DiffContent({ hunks, filePath, allowComments }: DiffContentProps) {
  if (hunks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        No changes to display
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {hunks.map((hunk, index) => (
        <DiffHunk
          key={index}
          hunk={hunk}
          filePath={filePath}
          allowComments={allowComments}
        />
      ))}
    </div>
  );
}

interface PreviewContentProps {
  content: string;
  loading: boolean;
  error: string | null;
}

function PreviewContent({ content, loading, error }: PreviewContentProps) {
  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
        Loading preview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        {error}
      </div>
    );
  }

  if (!content) {
    return (
      <div className="p-4 text-center text-gray-500">
        No content to preview
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 prose prose-sm max-w-none overflow-x-auto">
      <ReactMarkdown
        components={{
          // Style code blocks
          pre: ({ children }) => (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            }
            return <code {...props}>{children}</code>;
          },
          // Style links
          a: ({ children, ...props }) => (
            <a className="text-blue-600 hover:underline" {...props}>
              {children}
            </a>
          ),
          // Style headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-gray-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-5 mb-3 pb-1 border-b border-gray-200">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
          ),
          // Style lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4">
              {children}
            </blockquote>
          ),
          // Style tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-gray-300">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 px-3 py-2">{children}</td>
          ),
          // Style paragraphs
          p: ({ children }) => <p className="my-2">{children}</p>,
          // Style images
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="max-w-full h-auto rounded-lg my-4" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
