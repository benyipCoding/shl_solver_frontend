import React from "react";
import { X, Plus, Trash2, BarChart2 } from "lucide-react";
import { ColorPicker } from "./ColorPicker";

export const IndicatorConfigModal = ({
  isIndicatorModalOpen,
  setIsIndicatorModalOpen,
  indicatorModalPos,
  handleIndDragStart,
  selectedIndTab,
  setSelectedIndTab,
  draftConfig,
  setDraftConfig,
  handleAddDraftEma,
  handleRemoveDraftEma,
  handleUpdateDraftEma,
  applyIndicatorConfig,
  indConfig,
}: any) => {
  if (!isIndicatorModalOpen) return null;

  return (
    <div
      style={{
        left: indicatorModalPos.x,
        top: indicatorModalPos.y,
        position: "absolute",
      }}
      className="z-50 w-137.5 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
    >
      <div
        onMouseDown={handleIndDragStart}
        className="bg-gray-800 p-3 cursor-move flex items-center justify-between border-b border-gray-700"
      >
        <span className="text-sm font-bold text-gray-300 tracking-wider flex items-center gap-2">
          <BarChart2 size={16} className="text-blue-500" /> 指标配置中心
        </span>
        <button
          onClick={() => {
            setIsIndicatorModalOpen(false);
            setDraftConfig(indConfig);
          }}
          className="text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex h-72">
        <div className="w-32 border-r border-gray-800 bg-gray-900/50 p-2 space-y-1">
          <button
            onClick={() => setSelectedIndTab("EMA")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors font-medium ${
              selectedIndTab === "EMA"
                ? "bg-gray-800 text-blue-400 shadow-sm"
                : "text-gray-400 hover:bg-gray-800/50"
            }`}
          >
            EMA 均线
          </button>
          <button
            onClick={() => setSelectedIndTab("MACD")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors font-medium ${
              selectedIndTab === "MACD"
                ? "bg-gray-800 text-blue-400 shadow-sm"
                : "text-gray-400 hover:bg-gray-800/50"
            }`}
          >
            MACD
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto bg-[#111827]">
          {selectedIndTab === "EMA" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#111827] z-10 pb-2 border-b border-gray-800">
                <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                  已添加的均线 ({draftConfig.emas.length})
                </h3>
                <button
                  onClick={handleAddDraftEma}
                  className="text-xs bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/50 px-3 py-1 rounded transition-colors flex items-center gap-1"
                >
                  <Plus size={14} />
                  添加 EMA
                </button>
              </div>
              {draftConfig.emas.length === 0 && (
                <div className="text-sm text-gray-600 text-center py-8">
                  暂无配置的均线
                </div>
              )}
              {draftConfig.emas.map((ema: any) => (
                <div
                  key={ema.id}
                  className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 relative group hover:border-gray-600 transition-colors"
                >
                  <button
                    onClick={() => handleRemoveDraftEma(ema.id)}
                    className="absolute top-3 right-3 text-gray-500 hover:text-red-400 transition-colors"
                    title="移除该均线"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="grid grid-cols-2 gap-4 pr-6">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">
                        周期 (Period)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={ema.period}
                        onChange={(e) =>
                          handleUpdateDraftEma(
                            ema.id,
                            "period",
                            Number(e.target.value)
                          )
                        }
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 block mb-1">
                          粗细
                        </label>
                        <select
                          value={ema.lineWidth}
                          onChange={(e) =>
                            handleUpdateDraftEma(
                              ema.id,
                              "lineWidth",
                              Number(e.target.value)
                            )
                          }
                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm outline-none"
                        >
                          <option value={1}>极细</option>
                          <option value={1.5}>较细</option>
                          <option value={2}>正常</option>
                          <option value={3}>粗</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">
                          颜色
                        </label>
                        <ColorPicker
                          value={ema.color}
                          onChange={(c: any) =>
                            handleUpdateDraftEma(ema.id, "color", c)
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedIndTab === "MACD" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#111827] z-10 pb-2 border-b border-gray-800">
                <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                  MACD 振荡器
                </h3>
                {!draftConfig.macd.enabled ? (
                  <button
                    onClick={() =>
                      setDraftConfig((prev: any) => ({
                        ...prev,
                        macd: { ...prev.macd, enabled: true },
                      }))
                    }
                    className="text-xs bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 px-3 py-1 rounded transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} />
                    启用 MACD
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      setDraftConfig((prev: any) => ({
                        ...prev,
                        macd: { ...prev.macd, enabled: false },
                      }))
                    }
                    className="text-xs bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/50 px-3 py-1 rounded transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    移除 MACD
                  </button>
                )}
              </div>

              {draftConfig.macd.enabled ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase mb-2">
                      核心参数
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">
                          快线 (Fast)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={draftConfig.macd.fast}
                          onChange={(e) =>
                            setDraftConfig((prev: any) => ({
                              ...prev,
                              macd: {
                                ...prev.macd,
                                fast: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">
                          慢线 (Slow)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={draftConfig.macd.slow}
                          onChange={(e) =>
                            setDraftConfig((prev: any) => ({
                              ...prev,
                              macd: {
                                ...prev.macd,
                                slow: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">
                          信号 (Signal)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={draftConfig.macd.signal}
                          onChange={(e) =>
                            setDraftConfig((prev: any) => ({
                              ...prev,
                              macd: {
                                ...prev.macd,
                                signal: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white text-sm outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase mb-2">
                      线条颜色
                    </h4>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <ColorPicker
                          value={draftConfig.macd.macdColor}
                          onChange={(c: any) =>
                            setDraftConfig((prev: any) => ({
                              ...prev,
                              macd: { ...prev.macd, macdColor: c },
                            }))
                          }
                        />
                        <span className="text-xs text-gray-300">MACD 线</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ColorPicker
                          value={draftConfig.macd.signalColor}
                          onChange={(c: any) =>
                            setDraftConfig((prev: any) => ({
                              ...prev,
                              macd: { ...prev.macd, signalColor: c },
                            }))
                          }
                        />
                        <span className="text-xs text-gray-300">Signal 线</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 text-center py-8">
                  MACD 暂未启用
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-gray-800 bg-gray-800/80 flex justify-end gap-3">
        <button
          onClick={() => {
            setIsIndicatorModalOpen(false);
            setDraftConfig(indConfig);
          }}
          className="px-5 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          取消
        </button>
        <button
          onClick={applyIndicatorConfig}
          className="px-5 py-1.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-900/50"
        >
          确认应用
        </button>
      </div>
    </div>
  );
};
