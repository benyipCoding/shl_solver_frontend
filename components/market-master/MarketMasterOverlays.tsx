import type { Dispatch, MouseEventHandler, SetStateAction } from "react";
import { ArrowDownToLine, ArrowUpToLine, CircleX, Settings, Trash } from "lucide-react";

import { AiReviewModal } from "./AiReviewModal";
import { IndicatorConfigModal } from "./IndicatorConfigModal";
import { ShapeConfigModal } from "./ShapeConfigModal";

type ChartContextMenu = {
  x: number;
  y: number;
  kind?: "shape" | "chart";
  shapeId?: string;
  /** Price under the pointer on the main chart (chart menu only). */
  price?: number | null;
} | null;

type PendingMenu = {
  enabled: boolean;
  disabledReason: string;
  buyKind: "limit" | "stop" | null;
  sellKind: "limit" | "stop" | null;
};

type MarketMasterOverlaysProps = {
  aiReviewModal: unknown;
  applyIndicatorConfig: () => void;
  canCloseAllOpenTrades: boolean;
  contextMenu: ChartContextMenu;
  draftConfig: unknown;
  handleAddDraftEma: () => void;
  handleIndDragStart: MouseEventHandler;
  handleMenuCloseAll: () => void;
  handleMenuPending: (side: "Buy" | "Sell") => void;
  pendingMenu: PendingMenu;
  handleMenuConfig: () => void;
  handleMenuDelete: () => void;
  handleRemoveDraftEma: (id: unknown) => void;
  handleUpdateDraftEma: (
    id: unknown,
    field: unknown,
    value: unknown
  ) => void;
  indConfig: unknown;
  indicatorModalPos: { x: number; y: number };
  isIndicatorModalOpen: boolean;
  priceDecimals: number;
  selectedIndTab: string;
  setAiReviewModal: Dispatch<SetStateAction<unknown>>;
  setDraftConfig: (value: unknown) => void;
  setIsIndicatorModalOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedIndTab: Dispatch<SetStateAction<string>>;
  setShapeConfigModal: Dispatch<SetStateAction<unknown>>;
  shapeConfigModal: unknown;
  stateRef: { current: unknown };
  updateShapeConfig: (field: unknown, value: unknown) => void;
};

export function MarketMasterOverlays({
  aiReviewModal,
  applyIndicatorConfig,
  canCloseAllOpenTrades,
  contextMenu,
  draftConfig,
  handleAddDraftEma,
  handleIndDragStart,
  handleMenuCloseAll,
  handleMenuPending,
  pendingMenu,
  handleMenuConfig,
  handleMenuDelete,
  handleRemoveDraftEma,
  handleUpdateDraftEma,
  indConfig,
  indicatorModalPos,
  isIndicatorModalOpen,
  priceDecimals,
  selectedIndTab,
  setAiReviewModal,
  setDraftConfig,
  setIsIndicatorModalOpen,
  setSelectedIndTab,
  setShapeConfigModal,
  shapeConfigModal,
  stateRef,
  updateShapeConfig,
}: MarketMasterOverlaysProps) {
  return (
    <>
      <AiReviewModal
        aiReviewModal={aiReviewModal}
        setAiReviewModal={setAiReviewModal}
        priceDecimals={priceDecimals}
      />

      {contextMenu && (
        <div
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-100 min-w-44 rounded-md border border-gray-700 bg-gray-800 py-1 shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {contextMenu.kind === "chart" ? (
            <>
            {(["Buy", "Sell"] as const).map((side) => {
              const kind = side === "Buy" ? pendingMenu.buyKind : pendingMenu.sellKind;
              const price = contextMenu.price;
              const disabled = !pendingMenu.enabled || price == null;
              return (
                <button
                  key={side}
                  type="button"
                  role="menuitem"
                  onClick={() => handleMenuPending(side)}
                  disabled={disabled}
                  title={disabled ? pendingMenu.disabledReason : "以鼠标所在价位新建挂单，可在弹窗中确认数量与止损止盈"}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent ${side === "Buy" ? "text-emerald-300" : "text-red-300"}`}
                >
                  {side === "Buy" ? <ArrowUpToLine size={14} /> : <ArrowDownToLine size={14} />}
                  <span>
                    {side === "Buy" ? "挂买单" : "挂卖单"}
                    {kind ? ` (${side} ${kind === "limit" ? "Limit" : "Stop"})` : ""}
                  </span>
                  {price != null && (
                    <span className="ml-auto font-mono text-xs text-gray-400">
                      {Number(price.toFixed(priceDecimals))}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="my-1 h-px bg-gray-700" />
            <button
              type="button"
              role="menuitem"
              onClick={handleMenuCloseAll}
              disabled={!canCloseAllOpenTrades}
              title={
                canCloseAllOpenTrades
                  ? "以当前市价平掉所有未平仓订单"
                  : "当前没有可平仓的订单"
              }
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 disabled:hover:bg-transparent"
            >
              <CircleX size={14} /> 平掉所有订单
            </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleMenuConfig}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                <Settings size={14} /> 样式配置
              </button>
              <div className="my-1 h-px bg-gray-700" />
              <button
                type="button"
                onClick={handleMenuDelete}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
              >
                <Trash size={14} /> 删除图形
              </button>
            </>
          )}
        </div>
      )}

      <ShapeConfigModal
        shapeConfigModal={shapeConfigModal}
        setShapeConfigModal={setShapeConfigModal}
        updateShapeConfig={updateShapeConfig}
        stateRef={stateRef}
      />

      <IndicatorConfigModal
        isIndicatorModalOpen={isIndicatorModalOpen}
        setIsIndicatorModalOpen={setIsIndicatorModalOpen}
        indicatorModalPos={indicatorModalPos}
        handleIndDragStart={handleIndDragStart}
        selectedIndTab={selectedIndTab}
        setSelectedIndTab={setSelectedIndTab}
        draftConfig={draftConfig}
        setDraftConfig={setDraftConfig}
        handleAddDraftEma={handleAddDraftEma}
        handleRemoveDraftEma={handleRemoveDraftEma}
        handleUpdateDraftEma={handleUpdateDraftEma}
        applyIndicatorConfig={applyIndicatorConfig}
        indConfig={indConfig}
      />
    </>
  );
}
