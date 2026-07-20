import React, { useState, useEffect, useRef } from 'react';

export default function DraggableGrid({
  items,
  onChange,
  renderItem,
  keyExtractor,
  gridStyle
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [translation, setTranslation] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const containerRef = useRef(null);
  const initialRectsRef = useRef([]);
  const draggedIndexRef = useRef(null);
  const hoveredIndexRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0, clientX: 0, clientY: 0 });
  const itemsRef = useRef([]);
  const rafRef = useRef(null);

  // Keep items ref updated to prevent stale closure in event handlers
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const handleStart = (e, index) => {
    // Ignore clicks on buttons/inputs
    const target = e.target;
    if (target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'INPUT') {
      return;
    }
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    const pageY = 'touches' in e ? e.touches[0].pageY : e.pageY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const container = containerRef.current;
    if (!container) return;
    
    // Cache the bounding boxes of all children in their initial static positions
    const children = Array.from(container.children);
    const rects = children.map(child => child.getBoundingClientRect());
    initialRectsRef.current = rects;
    draggedIndexRef.current = index;
    hoveredIndexRef.current = index;
    setDraggedIndex(index);
    setHoveredIndex(index);
    startPosRef.current = { x: pageX, y: pageY, clientX, clientY };
    setTranslation({ x: 0, y: 0 });
    setIsActive(true);
  };

  const handleMove = (e) => {
    if (draggedIndexRef.current === null) return;
    
    // Prevent scrolling while dragging
    if (e.cancelable) e.preventDefault();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    const pageY = 'touches' in e ? e.touches[0].pageY : e.pageY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    rafRef.current = requestAnimationFrame(() => {
      const deltaX = pageX - startPosRef.current.x;
      const deltaY = pageY - startPosRef.current.y;
      setTranslation({ x: deltaX, y: deltaY });
      
      // Determine which item the dragging item is currently hovering over
      let newHoveredIndex = draggedIndexRef.current;
      const rects = initialRectsRef.current;
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        // Check if mouse coordinates fall inside the initial bounding rect
        if (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        ) {
          newHoveredIndex = i;
          break;
        }
      }
      if (newHoveredIndex !== hoveredIndexRef.current) {
        hoveredIndexRef.current = newHoveredIndex;
        setHoveredIndex(newHoveredIndex);
      }
    });
  };

  const handleEnd = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const fromIdx = draggedIndexRef.current;
    const toIdx = hoveredIndexRef.current;
    
    if (fromIdx !== null && toIdx !== null) {
      const rects = initialRectsRef.current;
      const targetDeltaX = rects[toIdx].left - rects[fromIdx].left;
      const targetDeltaY = rects[toIdx].top - rects[fromIdx].top;
      
      setTranslation({ x: targetDeltaX, y: targetDeltaY });
      setIsSnapping(true);
      setIsActive(false);
      
      setTimeout(() => {
        if (fromIdx !== toIdx) {
          const reordered = [...itemsRef.current];
          const [draggedItem] = reordered.splice(fromIdx, 1);
          reordered.splice(toIdx, 0, draggedItem);
          onChange(reordered);
        }
        draggedIndexRef.current = null;
        hoveredIndexRef.current = null;
        setDraggedIndex(null);
        setHoveredIndex(null);
        setTranslation({ x: 0, y: 0 });
        setIsSnapping(false);
      }, 150); // 150ms smooth snap duration
    } else {
      draggedIndexRef.current = null;
      hoveredIndexRef.current = null;
      setDraggedIndex(null);
      setHoveredIndex(null);
      setTranslation({ x: 0, y: 0 });
      setIsActive(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '12px',
        position: 'relative',
        ...gridStyle
      }}
    >
      {items.map((item, index) => {
        const isDragged = index === draggedIndex;
        
        // Calculate the fluid shift vector for items gliding out of the way
        let shiftX = 0;
        let shiftY = 0;
        if (draggedIndex !== null && hoveredIndex !== null && !isDragged) {
          const rects = initialRectsRef.current;
          if (draggedIndex < hoveredIndex && index > draggedIndex && index <= hoveredIndex) {
            // Shift left/up to the position of index - 1
            if (rects[index] && rects[index - 1]) {
              shiftX = rects[index - 1].left - rects[index].left;
              shiftY = rects[index - 1].top - rects[index].top;
            }
          } else if (draggedIndex > hoveredIndex && index >= hoveredIndex && index < draggedIndex) {
            // Shift right/down to the position of index + 1
            if (rects[index] && rects[index + 1]) {
              shiftX = rects[index + 1].left - rects[index].left;
              shiftY = rects[index + 1].top - rects[index].top;
            }
          }
        }
        return (
          <div
            key={keyExtractor(item)}
            onMouseDown={(e) => handleStart(e, index)}
            onTouchStart={(e) => handleStart(e, index)}
            style={{
              position: 'relative',
              userSelect: 'none',
              touchAction: 'none',
              zIndex: isDragged ? 100 : 1,
              pointerEvents: isDragged ? 'none' : 'auto',
              transform: isDragged
                ? `translate3d(${translation.x}px, ${translation.y}px, 0) scale(${isSnapping ? 1 : 1.05})`
                : `translate3d(${shiftX}px, ${shiftY}px, 0) scale(1)`,
              transition: (isActive && !isDragged) 
                ? 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                : (isSnapping && isDragged)
                  ? 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)'
                  : 'none',
              boxShadow: (isDragged && !isSnapping) ? '0 12px 24px rgba(0,0,0,0.4)' : 'none',
              filter: (isDragged && !isSnapping) ? 'brightness(1.05)' : 'none',
            }}
          >
            {renderItem(item, index, isDragged)}
          </div>
        );
      })}
    </div>
  );
}
