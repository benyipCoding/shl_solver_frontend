import type {
  Dispatch,
  MouseEventHandler,
  RefObject,
  SetStateAction,
} from "react";
import type { Time } from "lightweight-charts";

import {
  CANDLE_TOOLTIP_OHLC_LABELS,
  formatCandleTooltipTime,
  type IndicatorConfig,
} from "./market-config";
import { TradeHistory } from "./TradeHistory";
import { TradeTerminal } from "./TradeTerminal";

type LegendData = {
  open: number;
  high: number;
  low: number;
  close: number;
  emas: Array<{ color: string; period: number; value: number }>;
  bollinger: {
    period: number;
    standardDeviation: number;
    middleColor: string;
    upperColor: string;
    lowerColor: string;
    middle: number;
    upper: number;
    lower: number;
  } | null;
  macd: number;
  signal: number;
  hist: number;
};

type CandleTooltip = {
  data: {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
  };
  left: number;
  top: number;
};

type MarketWorkspaceProps = {
  bottomPanelHeight: number;
  canPlaceOrder: boolean;
  candleTooltip: CandleTooltip | null;
  candleTooltipElRef: RefObject<HTMLDivElement | null>;
  chartContainerRef: RefObject<HTMLDivElement | null>;
  currentPrice: number;
  dataError: string;
  drawType: string;
  formatValue: (value: number | null | undefined) => string;
  handleAIReview: (trade?: unknown) => void;
  handleCloseMarket: (tradeId: unknown) => void;
  handlePlaceOrder: (type: "Buy" | "Sell") => void;
  hideCandleTooltip: () => void;
  indConfig: IndicatorConfig;
  isBottomPanelOpen: boolean;
  isDataLoading: boolean;
  isHistoryLoading: boolean;
  isMaximized: boolean;
  isRightPanelOpen: boolean;
  layoutRef: RefObject<HTMLDivElement | null>;
  legendData: LegendData | null;
  mainColumnRef: RefObject<HTMLDivElement | null>;
  mode: string;
  orderUnits: number;
  priceDecimals: number;
  rightPanelWidth: number;
  riskInputStep: string;
  setIsBottomPanelOpen: Dispatch<SetStateAction<boolean>>;
  setIsRightPanelOpen: Dispatch<SetStateAction<boolean>>;
  setOrderUnits: Dispatch<SetStateAction<number>>;
  setSlDistance: Dispatch<SetStateAction<number>>;
  setSlEnabled: Dispatch<SetStateAction<boolean>>;
  setTpDistance: Dispatch<SetStateAction<number>>;
  setTpEnabled: Dispatch<SetStateAction<boolean>>;
  slDistance: number;
  slEnabled: boolean;
  startBottomPanelResize: MouseEventHandler<HTMLDivElement>;
  startRightPanelResize: MouseEventHandler<HTMLDivElement>;
  subChartContainerRef: RefObject<HTMLDivElement | null>;
  symbol: string;
  toggleTradeVisibility: (tradeId: unknown) => void;
  totalCandles: number;
  tpDistance: number;
  tpEnabled: boolean;
  trades: unknown[];
};

