import { cn } from '../../lib/utils';
import type { DiffLine as DiffLineType } from '../../../shared/types';

interface DiffLineProps {
  line: DiffLineType;
  showLineNumbers?: boolean;
}

export function DiffLine({ line, showLineNumbers = true }: DiffLineProps) {
  const bgClass = {
    added: 'bg-green-50 border-l-4 border-green-400',
    removed: 'bg-red-50 border-l-4 border-red-400',
    context: 'bg-white border-l-4 border-transparent',
  }[line.type];

  const textClass = {
    added: 'text-green-800',
    removed: 'text-red-800',
    context: 'text-gray-800',
  }[line.type];

  const prefix = {
    added: '+',
    removed: '-',
    context: ' ',
  }[line.type];

  return (
    <div className={cn('flex font-mono text-sm', bgClass)}>
      {showLineNumbers && (
        <>
          <span className="w-12 px-2 py-0.5 text-right text-gray-400 select-none bg-gray-50 border-r border-gray-200 shrink-0">
            {line.oldLineNumber ?? ''}
          </span>
          <span className="w-12 px-2 py-0.5 text-right text-gray-400 select-none bg-gray-50 border-r border-gray-200 shrink-0">
            {line.newLineNumber ?? ''}
          </span>
        </>
      )}
      <span className={cn('w-5 px-1 py-0.5 text-center select-none shrink-0', textClass)}>
        {prefix}
      </span>
      <pre className={cn('flex-1 py-0.5 pr-4 overflow-x-auto', textClass)}>
        <code>{line.content || ' '}</code>
      </pre>
    </div>
  );
}
