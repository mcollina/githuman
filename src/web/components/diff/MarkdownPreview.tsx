/**
 * MarkdownPreview - shared component for rendering markdown content
 */
import { useState, useEffect, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { codeToHtml, bundledLanguages, type BundledLanguage } from 'shiki'

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx', 'mdown', 'mkd'])

// Custom sanitize schema that preserves syntax highlighting styles
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow class and style on common elements for syntax highlighting
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class', 'style'],
    span: [...(defaultSchema.attributes?.span || []), 'style', 'class'],
    pre: [...(defaultSchema.attributes?.pre || []), 'style', 'class'],
    code: [...(defaultSchema.attributes?.code || []), 'style', 'class', 'className'],
  },
}

export function isMarkdownFile (filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return MARKDOWN_EXTENSIONS.has(ext)
}

// Extract text content from React children
function extractTextFromChildren (children: ReactNode): string {
  if (typeof children === 'string') {
    return children
  }
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('')
  }
  if (children && typeof children === 'object' && 'props' in children) {
    const props = children.props as { children?: ReactNode }
    return extractTextFromChildren(props.children)
  }
  return ''
}

interface HighlightedCodeBlockProps {
  language: string
  code: string
}

function HighlightedCodeBlock ({ language, code }: HighlightedCodeBlockProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Check if language is supported by shiki
    const lang = language in bundledLanguages ? language as BundledLanguage : 'text'

    codeToHtml(code, {
      lang,
      theme: 'github-dark'
    }).then(html => {
      if (!cancelled) {
        setHighlightedHtml(html)
      }
    }).catch(() => {
      // Fall back to no highlighting on error
    })

    return () => { cancelled = true }
  }, [language, code])

  if (highlightedHtml) {
    // Shiki returns a complete <pre><code>...</code></pre> structure
    // We wrap it and apply our container styles
    return (
      <div
        className='shiki-wrapper [&>pre]:bg-[var(--gh-bg-primary)] [&>pre]:text-[var(--gh-text-primary)] [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>pre]:text-sm [&>pre]:border [&>pre]:border-[var(--gh-border)]'
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    )
  }

  // Fallback while loading or on error
  return (
    <pre className='bg-[var(--gh-bg-primary)] text-[var(--gh-text-primary)] p-4 rounded-lg overflow-x-auto text-sm border border-[var(--gh-border)]'>
      <code>{code}</code>
    </pre>
  )
}

interface MarkdownPreviewProps {
  content: string;
  loading?: boolean;
  error?: string | null;
  version?: 'staged' | 'working';
}

