/**
 * Comment Context - provides comment state and actions to diff components
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { commentsApi } from '../api/comments';
import type { Comment, CreateCommentRequest } from '../../shared/types';

interface CommentContextValue {
  reviewId: string | null;
  comments: Comment[];
  commentsByLine: Map<string, Comment[]>;
  loading: boolean;
  activeCommentLine: string | null;
  setActiveCommentLine: (key: string | null) => void;
  addComment: (data: CreateCommentRequest) => Promise<void>;
  updateComment: (commentId: string, content: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  resolveComment: (commentId: string) => Promise<void>;
  unresolveComment: (commentId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const CommentContext = createContext<CommentContextValue | null>(null);

export function useCommentContext() {
  const context = useContext(CommentContext);
  if (!context) {
    throw new Error('useCommentContext must be used within a CommentProvider');
  }
  return context;
}

interface CommentProviderProps {
  reviewId: string;
  children: ReactNode;
}

function getLineKey(filePath: string, lineNumber: number | null, lineType: string | null): string {
  return `${filePath}:${lineNumber ?? 'file'}:${lineType ?? 'none'}`;
}

export function CommentProvider({ reviewId, children }: CommentProviderProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCommentLine, setActiveCommentLine] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!reviewId) return;
    setLoading(true);
    try {
      const data = await commentsApi.getByReview(reviewId);
      setComments(data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  // Initial fetch
  useState(() => {
    refetch();
  });

  // Group comments by line
  const commentsByLine = new Map<string, Comment[]>();
  for (const comment of comments) {
    const key = getLineKey(comment.filePath, comment.lineNumber, comment.lineType);
    const existing = commentsByLine.get(key) || [];
    commentsByLine.set(key, [...existing, comment]);
  }

  const addComment = async (data: CreateCommentRequest) => {
    const comment = await commentsApi.create(reviewId, data);
    setComments((prev) => [...prev, comment]);
    setActiveCommentLine(null);
  };

  const updateComment = async (commentId: string, content: string) => {
    const updated = await commentsApi.update(commentId, { content });
    setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
  };

  const deleteComment = async (commentId: string) => {
    await commentsApi.delete(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const resolveComment = async (commentId: string) => {
    const updated = await commentsApi.resolve(commentId);
    setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
  };

  const unresolveComment = async (commentId: string) => {
    const updated = await commentsApi.unresolve(commentId);
    setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
  };

  return (
    <CommentContext.Provider
      value={{
        reviewId,
        comments,
        commentsByLine,
        loading,
        activeCommentLine,
        setActiveCommentLine,
        addComment,
        updateComment,
        deleteComment,
        resolveComment,
        unresolveComment,
        refetch,
      }}
    >
      {children}
    </CommentContext.Provider>
  );
}

export { getLineKey };
