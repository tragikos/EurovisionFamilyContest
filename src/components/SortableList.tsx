import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { HTMLAttributes, ReactNode } from 'react'

/** Spread onto whichever element should be the sole drag trigger - never the whole row, so touch scrolling still works. */
export type DragHandleProps = HTMLAttributes<HTMLElement>

interface SortableListProps<T> {
  items: T[]
  getId: (item: T) => string
  onReorder: (items: T[]) => void
  renderItem: (item: T, index: number, handleProps: DragHandleProps) => ReactNode
  disabled?: boolean
}

export function SortableList<T>({ items, getId, onReorder, renderItem, disabled }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((item) => getId(item) === active.id)
    const newIndex = items.findIndex((item) => getId(item) === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <ol className="sortable-list">
          {items.map((item, index) => (
            <SortableRow key={getId(item)} id={getId(item)} disabled={disabled}>
              {(handleProps) => renderItem(item, index, handleProps)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: (handleProps: DragHandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleProps: DragHandleProps = { ...attributes, ...listeners }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`sortable-row${isDragging ? ' sortable-row--dragging' : ''}${disabled ? ' sortable-row--disabled' : ''}`}
    >
      {children(handleProps)}
    </li>
  )
}