export function MarkdownPreview ({ content, loading, error, version = 'staged' }: MarkdownPreviewProps) {
  if (loading) {
    return (
      <div className='p-4 text-center text-[var(--gh-text-muted)]'>
        <div className='gh-spinner w-5 h-5 mx-auto mb-2' />
        Loading preview...
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-4 text-center text-[var(--gh-error)]'>
        {error}
      </div>
    )
  }

  if (!content) {
    return (
      <div className='p-4 text-center text-[var(--gh-text-muted)]'>
        No content to preview
      </div>
    )
  }

  return (
    <div className='p-4 sm:p-6 prose prose-sm prose-invert max-w-none overflow-x-auto'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          // Handle code blocks with syntax highlighting
          code: ({ className, children, ...props }) => {
            // Check if this is a code block (has language class) vs inline code
            const match = className?.match(/language-(\w+)/)
            if (match) {
              // Code block - extract text and highlight with shiki
              const language = match[1]
              const code = extractTextFromChildren(children).replace(/\n$/, '')
              return <HighlightedCodeBlock language={language} code={code} />
            }
            // Inline code
            return (
              <code className='bg-[var(--gh-bg-surface)] text-[var(--gh-accent-primary)] px-1.5 py-0.5 rounded text-sm' {...props}>
                {children}
              </code>
            )
          },
          // Remove default pre wrapper for code blocks (HighlightedCodeBlock provides its own)
          pre: ({ children }) => <>{children}</>,
          // Style links
          a: ({ children, ...props }) => (
            <a className='text-[var(--gh-accent-primary)] hover:underline' {...props}>
              {children}
            </a>
          ),
          // Style headings
          h1: ({ children }) => (
            <h1 className='text-2xl font-bold mt-6 mb-4 pb-2 border-b border-[var(--gh-border)] text-[var(--gh-text-primary)]'>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className='text-xl font-bold mt-5 mb-3 pb-1 border-b border-[var(--gh-border)] text-[var(--gh-text-primary)]'>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className='text-lg font-semibold mt-4 mb-2 text-[var(--gh-text-primary)]'>{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className='text-base font-semibold mt-3 mb-2 text-[var(--gh-text-primary)]'>{children}</h4>
          ),
          // Style lists - use proper nesting with margin-left
          ul: ({ children }) => (
            <ul className='list-disc my-2 space-y-1 ml-4 [&_ul]:ml-6 [&_ul]:mt-1 text-[var(--gh-text-secondary)]'>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className='list-decimal my-2 space-y-1 ml-4 [&_ol]:ml-6 [&_ol]:mt-1 text-[var(--gh-text-secondary)]'>
              {children}
            </ol>
          ),
          li: ({ children, node }) => {
            // Check for task list item by looking at the node
            const isTaskList = node?.properties?.className?.toString().includes('task-list-item')
            const inputChild = node?.children?.find(
              (child): child is typeof child & { tagName: string; properties: { checked?: boolean } } =>
                typeof child === 'object' && 'tagName' in child && child.tagName === 'input'
            )

            if (isTaskList && inputChild) {
              return (
                <li className='list-none flex items-start gap-2 -ml-4'>
                  <input
                    type='checkbox'
                    checked={inputChild.properties?.checked ?? false}
                    readOnly
                    className='mt-1 rounded border-[var(--gh-border)] bg-[var(--gh-bg-secondary)]'
                  />
                  <span>{children}</span>
                </li>
              )
            }
            return <li>{children}</li>
          },
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className='border-l-4 border-[var(--gh-accent-secondary)] pl-4 italic text-[var(--gh-text-muted)] my-4'>
              {children}
            </blockquote>
          ),
          // Style tables - GitHub style
          table: ({ children }) => (
            <div className='overflow-x-auto my-4'>
              <table className='min-w-full border-collapse'>{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className='bg-[var(--gh-bg-secondary)]'>{children}</thead>
          ),
          tr: ({ children }) => (
            <tr className='border-t border-[var(--gh-border)]'>{children}</tr>
          ),
          th: ({ children, style }) => (
            <th
              className='border border-[var(--gh-border)] px-4 py-2 font-semibold text-left bg-[var(--gh-bg-secondary)] text-[var(--gh-text-primary)]'
              style={style}
            >
              {children}
            </th>
          ),
          td: ({ children, style }) => (
            <td className='border border-[var(--gh-border)] px-4 py-2 text-[var(--gh-text-secondary)]' style={style}>
              {children}
            </td>
          ),
          // Style paragraphs
          p: ({ children }) => <p className='my-2 leading-relaxed text-[var(--gh-text-secondary)]'>{children}</p>,
          // Style images - transform relative paths to use the git file API
          img: ({ src, alt }) => {
            let imageSrc = src
            // Transform relative paths to use the git image API
            if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
              // Remove leading ./ if present
              const cleanPath = src.startsWith('./') ? src.slice(2) : src
              imageSrc = `/api/diff/image/${cleanPath}?version=${version}`
            }
            return (
              <img src={imageSrc} alt={alt} className='max-w-full h-auto rounded-lg my-4' />
            )
          },
          // Style horizontal rules
          hr: () => <hr className='my-6 border-t border-[var(--gh-border)]' />,
          // Style strikethrough (GFM)
          del: ({ children }) => (
            <del className='text-[var(--gh-text-muted)] line-through'>{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
