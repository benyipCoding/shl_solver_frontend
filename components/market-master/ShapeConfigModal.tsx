import React from "react";
import { X } from "lucide-react";
import { ColorPicker } from "./ColorPicker";

export const ShapeConfigModal = ({
  shapeConfigModal,
  setShapeConfigModal,
  updateShapeConfig,
  stateRef,
}: any) => {
  if (!shapeConfigModal.visible) return null;

  const shape = stateRef.current.lines.find(
    (l: any) => l.id === shapeConfigModal.shapeId
  );
  if (!shape) return null;

  return (
    <div className="fixed inset-0 z-110 bg-black/40 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-80 p-5">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-white tracking-wider">图形配置</h3>
          <button
            onClick={() =>
              setShapeConfigModal({ visible: false, shapeId: null })
            }
            className="text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-400">主颜色</label>
            <ColorPicker
              value={shape.config.color}
              onChange={(c: any) => updateShapeConfig("color", c)}
            />
          </div>
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-400">线条粗细</label>
            <select
              value={shape.config.lineWidth}
              onChange={(e) =>
                updateShapeConfig("lineWidth", Number(e.target.value))
              }
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm outline-none w-24"
            >
              <option value={1}>极细</option>
              <option value={1.5}>较细</option>
              <option value={2}>正常</option>
              <option value={3}>粗</option>
            </select>
          </div>
          {/* 斐波那契单档位颜色配置 */}
          {shape.type === "fib" && (
            <div className="space-y-2 mt-4 pt-4 border-t border-gray-800">
              <label className="text-sm text-gray-400 mb-2 block">
                刻度水平线颜色
              </label>
              {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((level, idx) => (
                <div
                  key={level}
                  className="flex justify-between items-center bg-gray-800/50 px-3 py-1.5 rounded"
                >
                  <span className="text-sm text-gray-300 font-mono">
                    Level: {level}
                  </span>
                  <ColorPicker
                    value={shape.config.fibColors[idx]}
                    onChange={(c: any) => {
                      const newColors = [...shape.config.fibColors];
                      newColors[idx] = c;
                      updateShapeConfig("fibColors", newColors);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShapeConfigModal({ visible: false, shapeId: null })}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  );
};
