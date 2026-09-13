import type { Dispatch, MouseEventHandler, SetStateAction } from "react";
import { Settings, Trash } from "lucide-react";

import { AiReviewModal } from "./AiReviewModal";
import { IndicatorConfigModal } from "./IndicatorConfigModal";
import { ShapeConfigModal } from "./ShapeConfigModal";

type ShapeContextMenu = {
  x: number;
  y: number;
  shapeId?: string;
} | null;

type MarketMasterOverlaysProps = {
  aiReviewModal: unknown;
  applyIndicatorConfig: () => void;
  contextMenu: ShapeContextMenu;
  draftConfig: unknown;
  handleAddDraftEma: () => void;
  handleIndDragStart: MouseEventHandler;
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
  contextMenu,
  draftConfig,
  handleAddDraftEma,
  handleIndDragStart,
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
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-100 w-36 rounded-md border border-gray-700 bg-gray-800 py-1 shadow-2xl"
        >
          <button
            onClick={handleMenuConfig}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <Settings size={14} /> 样式配置
          </button>
          <div className="my-1 h-px bg-gray-700" />
          <button
            onClick={handleMenuDelete}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
          >
            <Trash size={14} /> 删除图形
          </button>
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
