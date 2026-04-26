import React, { useEffect, useRef, useState } from "react";
import { PRESET_COLORS } from "./chart-utils";

export const ColorPicker = ({ value, onChange }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={pickerRef}>
      <div
        className="w-6 h-6 rounded cursor-pointer border border-gray-600 shadow-sm hover:border-gray-400 transition-colors"
        style={{ backgroundColor: value || PRESET_COLORS[7] }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      />
      {isOpen && (
        <div className="absolute z-150 bottom-full mb-2 right-0 bg-gray-800 border border-gray-700 p-2 rounded-lg shadow-2xl grid grid-cols-4 gap-1.5 w-40">
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
        </div>
      )}
    </div>
  );
};