export function MarketWorkspace({
  bottomPanelHeight,
  canPlaceOrder,
  candleTooltip,
  candleTooltipElRef,
  chartContainerRef,
  currentPrice,
  dataError,
  drawType,
  formatValue,
  handleAIReview,
  handleCloseMarket,
  handlePlaceOrder,
  hideCandleTooltip,
  indConfig,
  isBottomPanelOpen,
  isDataLoading,
  isHistoryLoading,
  isMaximized,
  isRightPanelOpen,
  layoutRef,
  legendData,
  mainColumnRef,
  mode,
  orderUnits,
  priceDecimals,
  rightPanelWidth,
  riskInputStep,
  setIsBottomPanelOpen,
  setIsRightPanelOpen,
  setOrderUnits,
  setSlDistance,
  setSlEnabled,
  setTpDistance,
  setTpEnabled,
  slDistance,
  slEnabled,
  startBottomPanelResize,
  startRightPanelResize,
  subChartContainerRef,
  symbol,
  toggleTradeVisibility,
  totalCandles,
  tpDistance,
  tpEnabled,
  trades,
}: MarketWorkspaceProps) {
  return (
    <div ref={layoutRef} className="relative flex flex-1 overflow-hidden">
      <div
        ref={mainColumnRef}
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="relative flex-1 bg-[#111827]">
          {isDataLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-950/70 text-sm text-blue-200 backdrop-blur-sm">
              正在加载真实 K 线数据...
            </div>
          )}
          {!isDataLoading && isHistoryLoading && (
            <div className="absolute right-4 top-3 z-10 rounded border border-blue-500/30 bg-gray-900/80 px-3 py-1.5 text-xs text-blue-200 backdrop-blur-sm">
              正在加载更早的历史 K 线 ({totalCandles.toLocaleString()} 根)...
            </div>
          )}
          {!isDataLoading && dataError && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-950/70 px-6 text-center text-sm text-red-300 backdrop-blur-sm">
              {dataError}
            </div>
          )}
          {legendData && (
            <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-2 overflow-hidden rounded border border-gray-700/50 bg-gray-900/70 px-2 py-1.5 font-mono text-[10px] backdrop-blur-sm sm:left-4 sm:top-3 sm:gap-4 sm:px-3 sm:text-xs">
              <div className="font-semibold tracking-wider text-gray-400">
                {symbol}
              </div>
              <div className="flex gap-2 border-r border-gray-600 pr-2 text-gray-400 sm:gap-3 sm:pr-4">
                {CANDLE_TOOLTIP_OHLC_LABELS.map(({ key, label }) => (
                  <span key={key} className={key === "close" ? "" : "hidden sm:inline"}>
                    {label[0]}{" "}
                    <span
                      className={
                        legendData.close >= legendData.open
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {formatValue(legendData[key])}
                    </span>
                  </span>
                ))}
              </div>
              <div className="hidden gap-3 sm:flex">
                {legendData.emas.map((ema) => (
                  <div
                    key={`${ema.period}-${ema.color}`}
                    className="font-semibold drop-shadow-md"
                    style={{ color: ema.color }}
                  >
                    EMA({ema.period}): {formatValue(ema.value)}
                  </div>
                ))}
                {legendData.bollinger && (
                  <div className="flex gap-2 font-semibold">
                    <span style={{ color: legendData.bollinger.upperColor }}>
                      BOLL({legendData.bollinger.period},
                      {legendData.bollinger.standardDeviation}) U:
                      {formatValue(legendData.bollinger.upper)}
                    </span>
                    <span style={{ color: legendData.bollinger.middleColor }}>
                      M:{formatValue(legendData.bollinger.middle)}
                    </span>
                    <span style={{ color: legendData.bollinger.lowerColor }}>
                      L:{formatValue(legendData.bollinger.lower)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "draw" && (
            <div className="pointer-events-none absolute left-4 top-12 z-10 rounded-full border border-blue-500 bg-blue-600/20 px-3 py-1.5 text-xs text-blue-400">
              画线模式 (
              {drawType === "line"
                ? "直线"
                : drawType === "rectangle"
                  ? "矩形"
                  : "斐波那契"}
              )
            </div>
          )}
          <div ref={chartContainerRef} className="absolute inset-0" />
          {candleTooltip?.data && (
            <div
              ref={candleTooltipElRef}
              className="absolute z-10 w-fit cursor-pointer overflow-hidden rounded-sm p-[2px]"
              style={{
                left: `${candleTooltip.left}px`,
                top: `${candleTooltip.top}px`,
                background:
                  "conic-gradient(#FFC876, #79FFF7, #9F53FF, #FF98E2, #FFC876)",
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                hideCandleTooltip();
              }}
            >
              <div className="w-fit rounded-sm bg-black p-2 text-white">
                <h1 className="mb-2 font-semibold">{symbol}</h1>
                <p className="mb-1 text-sm">
                  {formatCandleTooltipTime(candleTooltip.data.time)}
                </p>
                {CANDLE_TOOLTIP_OHLC_LABELS.map(({ key, label }) => (
                  <p className="pointer-events-none flex text-sm" key={key}>
                    <span className="w-14">{label}:</span>
                    <span>{formatValue(candleTooltip.data[key])}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {indConfig.macd.enabled && (
          <div className="relative h-36 shrink-0 border-t border-gray-800 bg-[#111827] sm:h-48">
            {legendData && (
              <div className="pointer-events-none absolute left-2 right-2 top-2 z-10 flex items-center gap-2 overflow-hidden rounded border border-gray-700/50 bg-gray-900/70 px-2 py-1.5 font-mono text-[10px] backdrop-blur-sm sm:left-4 sm:right-auto sm:gap-4 sm:px-3 sm:text-xs">
                <div className="font-semibold tracking-wider text-gray-400">
                  MACD ({indConfig.macd.fast},{indConfig.macd.slow},
                  {indConfig.macd.signal})
                </div>
                <div style={{ color: indConfig.macd.macdColor }}>
                  MACD: {formatValue(legendData.macd)}
                </div>
                <div style={{ color: indConfig.macd.signalColor }}>
                  Sig: {formatValue(legendData.signal)}
                </div>
                <div
                  className={
                    legendData.hist >= 0 ? "text-emerald-400" : "text-red-400"
                  }
                >
                  Hist: {formatValue(legendData.hist)}
                </div>
              </div>
            )}
            <div ref={subChartContainerRef} className="absolute inset-0" />
          </div>
        )}

        {isBottomPanelOpen && !isMaximized && (
          <div
            onMouseDown={startBottomPanelResize}
            className="hidden h-1.5 shrink-0 cursor-row-resize bg-transparent transition-colors hover:bg-blue-500/30 active:bg-blue-500/40 md:block"
            title="拖拽调整交易记录高度"
          />
        )}

        <TradeHistory
          isBottomPanelOpen={isBottomPanelOpen}
          setIsBottomPanelOpen={setIsBottomPanelOpen}
          trades={trades}
          currentPrice={currentPrice}
          priceDecimals={priceDecimals}
          toggleTradeVisibility={toggleTradeVisibility}
          handleCloseMarket={handleCloseMarket}
          handleAIReview={handleAIReview}
          isMaximized={isMaximized}
          panelHeight={bottomPanelHeight}
        />
      </div>

      {isRightPanelOpen && !isMaximized && (
        <div
          onMouseDown={startRightPanelResize}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-blue-500/30 active:bg-blue-500/40 md:block"
          title="拖拽调整交易终端宽度"
        />
      )}

      <TradeTerminal
        isRightPanelOpen={isRightPanelOpen}
        setIsRightPanelOpen={setIsRightPanelOpen}
        symbol={symbol}
        currentPrice={currentPrice}
        orderUnits={orderUnits}
        setOrderUnits={setOrderUnits}
        slEnabled={slEnabled}
        setSlEnabled={setSlEnabled}
        slDistance={slDistance}
        setSlDistance={setSlDistance}
        tpEnabled={tpEnabled}
        setTpEnabled={setTpEnabled}
        tpDistance={tpDistance}
        setTpDistance={setTpDistance}
        handlePlaceOrder={handlePlaceOrder}
        priceDecimals={priceDecimals}
        riskInputStep={riskInputStep}
        isMaximized={isMaximized}
        panelWidth={rightPanelWidth}
        canPlaceOrder={canPlaceOrder}
      />
    </div>
  );
}
