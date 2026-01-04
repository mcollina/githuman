import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodoItem } from '../../../src/web/components/todos/TodoItem';
import type { Todo } from '../../../src/shared/types';

describe('TodoItem', () => {
  const mockTodo: Todo = {
    id: 'todo-1',
    content: 'Test todo item',
    completed: false,
    reviewId: null,
    position: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const completedTodo: Todo = {
    ...mockTodo,
    id: 'todo-2',
    completed: true,
  };

  it('renders todo content', () => {
    render(<TodoItem todo={mockTodo} onToggle={() => {}} onDelete={() => {}} />);

    expect(screen.getByText('Test todo item')).toBeDefined();
  });

  it('shows unchecked state for pending todo', () => {
    render(<TodoItem todo={mockTodo} onToggle={() => {}} onDelete={() => {}} />);

    const checkbox = screen.getByRole('button', { name: 'Mark as complete' });
    expect(checkbox).toBeDefined();
  });

  it('shows checked state for completed todo', () => {
    render(<TodoItem todo={completedTodo} onToggle={() => {}} onDelete={() => {}} />);

    const checkbox = screen.getByRole('button', { name: 'Mark as incomplete' });
    expect(checkbox).toBeDefined();
  });

  it('applies strikethrough style to completed todo', () => {
    render(<TodoItem todo={completedTodo} onToggle={() => {}} onDelete={() => {}} />);

    const content = screen.getByText('Test todo item');
    expect(content.className).toContain('line-through');
  });

  it('calls onToggle when checkbox is clicked', () => {
    const onToggle = vi.fn();
    render(<TodoItem todo={mockTodo} onToggle={onToggle} onDelete={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark as complete' }));

    expect(onToggle).toHaveBeenCalledWith('todo-1');
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<TodoItem todo={mockTodo} onToggle={() => {}} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete todo' }));

    expect(onDelete).toHaveBeenCalledWith('todo-1');
  });

  it('disables buttons when disabled prop is true', () => {
    render(<TodoItem todo={mockTodo} onToggle={() => {}} onDelete={() => {}} disabled />);

    const checkbox = screen.getByRole('button', { name: 'Mark as complete' });
    const deleteBtn = screen.getByRole('button', { name: 'Delete todo' });

    expect(checkbox).toHaveProperty('disabled', true);
    expect(deleteBtn).toHaveProperty('disabled', true);
  });

  describe('drag and drop', () => {
    it('shows drag handle when draggable is true', () => {
      render(<TodoItem todo={mockTodo} onToggle={() => {}} onDelete={() => {}} draggable />);

      const dragHandle = screen.getByLabelText('Drag to reorder');
      expect(dragHandle).toBeDefined();
    });

    it('does not show drag handle when draggable is false', () => {
      render(<TodoItem todo={mockTodo} onToggle={() => {}} onDelete={() => {}} />);

      expect(screen.queryByLabelText('Drag to reorder')).toBeNull();
    });

    it('applies drag-over style when isDragOver is true', () => {
      const { container } = render(
        <TodoItem todo={mockTodo} onToggle={() => {}} onDelete={() => {}} draggable isDragOver />
      );

      const item = container.querySelector('[data-testid="todo-item-todo-1"]');
      expect(item?.className).toContain('border-t-2');
      expect(item?.className).toContain('--gh-accent-primary');
    });

    it('calls onDragStart when drag starts', () => {
      const onDragStart = vi.fn();
      const { container } = render(
        <TodoItem
          todo={mockTodo}
          onToggle={() => {}}
          onDelete={() => {}}
          draggable
          onDragStart={onDragStart}
        />
      );

      const item = container.querySelector('[data-testid="todo-item-todo-1"]')!;
      fireEvent.dragStart(item);

      expect(onDragStart).toHaveBeenCalled();
    });

    it('calls onDragEnter when dragged over', () => {
      const onDragEnter = vi.fn();
      const { container } = render(
        <TodoItem
          todo={mockTodo}
          onToggle={() => {}}
          onDelete={() => {}}
          draggable
          onDragEnter={onDragEnter}
        />
      );

      const item = container.querySelector('[data-testid="todo-item-todo-1"]')!;
      fireEvent.dragEnter(item);

      expect(onDragEnter).toHaveBeenCalled();
    });

    it('calls onDrop when dropped', () => {
      const onDrop = vi.fn();
      const { container } = render(
        <TodoItem
          todo={mockTodo}
          onToggle={() => {}}
          onDelete={() => {}}
          draggable
          onDrop={onDrop}
        />
      );

      const item = container.querySelector('[data-testid="todo-item-todo-1"]')!;
      fireEvent.drop(item);

      expect(onDrop).toHaveBeenCalled();
    });

    it('is not draggable when disabled', () => {
      const { container } = render(
        <TodoItem todo={mockTodo} onToggle={() => {}} onDelete={() => {}} draggable disabled />
      );

      const item = container.querySelector('[data-testid="todo-item-todo-1"]');
      expect(item?.getAttribute('draggable')).toBe('false');
    });
  });
});
