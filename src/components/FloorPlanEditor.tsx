"use client";

import React, { useState } from "react";
import { Move, Maximize2, Layers, Check, RefreshCw, Layers3, CircleDot, Square, RectangleHorizontal } from "lucide-react";
import { updateAdminTableLayout } from "@/actions/admin";

interface TableData {
  id: string;
  number: number;
  capacity: number;
  status: string;
  floor: string | null;
  section: string | null;
  layoutX: number;
  layoutY: number;
  layoutShape: string;
  layoutWidth: number;
  layoutHeight: number;
}

interface FloorPlanEditorProps {
  initialTables: TableData[];
  adminUserId: string;
  onRefresh?: () => void;
}

export default function FloorPlanEditor({
  initialTables,
  adminUserId,
  onRefresh
}: FloorPlanEditorProps) {
  const [tables, setTables] = useState<TableData[]>(initialTables);
  const [selectedFloor, setSelectedFloor] = useState<string>("Ground Floor");
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const floors = ["Ground Floor", "First Floor", "Second Floor", "Outdoor", "VIP Section"];

  // Filter tables by active floor selection
  const filteredTables = tables.filter(t => (t.floor || "Ground Floor") === selectedFloor);

  // Drag handler start
  const handleDragStart = (e: React.MouseEvent, tableId: string, currentX: number, currentY: number) => {
    setActiveTableId(tableId);
    setDragOffset({
      x: e.clientX - currentX,
      y: e.clientY - currentY
    });
  };

  // Drag handler moving
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeTableId) return;

    // Calculate new relative coordinates bounded by a 600x450 grid canvas
    const nextX = Math.max(0, Math.min(520, e.clientX - dragOffset.x));
    const nextY = Math.max(0, Math.min(370, e.clientY - dragOffset.y));

    setTables(prev =>
      prev.map(t => (t.id === activeTableId ? { ...t, layoutX: nextX, layoutY: nextY } : t))
    );
  };

  // Release drag
  const handleDragEnd = () => {
    setActiveTableId(null);
  };

  // Resize selected table width & height
  const handleResize = (tableId: string, direction: "UP" | "DOWN") => {
    setTables(prev =>
      prev.map(t => {
        if (t.id !== tableId) return t;
        const scale = direction === "UP" ? 10 : -10;
        const nextW = Math.max(60, Math.min(180, t.layoutWidth + scale));
        const nextH = Math.max(60, Math.min(180, t.layoutHeight + scale));
        return { ...t, layoutWidth: nextW, layoutHeight: nextH };
      })
    );
  };

  // Toggle table shapes
  const handleToggleShape = (tableId: string, shape: "SQUARE" | "ROUND" | "RECTANGLE") => {
    setTables(prev =>
      prev.map(t => (t.id === tableId ? { ...t, layoutShape: shape } : t))
    );
  };

  // Save layout coordinates to DB
  const handleSaveLayout = async () => {
    setIsSaving(true);
    try {
      for (const t of tables) {
        await updateAdminTableLayout(t.id, {
          layoutX: t.layoutX,
          layoutY: t.layoutY,
          layoutWidth: t.layoutWidth,
          layoutHeight: t.layoutHeight,
          layoutShape: t.layoutShape,
          floor: t.floor || selectedFloor
        }, adminUserId);
      }
      if (onRefresh) onRefresh();
      alert("Layout plan saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save layout.");
    } finally {
      setIsSaving(false);
    }
  };

  // Get table status colors
  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case "FREE":
      case "AVAILABLE":
        return "border-emerald-600 bg-emerald-950/20 text-emerald-400";
      case "OCCUPIED":
      case "PREPARING":
      case "READY":
        return "border-red-600 bg-red-950/20 text-red-400";
      case "RESERVED":
        return "border-[#baa47f] bg-[#baa47f]/10 text-[#baa47f]";
      case "CLEANING":
        return "border-blue-600 bg-blue-950/20 text-blue-400";
      default:
        return "border-zinc-700 bg-zinc-950 text-zinc-400";
    }
  };

  return (
    <div className="bg-[#140b0c] p-5 rounded-xl border border-[#251416] w-full flex flex-col gap-4 shadow-soft">
      {/* Floor selection header */}
      <div className="flex justify-between items-center flex-wrap gap-2 border-b border-[#201011] pb-3">
        <div className="flex gap-1.5 flex-wrap">
          {floors.map(f => (
            <button
              key={f}
              onClick={() => setSelectedFloor(f)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition ${
                selectedFloor === f
                  ? "bg-[#871b30] text-white"
                  : "bg-[#0d0506] text-zinc-400 hover:text-white border border-[#201011]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={handleSaveLayout}
          disabled={isSaving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
        >
          {isSaving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Save Floor Layout
        </button>
      </div>

      {/* DRAG CANVAS AREA */}
      <div
        className="w-full h-[450px] bg-[#0d0506] border border-[#201011] rounded-xl relative overflow-hidden select-none cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        style={{
          backgroundImage: "radial-gradient(#251416 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px"
        }}
      >
        {filteredTables.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-zinc-650">
            <Layers3 className="w-12 h-12 text-zinc-800 mb-2" />
            <span className="text-[10px] uppercase font-bold tracking-widest">No tables mapped to this section</span>
          </div>
        ) : (
          filteredTables.map(table => {
            const isSelected = activeTableId === table.id;
            const borderColors = getStatusColor(table.status);

            return (
              <div
                key={table.id}
                style={{
                  left: `${table.layoutX}px`,
                  top: `${table.layoutY}px`,
                  width: `${table.layoutWidth}px`,
                  height: `${table.layoutHeight}px`,
                  position: "absolute"
                }}
                className={`border-2 flex flex-col justify-between p-2 shadow-soft hover:shadow-gold transition cursor-grab ${borderColors} ${
                  table.layoutShape === "ROUND" ? "rounded-full" : "rounded-xl"
                } ${isSelected ? "border-dashed scale-102" : "border-solid"}`}
              >
                {/* Controls (visible when hovering/active) */}
                <div className="flex justify-between items-center w-full">
                  <div
                    onMouseDown={(e) => handleDragStart(e, table.id, table.layoutX, table.layoutY)}
                    className="p-1 hover:bg-[#201011] rounded cursor-move text-zinc-400 hover:text-white"
                    title="Drag Table"
                  >
                    <Move className="w-3.5 h-3.5" />
                  </div>
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleResize(table.id, "UP")}
                      className="text-[9px] bg-zinc-950 border border-zinc-850 px-1 font-bold text-zinc-300 hover:text-white rounded"
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleResize(table.id, "DOWN")}
                      className="text-[9px] bg-zinc-950 border border-zinc-850 px-1 font-bold text-zinc-300 hover:text-white rounded"
                    >
                      -
                    </button>
                  </div>
                </div>

                {/* Table Core Label */}
                <div className="text-center flex flex-col justify-center items-center flex-1">
                  <span className="text-xs font-mono font-extrabold text-white">T{table.number}</span>
                  <span className="text-[8px] text-zinc-500 font-bold">Pax {table.capacity}</span>
                </div>

                {/* Shape selectors */}
                <div className="flex justify-center gap-1.5 pb-1">
                  <button
                    onClick={() => handleToggleShape(table.id, "SQUARE")}
                    className={`p-0.5 rounded ${table.layoutShape === "SQUARE" ? "text-white" : "text-zinc-650"}`}
                  >
                    <Square className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => handleToggleShape(table.id, "ROUND")}
                    className={`p-0.5 rounded ${table.layoutShape === "ROUND" ? "text-white" : "text-zinc-650"}`}
                  >
                    <CircleDot className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => handleToggleShape(table.id, "RECTANGLE")}
                    className={`p-0.5 rounded ${table.layoutShape === "RECTANGLE" ? "text-white" : "text-zinc-650"}`}
                  >
                    <RectangleHorizontal className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
