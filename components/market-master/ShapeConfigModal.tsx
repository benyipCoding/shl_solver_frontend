import React, { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { ColorPicker } from "./ColorPicker";
import {
  DEFAULT_VOLUME_PROFILE_SETTINGS,
  normalizeVolumeProfileSettings,
} from "./chart-utils";

export const ShapeConfigModal = ({
  shapeConfigModal,
  setShapeConfigModal,
  updateShapeConfig,
  stateRef,
}: any) => {
  const shape = stateRef.current.lines.find(
    (l: any) => l.id === shapeConfigModal.shapeId
  );
  const [profileSettings, setProfileSettings] = useState(
    DEFAULT_VOLUME_PROFILE_SETTINGS
  );

  useEffect(() => {
    if (shape?.type === "volumeProfile") {
      setProfileSettings(
        normalizeVolumeProfileSettings(shape.config?.profileSettings)
      );
    }
  }, [shapeConfigModal.shapeId, shapeConfigModal.visible]);

  if (!shapeConfigModal.visible) return null;
  if (!shape) return null;

  const updateProfileSetting = (field: string, value: any) => {
    const next = normalizeVolumeProfileSettings({
      ...profileSettings,
      [field]: value,
    });
    setProfileSettings(next);
    updateShapeConfig("profileSettings", next);
  };

  const resetProfileSettings = () => {
    const next = { ...DEFAULT_VOLUME_PROFILE_SETTINGS };
    setProfileSettings(next);
    updateShapeConfig("profileSettings", next);
  };

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/40 p-3">
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-80 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
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
          {shape.type === "volumeProfile" && (
            <div className="mt-5 space-y-4 border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">Volume Profile 参数</p>
                  <p className="mt-0.5 text-[11px] text-gray-500">修改后会实时更新当前剖面</p>
                </div>
                <button
                  type="button"
                  onClick={resetProfileSettings}
                  className="inline-flex items-center gap-1 rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-cyan-500 hover:text-cyan-300"
                >
                  <RotateCcw size={12} />
                  恢复默认
                </button>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-gray-300">价格分桶数量</label>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-cyan-300">
                    {profileSettings.binCount}
                  </span>
                </div>
                <select
                  value={profileSettings.binCount}
                  onChange={(event) =>
                    updateProfileSetting("binCount", Number(event.target.value))
                  }
                  className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-500"
                >
                  {[8, 12, 16, 24, 32, 40, 48].map((count) => (
                    <option key={count} value={count}>
                      {count} 桶
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] leading-4 text-gray-500">
                  桶数越多，价格分布越细；数据较少时建议使用较少桶数。
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-gray-300">价值区域</label>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-cyan-300">
                    {profileSettings.valueAreaPercent}%
                  </span>
                </div>
                <select
                  value={profileSettings.valueAreaPercent}
                  onChange={(event) =>
                    updateProfileSetting(
                      "valueAreaPercent",
                      Number(event.target.value)
                    )
                  }
                  className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-500"
                >
                  {[50, 60, 70, 80, 90, 100].map((percent) => (
                    <option key={percent} value={percent}>
                      {percent}% 成交量
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] leading-4 text-gray-500">
                  从 POC 向两侧扩展，直到覆盖设定比例的成交量。
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="volume-profile-width" className="text-sm text-gray-300">
                    柱状图最大宽度
                  </label>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-cyan-300">
                    {profileSettings.maxWidth}px
                  </span>
                </div>
                <input
                  id="volume-profile-width"
                  type="range"
                  min={80}
                  max={240}
                  step={10}
                  value={profileSettings.maxWidth}
                  onChange={(event) =>
                    updateProfileSetting("maxWidth", Number(event.target.value))
                  }
                  className="h-1.5 w-full cursor-pointer accent-cyan-500"
                />
                <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                  <span>80px</span>
                  <span>240px</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-2.5">
                  <span>
                    <span className="block text-sm text-gray-300">显示价值区域</span>
                    <span className="block text-[11px] text-gray-500">用高亮柱体区分主要成交量范围</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={profileSettings.showValueArea}
                    onChange={(event) =>
                      updateProfileSetting("showValueArea", event.target.checked)
                    }
                    className="h-4 w-4 accent-cyan-500"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-2.5">
                  <span>
                    <span className="block text-sm text-gray-300">突出 POC</span>
                    <span className="block text-[11px] text-gray-500">高亮成交量最大的价格分桶</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={profileSettings.showPoc}
                    onChange={(event) =>
                      updateProfileSetting("showPoc", event.target.checked)
                    }
                    className="h-4 w-4 accent-amber-400"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-800 bg-gray-800/40 px-3 py-2.5">
                  <span>
                    <span className="block text-sm text-gray-300">显示 POC / VAH / VAL</span>
                    <span className="block text-[11px] text-gray-500">显示价位标签并向右延伸水平线</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={profileSettings.showLevels}
                    onChange={(event) =>
                      updateProfileSetting("showLevels", event.target.checked)
                    }
                    className="h-4 w-4 accent-violet-400"
                  />
                </label>
              </div>
            </div>
          )}
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
