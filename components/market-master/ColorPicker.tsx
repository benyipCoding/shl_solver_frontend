import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PRESET_COLORS } from "./chart-utils";

const PICKER_WIDTH = 160;
const PICKER_HEIGHT = 116;
const PICKER_GAP = 8;
const VIEWPORT_PADDING = 12;

export const ColorPicker = ({ value, onChange }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<any>(null);
  const pickerRef = useRef<any>(null);
  const triggerRef = useRef<any>(null);
  const panelRef = useRef<any>(null);

  const updatePanelPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(rect.right - PICKER_WIDTH, VIEWPORT_PADDING),
      window.innerWidth - PICKER_WIDTH - VIEWPORT_PADDING
    );
    const openAbove = rect.top >= PICKER_HEIGHT + PICKER_GAP + VIEWPORT_PADDING;

    setPanelStyle({
      left,
      top: openAbove ? rect.top - PICKER_GAP : rect.bottom + PICKER_GAP,
      transform: openAbove ? "translateY(-100%)" : "none",
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (pickerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };

    if (!isOpen) return;

    updatePanelPosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen, updatePanelPosition]);

  return (
    <div className="relative inline-block" ref={pickerRef}>
      <div
        ref={triggerRef}
        className="w-6 h-6 rounded cursor-pointer border border-gray-600 shadow-sm hover:border-gray-400 transition-colors"
        style={{ backgroundColor: value || PRESET_COLORS[7] }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      />
      {isOpen &&
        panelStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed bg-gray-800 border border-gray-700 p-2 rounded-lg shadow-2xl grid grid-cols-4 gap-1.5 w-40"
            style={{
              left: panelStyle.left,
              top: panelStyle.top,
              transform: panelStyle.transform,
              zIndex: 150,
            }}
          >
            {PRESET_COLORS.map((c) => (
              <div
                key={c}
                className={`w-7 h-7 rounded cursor-pointer border-2 hover:scale-110 transition-transform ${value === c ? "border-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  onChange(c);
                  setIsOpen(false);
                }}
              />
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
