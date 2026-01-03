import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Highlighter, BundledLanguage } from 'shiki';
import { getLanguageFromPath } from '../hooks/useHighlighter';

interface HighlightedLine {
  html: string;
}

interface FileHighlights {
  [lineContent: string]: HighlightedLine;
}

interface HighlighterContextValue {
  isReady: boolean;
  getHighlightedLine: (filePath: string, lineContent: string) => string | null;
  highlightFile: (filePath: string, lines: string[]) => Promise<void>;
}

const HighlighterContext = createContext<HighlighterContextValue | null>(null);

// Languages to preload
const preloadLanguages: BundledLanguage[] = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'html',
  'css',
  'markdown',
  'bash',
  'yaml',
];

let highlighterPromise: Promise<Highlighter> | null = null;
let initFailed = false;

async function getHighlighterInstance(): Promise<Highlighter | null> {
  if (initFailed) return null;

  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      // Dynamic import to handle cases where shiki fails to load
      const { createHighlighter } = await import('shiki');
      return createHighlighter({
        themes: ['github-dark'],
        langs: preloadLanguages,
      });
    })();
  }

  try {
    return await highlighterPromise;
  } catch (err) {
    initFailed = true;
    highlighterPromise = null;
    throw err;
  }
}

export function HighlighterProvider({ children }: { children: ReactNode }) {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [fileCache, setFileCache] = useState<Map<string, FileHighlights>>(new Map());

  useEffect(() => {
    let mounted = true;
    getHighlighterInstance()
      .then((h) => {
        if (mounted && h) setHighlighter(h);
      })
      .catch((err) => {
        // Shiki may fail on some browsers (e.g., mobile without WASM support)
        console.warn('Failed to initialize syntax highlighter:', err);
      });
    return () => { mounted = false; };
  }, []);

  const highlightFile = useCallback(async (filePath: string, lines: string[]) => {
    if (!highlighter) return;

    // Check if already cached
    if (fileCache.has(filePath)) return;

    const lang = getLanguageFromPath(filePath);
    if (!lang) return;

    try {
      // Load language if needed
      const loadedLangs = highlighter.getLoadedLanguages();
      if (!loadedLangs.includes(lang)) {
        await highlighter.loadLanguage(lang);
      }

      // Highlight each unique line
      const highlights: FileHighlights = {};
      const uniqueLines = [...new Set(lines)];

      for (const line of uniqueLines) {
        if (!line.trim()) {
          highlights[line] = { html: line || ' ' };
          continue;
        }

        try {
          const html = highlighter.codeToHtml(line, {
            lang,
            theme: 'github-dark',
          });
          // Extract content from <pre><code>...</code></pre>
          const match = html.match(/<code[^>]*>([\s\S]*)<\/code>/);
          if (match) {
            // Remove the trailing newline that shiki adds
            highlights[line] = { html: match[1].replace(/\n$/, '') };
          } else {
            highlights[line] = { html: line };
          }
        } catch {
          highlights[line] = { html: line };
        }
      }

      setFileCache((prev) => new Map(prev).set(filePath, highlights));
    } catch {
      // Language not supported - ignore
    }
  }, [highlighter, fileCache]);

  const getHighlightedLine = useCallback((filePath: string, lineContent: string): string | null => {
    const fileHighlights = fileCache.get(filePath);
    if (!fileHighlights) return null;
    return fileHighlights[lineContent]?.html ?? null;
  }, [fileCache]);

  return (
    <HighlighterContext.Provider
      value={{
        isReady: highlighter !== null,
        getHighlightedLine,
        highlightFile,
      }}
    >
      {children}
    </HighlighterContext.Provider>
  );
}

export function useHighlighterContext() {
  return useContext(HighlighterContext);
}
