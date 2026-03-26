import { useState } from 'react'
import { GripVertical, Trash2, Edit2 } from 'lucide-react'

export interface DraggableItem {
  id: number
  title: string
  subtitle?: string
  description?: string
}

interface DragDropListProps<T extends DraggableItem> {
  items: T[]
  onReorder: (items: T[]) => void
  onEdit?: (item: T) => void
  onDelete?: (id: number) => void
  renderItem?: (item: T) => React.ReactNode
  loading?: boolean
}

export function DragDropList<T extends DraggableItem>({
  items,
  onReorder,
  onEdit,
  onDelete,
  renderItem,
  loading = false,
}: DragDropListProps<T>) {
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  const handleDragStart = (id: number) => {
    setDraggedId(id)
  }

  const handleDragOver = (id: number) => {
    setDragOverId(id)
  }

  const handleDrop = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return

    const draggedIndex = items.findIndex(i => i.id === draggedId)
    const targetIndex = items.findIndex(i => i.id === targetId)

    const newItems = [...items]
    const [draggedItem] = newItems.splice(draggedIndex, 1)
    newItems.splice(targetIndex, 0, draggedItem)

    onReorder(newItems)
    setDraggedId(null)
    setDragOverId(null)
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={() => handleDragStart(item.id)}
          onDragOver={() => handleDragOver(item.id)}
          onDrop={() => handleDrop(item.id)}
          onDragEnd={() => {
            setDraggedId(null)
            setDragOverId(null)
          }}
          className={`flex items-center gap-3 p-4 bg-card border rounded transition-all ${
            draggedId === item.id
              ? 'opacity-50 border-dashed'
              : dragOverId === item.id
                ? 'border-primary/50 bg-primary/5'
                : 'border-border hover:border-primary/30'
          } ${loading ? 'opacity-50 pointer-events-none' : 'cursor-move'}`}
        >
          <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />

          <div className="flex-1 min-w-0">
            {renderItem ? (
              renderItem(item)
            ) : (
              <>
                <h4 className="font-medium text-foreground truncate">{item.title}</h4>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                )}
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                )}
              </>
            )}
          </div>

          <div className="flex gap-1 flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(item)}
                disabled={loading}
                className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(item.id)}
                disabled={loading}
                className="p-2 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded">
          No items to display
        </div>
      )}
    </div>
  )
}
