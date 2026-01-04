/**
 * MarkdownDiff - renders markdown files with preview toggle
 */
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
      <div className="flex items-center gap-2 p-2 bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)]">
        <span className="text-xs text-[var(--gh-text-muted)] mr-2">View:</span>
        <div className="flex rounded-lg border border-[var(--gh-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('diff')}
            className={cn(
              'px-3 py-1 text-xs transition-colors',
              viewMode === 'diff'
                ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)]'
                : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-surface)]'
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
                  'px-3 py-1 text-xs border-l border-[var(--gh-border)] transition-colors',
                  viewMode === 'preview'
                    ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)]'
                    : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-surface)]'
                )}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={cn(
                  'px-3 py-1 text-xs border-l border-[var(--gh-border)] transition-colors',
                  viewMode === 'split'
                    ? 'bg-[var(--gh-accent-primary)] text-[var(--gh-bg-primary)]'
                    : 'bg-[var(--gh-bg-elevated)] text-[var(--gh-text-secondary)] hover:bg-[var(--gh-bg-surface)]'
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
          <div className="flex-1 lg:border-r border-[var(--gh-border)] min-w-0">
            <div className="p-2 bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)] text-xs text-[var(--gh-text-muted)] font-medium">
              Diff
            </div>
            <DiffContent hunks={file.hunks} filePath={filePath} allowComments={allowComments} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="p-2 bg-[var(--gh-bg-secondary)] border-b border-[var(--gh-border)] text-xs text-[var(--gh-text-muted)] font-medium">
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
      <div className="p-4 text-center text-[var(--gh-text-muted)] text-sm">
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
      <div className="p-4 text-center text-[var(--gh-text-muted)]">
        <div className="gh-spinner w-5 h-5 mx-auto mb-2"></div>
        Loading preview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-[var(--gh-error)]">
        {error}
      </div>
    );
  }

  if (!content) {
    return (
      <div className="p-4 text-center text-[var(--gh-text-muted)]">
        No content to preview
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 prose prose-sm prose-invert max-w-none overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Style code blocks
          pre: ({ children }) => (
            <pre className="bg-[var(--gh-bg-primary)] text-[var(--gh-text-primary)] p-4 rounded-lg overflow-x-auto text-sm border border-[var(--gh-border)]">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-[var(--gh-bg-surface)] text-[var(--gh-accent-primary)] px-1.5 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            }
            return <code {...props}>{children}</code>;
          },
          // Style links
          a: ({ children, ...props }) => (
            <a className="text-[var(--gh-accent-primary)] hover:underline" {...props}>
              {children}
            </a>
          ),
          // Style headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-[var(--gh-border)] text-[var(--gh-text-primary)]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mt-5 mb-3 pb-1 border-b border-[var(--gh-border)] text-[var(--gh-text-primary)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-2 text-[var(--gh-text-primary)]">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-3 mb-2 text-[var(--gh-text-primary)]">{children}</h4>
          ),
          // Style lists - use proper nesting with margin-left
          ul: ({ children }) => (
            <ul className="list-disc my-2 space-y-1 ml-4 [&_ul]:ml-6 [&_ul]:mt-1 text-[var(--gh-text-secondary)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal my-2 space-y-1 ml-4 [&_ol]:ml-6 [&_ol]:mt-1 text-[var(--gh-text-secondary)]">
              {children}
            </ol>
          ),
          li: ({ children, node }) => {
            // Check for task list item by looking at the node
            const isTaskList = node?.properties?.className?.toString().includes('task-list-item');
            const inputChild = node?.children?.find(
              (child): child is typeof child & { tagName: string; properties: { checked?: boolean } } =>
                typeof child === 'object' && 'tagName' in child && child.tagName === 'input'
            );

            if (isTaskList && inputChild) {
              return (
                <li className="list-none flex items-start gap-2 -ml-4">
                  <input
                    type="checkbox"
                    checked={inputChild.properties?.checked ?? false}
                    readOnly
                    className="mt-1 rounded border-[var(--gh-border)] bg-[var(--gh-bg-secondary)]"
                  />
                  <span>{children}</span>
                </li>
              );
            }
            return <li>{children}</li>;
          },
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[var(--gh-accent-secondary)] pl-4 italic text-[var(--gh-text-muted)] my-4">
              {children}
            </blockquote>
          ),
          // Style tables - GitHub style
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[var(--gh-bg-secondary)]">{children}</thead>
          ),
          tr: ({ children }) => (
            <tr className="border-t border-[var(--gh-border)]">{children}</tr>
          ),
          th: ({ children, style }) => (
            <th
              className="border border-[var(--gh-border)] px-4 py-2 font-semibold text-left bg-[var(--gh-bg-secondary)] text-[var(--gh-text-primary)]"
              style={style}
            >
              {children}
            </th>
          ),
          td: ({ children, style }) => (
            <td className="border border-[var(--gh-border)] px-4 py-2 text-[var(--gh-text-secondary)]" style={style}>
              {children}
            </td>
          ),
          // Style paragraphs
          p: ({ children }) => <p className="my-2 leading-relaxed text-[var(--gh-text-secondary)]">{children}</p>,
          // Style images
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="max-w-full h-auto rounded-lg my-4" />
          ),
          // Style horizontal rules
          hr: () => <hr className="my-6 border-t border-[var(--gh-border)]" />,
          // Style strikethrough (GFM)
          del: ({ children }) => (
            <del className="text-[var(--gh-text-muted)] line-through">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
