import { useEffect, useRef, useState } from 'react'

function QueuePanel({
  queue,
  onMoveTrack,
  onRemoveTrack,
}) {
  const itemRefs = useRef(new Map())
  const listRef = useRef(null)
  const dragRef = useRef(null)
  const toggleTimerRef = useRef(null)

  const [dragState, setDragState] = useState(null)
  const [isExpanded, setIsExpanded] = useState(true)
  const [isToggleAnimating, setIsToggleAnimating] = useState(false)

  useEffect(() => {
    return () => {
      dragRef.current = null

      if (toggleTimerRef.current) {
        window.clearTimeout(toggleTimerRef.current)
      }

      document.body.style.userSelect = ''
    }
  }, [])

  const visibleCount = isExpanded
    ? queue.length
    : Math.min(queue.length, 5)

  /*
    Returns the final queue index the dragged item would occupy.

    The important part here is that we measure the wrapper's
    real layout position, not the transformed queue card.
    This keeps the drag target stable while the surrounding
    cards animate around it.
  */
  const getTargetIndex = (pointerY, draggedIndex) => {
    const targetItems = queue
      .map((track, index) => ({
        track,
        index,
        element: itemRefs.current.get(index),
      }))
      .filter(
        ({ index, element }) =>
          index !== draggedIndex &&
          index < visibleCount &&
          element
      )

    for (const item of targetItems) {
      const rect =
        item.element.getBoundingClientRect()

      const midpoint =
        rect.top + rect.height / 2

      if (pointerY < midpoint) {
        /*
          The dragged item is being inserted before
          this item.

          If this item originally comes after the
          dragged item, removing the dragged item first
          shifts its eventual destination index down by 1.
        */
        return item.index > draggedIndex
          ? item.index - 1
          : item.index
      }
    }

    /*
      Pointer is below every visible item.
      Put the track at the end of the visible queue.
    */
    return Math.max(0, visibleCount - 1)
  }

  const handlePointerDown = (event, index) => {
    if (event.button !== 0) {
      return
    }

    if (dragRef.current) {
      return
    }

    /*
      Don't allow hidden tracks to be dragged while
      the queue is collapsed.
    */
    if (index >= visibleCount) {
      return
    }

    const element = event.currentTarget
    const rect = element.getBoundingClientRect()

    const offsetX =
      event.clientX - rect.left

    const offsetY =
      event.clientY - rect.top

    dragRef.current = {
      index,
      offsetX,
      offsetY,
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
      targetIndex: index,
    }

    element.setPointerCapture(event.pointerId)

    setDragState({
      index,
      x: event.clientX,
      y: event.clientY,
      offsetX,
      offsetY,
      width: rect.width,
      height: rect.height,
      targetIndex: index,
    })

    document.body.style.userSelect = 'none'
  }

  const handlePointerMove = (event) => {
    const drag = dragRef.current

    if (!drag) {
      return
    }

    const targetIndex = getTargetIndex(
      event.clientY,
      drag.index
    )

    drag.x = event.clientX
    drag.y = event.clientY
    drag.targetIndex = targetIndex

    setDragState({
      index: drag.index,
      x: drag.x,
      y: drag.y,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      width: drag.width,
      height: drag.height,
      targetIndex,
    })
  }

  const handlePointerUp = async (event) => {
      const drag = dragRef.current

      if (!drag) {
          return
      }

      const fromIndex = drag.index
      const toIndex = drag.targetIndex

      dragRef.current = null
      document.body.style.userSelect = ''

      try {
          event.currentTarget.releasePointerCapture(
              event.pointerId
          )
      } catch {
          // Pointer capture may already be released.
      }

      if (
          !Number.isInteger(toIndex) ||
          fromIndex === toIndex
      ) {
          setDragState(null)
          return
      }

      const targetElement =
          itemRefs.current.get(toIndex)

      if (!targetElement) {
          setDragState(null)

          await onMoveTrack(
              fromIndex,
              toIndex
          )

          return
      }

      const targetRect =
          targetElement.getBoundingClientRect()

      /*
      * Keep the dragged card floating while it
      * smoothly settles into the destination.
      */
      setDragState({
          index: fromIndex,
          x: targetRect.left + drag.offsetX,
          y: targetRect.top + drag.offsetY,
          offsetX: drag.offsetX,
          offsetY: drag.offsetY,
          width: drag.width,
          height: drag.height,
          targetIndex: toIndex,
          isDropping: true,
      })

      /*
      * Commit the actual queue reorder only after
      * the floating card has reached its destination.
      */
      window.setTimeout(async () => {
          await onMoveTrack(
              fromIndex,
              toIndex
          )

          setDragState(null)
      }, 220)
  }

  const handleToggleExpanded = () => {
    if (dragRef.current) {
      return
    }

    setIsExpanded((current) => !current)

    setIsToggleAnimating(false)

    requestAnimationFrame(() => {
      setIsToggleAnimating(true)

      toggleTimerRef.current =
        window.setTimeout(() => {
          setIsToggleAnimating(false)
        }, 360)
    })
  }

  /*
    Calculates how much a card should visually move
    to simulate the open drop space.

    The actual queue layout does NOT move.
    Only the visible cards translate.
  */
  const getItemShift = (index) => {
    const drag = dragState

    if (!drag || index === drag.index) {
      return 0
    }

    const step = drag.height + 6

    /*
      Dragging downward.

      Example:

      A
      B  <- dragging
      C
      D

      Move B after C:

      A
      C  <- moves upward
         [open space]
      D
      B  <- floating
    */
    if (
      drag.targetIndex > drag.index &&
      index > drag.index &&
      index <= drag.targetIndex
    ) {
      return -step
    }

    /*
      Dragging upward.

      Example:

      A
      B
      C  <- dragging

      Move C before A:

         [open space]
      A  <- moves downward
      B
      C  <- floating
    */
    if (
      drag.targetIndex < drag.index &&
      index >= drag.targetIndex &&
      index < drag.index
    ) {
      return step
    }

    return 0
  }

  const renderQueueItem = (track, index) => {
    const isDragging =
      dragState?.index === index

    const itemShift =
      getItemShift(index)

    const isHidden =
      !isExpanded && index >= 5

    return (
      <div
        key={`${track.title}-${index}`}
        ref={(element) => {
          if (element) {
            itemRefs.current.set(
              index,
              element
            )
          } else {
            itemRefs.current.delete(index)
          }
        }}
        className="queue-item-wrapper"
        style={
          isDragging
            ? {
                height: dragState.height,
              }
            : undefined
        }
      >
        <div
          className={`queue-item ${
            isDragging ? 'dragging' : ''
          } ${
            isHidden
              ? 'queue-item-hidden'
              : ''
          }`}
          style={
            isDragging
              ? {
                  position: 'fixed',
                  left:
                    dragState.x -
                    dragState.offsetX,
                  top:
                    dragState.y -
                    dragState.offsetY,
                  width:
                    dragState.width,
                  height:
                    dragState.height,
                  background: 'rgba(35, 35, 39, 0.94)',
                  zIndex: 1000,
                  pointerEvents: 'none',
                  cursor: 'grabbing',
                  transition: dragState.isDropping
                      ? 'left 220ms cubic-bezier(0.22, 1, 0.36, 1), top 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
                      : 'none',

                  transform: dragState.isDropping
                      ? 'scale(1)'
                      : 'scale(1.025)',
                }
              : {
                  transform:
                    itemShift !== 0
                      ? `translateY(${itemShift}px)`
                      : undefined,
                }
          }
          onPointerDown={(event) =>
            handlePointerDown(
              event,
              index
            )
          }
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="queue-item-number">
            {index + 1}
          </div>

          <div className="queue-item-art">
            <img
                src={track.artwork}
                alt=""
                onLoad={(event) => {
                    event.currentTarget.parentElement.classList.add(
                        'loaded'
                    )
                }}
            />
          </div>

          <div className="queue-item-info">
            <strong>
              {track.title}
            </strong>

            <span>
              {track.artist} · {track.album}
            </span>
          </div>


          <button
            type="button"
            className="queue-item-remove"
            onPointerDown={(event) => {
              event.stopPropagation()
            }}
            onClick={() => onRemoveTrack(index)}
            aria-label={`Remove ${track.title} from queue`}
          >
            ×
          </button>
        
        </div>
      </div>
    )
  }

  return (
    <section className="queue-panel">
      <div className="queue-header">
        <div>
          <p className="section-label"></p>

          <h2>
            Up next
          </h2>
        </div>

        {queue.length > 3 ? (
          <button
            type="button"
            className={`queue-toggle ${
              isToggleAnimating
                ? 'is-animating'
                : ''
            }`}
            aria-label={
              isExpanded
                ? 'Collapse queue'
                : 'Expand queue'
            }
            aria-expanded={isExpanded}
            onClick={
              handleToggleExpanded
            }
          >
            <span className="queue-count">
              {queue.length}
            </span>

            <span
              className={`queue-toggle-icon ${
                isExpanded
                  ? 'expanded'
                  : ''
              }`}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 9L12 15L18 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        ) : (
          <span className="queue-count">
            {queue.length}
          </span>
        )}
      </div>

      <div
        ref={listRef}
        className={`queue-list ${
          isExpanded
            ? 'queue-list-expanded'
            : 'queue-list-collapsed'
        }`}
      >
        {queue.length === 0 ? (
          <p className="queue-empty">
            Your queue is empty.
          </p>
        ) : (
          queue.map(
            (track, index) =>
              renderQueueItem(
                track,
                index
              )
          )
        )}
      </div>
    </section>
  )
}

export default QueuePanel