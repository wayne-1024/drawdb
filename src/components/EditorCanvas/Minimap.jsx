import { useMemo, useRef, useState, useEffect } from "react";
import { useDiagram, useAreas, useNotes, useTransform, useCanvas, useSettings } from "../../hooks";
import { noteWidth, tableWidth, tableFieldHeight, tableHeaderHeight, tableColorStripHeight } from "../../data/constants";

export default function Minimap() {
  const { tables } = useDiagram();
  const { areas } = useAreas();
  const { notes } = useNotes();
  const { setTransform } = useTransform();
  const { canvas: { viewBox } } = useCanvas();
  const { settings } = useSettings();
  const minimapRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const MINIMAP_WIDTH = 240;
  const MINIMAP_HEIGHT = 160;
  const PADDING = 50;
  const MAX_VISIBLE_FIELDS = 15;

  const getRenderedTableHeight = (table) => {
    const shouldTruncate = table.fields.length > MAX_VISIBLE_FIELDS;
    const visibleFieldsCount = shouldTruncate ? MAX_VISIBLE_FIELDS : table.fields.length;
    return (
      visibleFieldsCount * tableFieldHeight +
      tableHeaderHeight +
      tableColorStripHeight +
      (shouldTruncate ? 32 : 0)
    );
  };

  const bounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    if (tables.length === 0 && areas.length === 0 && notes.length === 0) {
      return { x: 0, y: 0, width: 1000, height: 1000 };
    }

    tables.forEach((t) => {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + tableWidth);
      maxY = Math.max(maxY, t.y + getRenderedTableHeight(t));
    });

    areas.forEach((a) => {
      minX = Math.min(minX, a.x);
      minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x + a.width);
      maxY = Math.max(maxY, a.y + a.height);
    });

    notes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + noteWidth);
      maxY = Math.max(maxY, n.y + n.height);
    });

    return {
      x: minX - PADDING,
      y: minY - PADDING,
      width: maxX - minX + PADDING * 2,
      height: maxY - minY + PADDING * 2,
    };
  }, [tables, areas, notes]);

  const scale = Math.min(
    MINIMAP_WIDTH / bounds.width,
    MINIMAP_HEIGHT / bounds.height
  );
  
  const offsetX = (MINIMAP_WIDTH - bounds.width * scale) / 2;
  const offsetY = (MINIMAP_HEIGHT - bounds.height * scale) / 2;

  const viewportRect = {
    x: (viewBox.left - bounds.x) * scale + offsetX,
    y: (viewBox.top - bounds.y) * scale + offsetY,
    width: viewBox.width * scale,
    height: viewBox.height * scale,
  };

  const handlePointerDown = (e) => {
    setIsDragging(true);
    e.stopPropagation();
    e.preventDefault();
    updateTransform(e);
  };

  const updateTransform = (e) => {
    if (!minimapRef.current) return;
    
    const rect = minimapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const minimapX = x - offsetX;
    const minimapY = y - offsetY;
    
    const diagramX = minimapX / scale + bounds.x;
    const diagramY = minimapY / scale + bounds.y;
    
    setTransform((prev) => ({
        ...prev,
        pan: {
            x: diagramX,
            y: diagramY
        }
    }));
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    updateTransform(e);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    } else {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, bounds, scale, offsetX, offsetY, viewBox.width, viewBox.height, setTransform]);

  const bgColor = settings.mode === "light" ? "bg-white" : "bg-zinc-800";
  const borderColor = settings.mode === "light" ? "border-zinc-300" : "border-zinc-600";
  const rectFill = settings.mode === "light" ? "#e5e7eb" : "#3f3f46";
  const rectStroke = settings.mode === "light" ? "#9ca3af" : "#71717a";

  return (
    <div 
        ref={minimapRef}
        className={`absolute bottom-4 right-4 ${bgColor} border ${borderColor} shadow-lg rounded-lg overflow-hidden z-50 select-none`}
        style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
        onPointerDown={handlePointerDown}
    >
      <svg width="100%" height="100%">
        <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
            <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="transparent" />
            
            {areas.map(a => (
                <rect key={a.id} x={a.x} y={a.y} width={a.width} height={a.height} fill={a.color} opacity={0.3} />
            ))}
            
            {tables.map(t => (
                <rect key={t.id} x={t.x} y={t.y} width={tableWidth} height={getRenderedTableHeight(t)} fill={rectFill} stroke={rectStroke} />
            ))}
            
            {notes.map(n => (
                <rect key={n.id} x={n.x} y={n.y} width={noteWidth} height={n.height} fill={n.color} opacity={0.8} />
            ))}
        </g>
        
        <rect
            x={viewportRect.x}
            y={viewportRect.y}
            width={viewportRect.width}
            height={viewportRect.height}
            fill="rgba(59, 130, 246, 0.2)"
            stroke="#3b82f6"
            strokeWidth="2"
        />
      </svg>
    </div>
  );
}
