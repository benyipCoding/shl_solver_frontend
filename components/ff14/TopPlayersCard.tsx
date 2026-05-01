"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRightLeft, Minus, Plus, Trophy } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ff14Styles, jobColorMap } from "@/constants/ff14";
import type {
  CharacterSummary,
  StaticText,
  TimelineTrack,
  TopJobComparison,
} from "@/interfaces/ff14";
import { formatNumber } from "@/utils/ff14";

interface TopPlayersCardProps {
  text: StaticText;
  selectedCharacter: CharacterSummary;
  topComparison: TopJobComparison;
}

type TimelineTooltipState = {
  actor: string;
  left: number;
  skill: string;
  time: string;
  top: number;
};

type TimelineGuideArea = "desktopOverview" | "desktopCompare" | "mobile";

type TimelineGuideState = {
  area: TimelineGuideArea;
  left: number;
};

type TimelineDragState = {
  element: HTMLDivElement;
  startClientX: number;
  startScrollLeft: number;
};

const ZOOM_LEVELS = [4, 6, 8, 10, 14, 20, 30, 40, 60] as const;
const EVENT_COLORS = [
  "#7ed7ff",
  "#ffbe7a",
  "#8df0ba",
  "#f39aff",
  "#f5e17c",
  "#9cb6ff",
  "#ff8f8f",
  "#87f2dd",
] as const;
const LEFT_COLUMN_WIDTH = 196;
const AXIS_HEIGHT = 46;
const TRACK_HEIGHT = 54;
const MOBILE_TRACK_HEIGHT = 52;
const TOOLTIP_WIDTH = 228;
const TOOLTIP_HEIGHT = 56;
const TOOLTIP_POINTER_OFFSET_X = 10;
const TOOLTIP_POINTER_OFFSET_Y = 8;
const TOOLTIP_ELEMENT_OFFSET_Y = 8;
const CAST_TAIL_MIN_WIDTH = 10;

const clampZoomIndex = (value: number) =>
  Math.min(Math.max(value, 0), ZOOM_LEVELS.length - 1);

const getNextZoomIndex = (currentIndex: number, direction: -1 | 1) =>
  clampZoomIndex(currentIndex + direction);

const formatTimelineTime = (valueMs: number) => {
  const totalSeconds = Math.max(Math.floor(valueMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getAbilityColor = (abilityKey: string) => {
  let hash = 0;

  for (let index = 0; index < abilityKey.length; index += 1) {
    hash = (hash * 31 + abilityKey.charCodeAt(index)) >>> 0;
  }

  return EVENT_COLORS[hash % EVENT_COLORS.length];
};

const getCastTailStyles = (
  castState: TimelineTrack["events"][number]["castState"]
) => {
  if (castState === "completed") {
    return {
      background:
        "linear-gradient(90deg, rgba(62,182,104,0.96), rgba(123,244,165,0.72))",
      boxShadow: "0 0 16px rgba(85, 225, 137, 0.34)",
    };
  }

  if (castState === "interrupted") {
    return {
      background:
        "linear-gradient(90deg, rgba(210,76,76,0.96), rgba(255,135,135,0.72))",
      boxShadow: "0 0 16px rgba(255, 115, 115, 0.32)",
    };
  }

  return null;
};

const sortTimelineTracks = (tracks: TimelineTrack[]) =>
  [...tracks].sort((left, right) => {
    if (left.isSelectedCharacter) {
      return -1;
    }

    if (right.isSelectedCharacter) {
      return 1;
    }

    return (
      (left.rank ?? Number.MAX_SAFE_INTEGER) -
      (right.rank ?? Number.MAX_SAFE_INTEGER)
    );
  });

const buildTrackBackgroundStyle = (
  pxPerSecond: number,
  gridStepSec: number,
  accentGridStepSec: number
) => ({
  backgroundImage:
    "linear-gradient(to right, rgba(143,177,230,0.08) 1px, transparent 1px), linear-gradient(to right, rgba(143,177,230,0.15) 1px, transparent 1px)",
  backgroundSize: `${Math.max(gridStepSec * pxPerSecond, 8)}px 100%, ${Math.max(accentGridStepSec * pxPerSecond, 8)}px 100%`,
});

interface EventMarkerProps {
  actor: string;
  event: TimelineTrack["events"][number];
  onClearTooltip: () => void;
  onShowTooltipFromElement: (
    skill: string,
    time: string,
    actor: string,
    element: HTMLButtonElement
  ) => void;
  onShowTooltipFromPointer: (
    skill: string,
    time: string,
    actor: string,
    clientX: number,
    clientY: number
  ) => void;
  pxPerSecond: number;
  size: number;
  topOffset: number;
}

const EventMarker = memo(function EventMarker({
  actor,
  event,
  onClearTooltip,
  onShowTooltipFromElement,
  onShowTooltipFromPointer,
  pxPerSecond,
  size,
  topOffset,
}: EventMarkerProps) {
  const timeLabel = formatTimelineTime(event.relativeMs);
  const hasAbilityIcon = Boolean(event.abilityIconUrl);
  const markerLeft = Math.max(
    (event.relativeMs / 1000) * pxPerSecond - size / 2,
    0
  );
  const castTailStyles = event.castState
    ? getCastTailStyles(event.castState)
    : null;
  const castTailWidth =
    castTailStyles && event.castDurationMs && event.castDurationMs > 0
      ? Math.max(
          (event.castDurationMs / 1000) * pxPerSecond,
          CAST_TAIL_MIN_WIDTH
        )
      : 0;
  const castTailHeight = Math.max(Math.round(size * 0.34), 8);

  return (
    <>
      {castTailStyles && castTailWidth > 0 ? (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${markerLeft + size / 2}px`,
            top: `${topOffset + size / 2 - castTailHeight / 2}px`,
            width: `${castTailWidth}px`,
            height: `${castTailHeight}px`,
            ...castTailStyles,
          }}
          aria-hidden
        />
      ) : null}

      <button
        key={event.id}
        type="button"
        draggable={false}
        className="absolute z-10 overflow-hidden rounded-sm border border-[rgba(255,255,255,0.16)] shadow-[0_0_12px_rgba(6,12,23,0.32)] transition-transform hover:scale-[1.08] focus-visible:scale-[1.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,255,255,0.35)]"
        style={{
          left: `${markerLeft}px`,
          top: `${topOffset}px`,
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: hasAbilityIcon
            ? "rgba(9,16,30,0.92)"
            : getAbilityColor(event.abilityKey),
        }}
        onMouseEnter={(mouseEvent) => {
          onShowTooltipFromPointer(
            event.skill,
            timeLabel,
            actor,
            mouseEvent.clientX,
            mouseEvent.clientY
          );
        }}
        onMouseLeave={onClearTooltip}
        onFocus={(focusEvent) => {
          onShowTooltipFromElement(
            event.skill,
            timeLabel,
            actor,
            focusEvent.currentTarget
          );
        }}
        onBlur={onClearTooltip}
        aria-label={`${actor} ${timeLabel} ${event.skill}`}
      >
        {event.abilityIconUrl ? (
          <Image
            src={event.abilityIconUrl}
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
            draggable={false}
            loading="lazy"
            width={size}
            height={size}
          />
        ) : null}
      </button>
    </>
  );
});

const TopPlayersCard = ({
  text,
  selectedCharacter,
  topComparison,
}: TopPlayersCardProps) => {
  const [zoomIndex, setZoomIndex] = useState(7);
  const [desktopCompareActorId, setDesktopCompareActorId] = useState("");
  const [mobileCompareActorId, setMobileCompareActorId] = useState("");
  const [timelineGuide, setTimelineGuide] = useState<TimelineGuideState | null>(
    null
  );
  const [tooltip, setTooltip] = useState<TimelineTooltipState | null>(null);
  const activeTimelineDragRef = useRef<TimelineDragState | null>(null);
  const dragBodyStyleRef = useRef<{
    cursor: string;
    userSelect: string;
  } | null>(null);
  const desktopTimelineRef = useRef<HTMLDivElement | null>(null);
  const mobileTimelineRef = useRef<HTMLDivElement | null>(null);
  const timelineTracks = useMemo(
    () => sortTimelineTracks(topComparison.timelineTracks),
    [topComparison.timelineTracks]
  );
  const selectedTimelineTrack = useMemo(
    () =>
      timelineTracks.find((track) => track.isSelectedCharacter) ??
      timelineTracks[0] ??
      null,
    [timelineTracks]
  );
  const referenceTimelineTracks = useMemo(
    () => timelineTracks.filter((track) => !track.isSelectedCharacter),
    [timelineTracks]
  );
  const activeDesktopCompareTrack = useMemo(
    () =>
      referenceTimelineTracks.find(
        (track) => track.actorId === desktopCompareActorId
      ) ?? null,
    [desktopCompareActorId, referenceTimelineTracks]
  );
  const activeMobileCompareTrack = useMemo(
    () =>
      referenceTimelineTracks.find(
        (track) => track.actorId === mobileCompareActorId
      ) ??
      referenceTimelineTracks[0] ??
      null,
    [mobileCompareActorId, referenceTimelineTracks]
  );
  const desktopCompareTracks = useMemo(
    () =>
      [selectedTimelineTrack, activeDesktopCompareTrack].filter(
        (track): track is TimelineTrack => Boolean(track)
      ),
    [activeDesktopCompareTrack, selectedTimelineTrack]
  );
  const mobileTimelineTracks = useMemo(
    () =>
      [selectedTimelineTrack, activeMobileCompareTrack].filter(
        (track): track is TimelineTrack => Boolean(track)
      ),
    [activeMobileCompareTrack, selectedTimelineTrack]
  );
  const isDesktopCompareMode = Boolean(activeDesktopCompareTrack);
  const pxPerSecond = ZOOM_LEVELS[zoomIndex];
  const tickStepSec =
    pxPerSecond >= 20 ? 1 : pxPerSecond >= 14 ? 2 : pxPerSecond >= 8 ? 5 : 10;
  const tickLabelStepSec = tickStepSec === 1 ? 5 : tickStepSec;
  const timelineWidth = Math.max(
    Math.ceil(topComparison.maxDurationMs / 1000) * pxPerSecond + 32,
    860
  );
  const timelineTicks = useMemo(() => {
    const totalSeconds = Math.max(
      Math.ceil(topComparison.maxDurationMs / 1000),
      1
    );
    const nextTicks: number[] = [];

    for (let second = 0; second <= totalSeconds; second += tickStepSec) {
      nextTicks.push(second);
    }

    if (nextTicks[nextTicks.length - 1] !== totalSeconds) {
      nextTicks.push(totalSeconds);
    }

    return nextTicks;
  }, [tickStepSec, topComparison.maxDurationMs]);
  const lastTimelineTick = timelineTicks[timelineTicks.length - 1] ?? 0;
  const hasTimelineEvents = timelineTracks.some(
    (track) => track.events.length > 0
  );
  const accentColor = jobColorMap[selectedCharacter.job] ?? "#8bc5ff";

  const stepZoom = useCallback((direction: -1 | 1) => {
    setZoomIndex((prev) => getNextZoomIndex(prev, direction));
  }, []);

  useEffect(() => {
    if (!hasTimelineEvents) {
      return;
    }

    const handleTimelineWheel = (wheelEvent: globalThis.WheelEvent) => {
      if (!wheelEvent.ctrlKey || wheelEvent.deltaY === 0) {
        return;
      }

      wheelEvent.preventDefault();

      stepZoom(wheelEvent.deltaY < 0 ? 1 : -1);
    };

    const timelineContainers = [
      desktopTimelineRef.current,
      mobileTimelineRef.current,
    ].filter((element): element is HTMLDivElement => Boolean(element));

    timelineContainers.forEach((element) => {
      element.addEventListener("wheel", handleTimelineWheel, {
        passive: false,
      });
    });

    return () => {
      timelineContainers.forEach((element) => {
        element.removeEventListener("wheel", handleTimelineWheel);
      });
    };
  }, [hasTimelineEvents, isDesktopCompareMode, stepZoom]);

  const clearTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const clearTimelineGuide = useCallback(() => {
    setTimelineGuide(null);
  }, []);

  const updateTimelineGuide = useCallback(
    (area: TimelineGuideArea, element: HTMLDivElement, clientX: number) => {
      if (activeTimelineDragRef.current) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const nextLeft = Math.min(
        Math.max(clientX - rect.left, 0),
        element.clientWidth
      );

      setTimelineGuide((currentGuide) => {
        if (
          currentGuide?.area === area &&
          Math.abs(currentGuide.left - nextLeft) < 0.5
        ) {
          return currentGuide;
        }

        return {
          area,
          left: nextLeft,
        };
      });
    },
    []
  );

  const openDesktopCompare = useCallback(
    (actorId: string) => {
      clearTooltip();
      clearTimelineGuide();
      setDesktopCompareActorId(actorId);
    },
    [clearTimelineGuide, clearTooltip]
  );

  const closeDesktopCompare = useCallback(() => {
    clearTooltip();
    clearTimelineGuide();
    setDesktopCompareActorId("");
  }, [clearTimelineGuide, clearTooltip]);

  useEffect(() => {
    if (!hasTimelineEvents) {
      return;
    }

    const stopTimelineDrag = () => {
      const activeDrag = activeTimelineDragRef.current;

      if (!activeDrag) {
        return;
      }

      activeDrag.element.style.cursor = "";

      if (typeof document !== "undefined" && dragBodyStyleRef.current) {
        document.body.style.cursor = dragBodyStyleRef.current.cursor;
        document.body.style.userSelect = dragBodyStyleRef.current.userSelect;
      }

      dragBodyStyleRef.current = null;
      activeTimelineDragRef.current = null;
    };

    const handleTimelineDragMove = (mouseEvent: MouseEvent) => {
      const activeDrag = activeTimelineDragRef.current;

      if (!activeDrag) {
        return;
      }

      const deltaX = mouseEvent.clientX - activeDrag.startClientX;
      activeDrag.element.scrollLeft = activeDrag.startScrollLeft - deltaX;
      mouseEvent.preventDefault();
    };

    const handleTimelineDragStart = (mouseEvent: MouseEvent) => {
      if (mouseEvent.button !== 0) {
        return;
      }

      const element = mouseEvent.currentTarget;

      if (!(element instanceof HTMLDivElement)) {
        return;
      }

      if (typeof document !== "undefined") {
        dragBodyStyleRef.current = {
          cursor: document.body.style.cursor,
          userSelect: document.body.style.userSelect,
        };
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
      }

      element.style.cursor = "grabbing";

      activeTimelineDragRef.current = {
        element,
        startClientX: mouseEvent.clientX,
        startScrollLeft: element.scrollLeft,
      };
      clearTooltip();
      clearTimelineGuide();
      mouseEvent.preventDefault();
    };

    const timelineContainers = [
      desktopTimelineRef.current,
      mobileTimelineRef.current,
    ].filter((element): element is HTMLDivElement => Boolean(element));

    timelineContainers.forEach((element) => {
      element.addEventListener("mousedown", handleTimelineDragStart);
    });

    window.addEventListener("mousemove", handleTimelineDragMove);
    window.addEventListener("mouseup", stopTimelineDrag);
    window.addEventListener("blur", stopTimelineDrag);

    return () => {
      timelineContainers.forEach((element) => {
        element.removeEventListener("mousedown", handleTimelineDragStart);
      });

      window.removeEventListener("mousemove", handleTimelineDragMove);
      window.removeEventListener("mouseup", stopTimelineDrag);
      window.removeEventListener("blur", stopTimelineDrag);
      stopTimelineDrag();
    };
  }, [
    clearTimelineGuide,
    clearTooltip,
    hasTimelineEvents,
    isDesktopCompareMode,
  ]);

  const clampTooltipPosition = useCallback((left: number, top: number) => {
    if (typeof window === "undefined") {
      return { left, top };
    }

    return {
      left: Math.min(
        Math.max(left, 12),
        window.innerWidth - TOOLTIP_WIDTH - 12
      ),
      top: Math.min(
        Math.max(top, 12),
        window.innerHeight - TOOLTIP_HEIGHT - 12
      ),
    };
  }, []);

  const showTooltipFromPointer = useCallback(
    (
      skill: string,
      time: string,
      actor: string,
      clientX: number,
      clientY: number
    ) => {
      if (activeTimelineDragRef.current) {
        return;
      }

      const nextPosition = clampTooltipPosition(
        clientX + TOOLTIP_POINTER_OFFSET_X,
        clientY + TOOLTIP_POINTER_OFFSET_Y
      );

      setTooltip((currentTooltip) => {
        const nextTooltip = {
          actor,
          left: nextPosition.left - Math.floor(window.innerWidth / 6),
          skill,
          time,
          top: nextPosition.top - Math.floor(window.innerWidth / 35),
        };

        if (
          currentTooltip?.actor === nextTooltip.actor &&
          currentTooltip?.left === nextTooltip.left &&
          currentTooltip?.skill === nextTooltip.skill &&
          currentTooltip?.time === nextTooltip.time &&
          currentTooltip?.top === nextTooltip.top
        ) {
          return currentTooltip;
        }

        return nextTooltip;
      });
    },
    [clampTooltipPosition]
  );

  const showTooltipFromElement = useCallback(
    (
      skill: string,
      time: string,
      actor: string,
      element: HTMLButtonElement
    ) => {
      if (activeTimelineDragRef.current) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const nextPosition = clampTooltipPosition(
        rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
        rect.top - TOOLTIP_HEIGHT - TOOLTIP_ELEMENT_OFFSET_Y
      );

      setTooltip((currentTooltip) => {
        const nextTooltip = {
          actor,
          left: nextPosition.left,
          skill,
          time,
          top: nextPosition.top,
        };

        if (
          currentTooltip?.actor === nextTooltip.actor &&
          currentTooltip?.left === nextTooltip.left &&
          currentTooltip?.skill === nextTooltip.skill &&
          currentTooltip?.time === nextTooltip.time &&
          currentTooltip?.top === nextTooltip.top
        ) {
          return currentTooltip;
        }

        return nextTooltip;
      });
    },
    [clampTooltipPosition]
  );

  return (
    <aside className={ff14Styles.card}>
      <div className={ff14Styles.cardHeader}>
        <h2>
          <Trophy size={18} />
          {text.top10Title} ({selectedCharacter.job})
        </h2>

        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            className={ff14Styles.detailBackButton}
            onClick={() => stepZoom(-1)}
            disabled={zoomIndex === 0}
            aria-label={text.timelineScale}
          >
            <Minus size={14} />
          </button>
          <span className="rounded-full border border-[rgba(126,173,249,0.36)] bg-[rgba(24,40,70,0.6)] px-3 py-1 text-[0.76rem] text-[#dce9ff]">
            {text.timelineScale} {pxPerSecond}px/s
          </span>
          <button
            type="button"
            className={ff14Styles.detailBackButton}
            onClick={() => stepZoom(1)}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            aria-label={text.timelineScale}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <p className="m-0 max-w-[78ch] text-[0.84rem] leading-[1.7] text-[#9fb9df]">
        {text.timelineHint}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[rgba(126,173,249,0.34)] bg-[rgba(28,47,82,0.45)] px-3 py-1 text-[0.76rem] text-[#dce9ff]">
          {text.timelineSampleLabel} {topComparison.sampleSize}/
          {topComparison.topPlayers.length || 10}
        </span>
        <span className="rounded-full border border-[rgba(126,173,249,0.24)] bg-[rgba(19,31,54,0.4)] px-3 py-1 text-[0.76rem] text-[#9fb9df]">
          {text.timelineSelfLabel} + Top 10
        </span>
      </div>

      {!hasTimelineEvents ? (
        <div className="mt-4 rounded-2xl border border-[rgba(126,173,249,0.24)] bg-[rgba(16,26,44,0.44)] px-4 py-3 text-[0.84rem] leading-[1.6] text-[#b9cdea]">
          {text.timelineEmpty}
        </div>
      ) : null}

      {hasTimelineEvents && !isDesktopCompareMode ? (
        <div
          ref={desktopTimelineRef}
          className="mt-4 overflow-x-auto rounded-[18px] border border-[rgba(124,156,210,0.22)] bg-[linear-gradient(180deg,rgba(9,16,30,0.88),rgba(14,23,39,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] max-[920px]:hidden cursor-grab active:cursor-grabbing"
        >
          <div className="min-w-max">
            <div className="flex">
              <div
                className="sticky left-0 z-20 shrink-0 border-r border-[rgba(105,130,170,0.28)] bg-[linear-gradient(180deg,rgba(13,22,39,0.97),rgba(11,18,31,0.97))] backdrop-blur-sm"
                style={{ width: `${LEFT_COLUMN_WIDTH}px` }}
              >
                <div
                  className="border-b border-[rgba(105,130,170,0.28)] px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[#9fb9df]"
                  style={{ height: `${AXIS_HEIGHT}px` }}
                >
                  {text.tablePlayer}
                </div>

                {timelineTracks.map((track) => {
                  const isClickable = !track.isSelectedCharacter;

                  return (
                    <div
                      key={`meta-${track.actorId}`}
                      className={`border-b border-[rgba(105,130,170,0.18)] px-2 py-1 last:border-b-0 ${
                        track.isSelectedCharacter
                          ? "bg-[rgba(52,84,138,0.16)]"
                          : "bg-[rgba(12,22,39,0.52)]"
                      }`}
                      style={{ height: `${TRACK_HEIGHT}px` }}
                    >
                      {isClickable ? (
                        <button
                          type="button"
                          className="group flex h-full w-full items-center gap-3 rounded-xl px-2 text-left transition-[background-color,box-shadow] hover:bg-[rgba(52,84,138,0.2)] hover:shadow-[inset_0_0_0_1px_rgba(150,196,255,0.14)] focus-visible:bg-[rgba(52,84,138,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(126,173,249,0.28)]"
                          onClick={() => openDesktopCompare(track.actorId)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[0.92rem] font-semibold text-[#edf4ff] transition-colors group-hover:text-white group-focus-visible:text-white">
                              {track.name}
                            </p>
                            <p className="m-0 mt-1 truncate text-[0.74rem] text-[#89a3cb] transition-colors group-hover:text-[#bfd6fb] group-focus-visible:text-[#bfd6fb]">
                              {formatNumber(track.rdps)} rDPS
                            </p>
                          </div>
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(126,173,249,0.22)] bg-[rgba(14,24,41,0.55)] text-[#89a3cb] transition-[border-color,color,background-color] group-hover:border-[rgba(165,204,255,0.6)] group-hover:bg-[rgba(34,58,99,0.45)] group-hover:text-[#edf4ff] group-focus-visible:border-[rgba(165,204,255,0.6)] group-focus-visible:bg-[rgba(34,58,99,0.45)] group-focus-visible:text-[#edf4ff]">
                            <ArrowRightLeft size={12} />
                          </span>
                        </button>
                      ) : (
                        <div className="flex h-full w-full items-center justify-between gap-3 rounded-xl px-2">
                          <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[0.92rem] font-semibold text-[#edf4ff]">
                              {track.name}
                            </p>
                            <p className="m-0 mt-1 truncate text-[0.74rem] text-[#89a3cb]">
                              {formatNumber(track.rdps)} rDPS
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-[rgba(126,173,249,0.28)] bg-[rgba(34,58,99,0.38)] px-2.5 py-1 text-[0.68rem] text-[#dce9ff]">
                            {text.timelineSelfLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                className="relative z-0 shrink-0"
                style={{ width: `${timelineWidth}px` }}
                onMouseMove={(mouseEvent) => {
                  updateTimelineGuide(
                    "desktopOverview",
                    mouseEvent.currentTarget,
                    mouseEvent.clientX
                  );
                }}
                onMouseLeave={clearTimelineGuide}
              >
                {timelineGuide?.area === "desktopOverview" ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[repeating-linear-gradient(to_bottom,rgba(191,214,251,0.88)_0_6px,transparent_6px_12px)] opacity-80"
                    style={{ left: `${timelineGuide.left}px` }}
                    aria-hidden
                  />
                ) : null}
                <div
                  className="relative overflow-hidden border-b border-[rgba(105,130,170,0.28)] bg-[rgba(25,38,64,0.52)]"
                  style={{ height: `${AXIS_HEIGHT}px` }}
                >
                  {timelineTicks.map((tick) => {
                    const shouldShowTickLabel =
                      tick === 0 ||
                      tick === lastTimelineTick ||
                      tick % tickLabelStepSec === 0;

                    return (
                      <div
                        key={`tick-${tick}`}
                        className="absolute inset-y-0 border-l border-[rgba(143,177,230,0.24)]"
                        style={{ left: `${tick * pxPerSecond}px` }}
                      >
                        {shouldShowTickLabel ? (
                          <span className="absolute left-2 top-2 text-[0.72rem] font-semibold tracking-[0.05em] text-[#dce9ff]">
                            {formatTimelineTime(tick * 1000)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {timelineTracks.map((track) => (
                  <div
                    key={track.actorId}
                    className={`relative overflow-hidden border-b border-[rgba(105,130,170,0.18)] last:border-b-0 ${
                      track.isSelectedCharacter
                        ? "bg-[rgba(52,84,138,0.12)]"
                        : "bg-[rgba(10,19,35,0.36)]"
                    }`}
                    style={{
                      height: `${TRACK_HEIGHT}px`,
                      ...buildTrackBackgroundStyle(
                        pxPerSecond,
                        tickStepSec,
                        tickLabelStepSec
                      ),
                    }}
                  >
                    {track.isSelectedCharacter ? (
                      <div
                        className="absolute inset-y-0 left-0 w-0.5"
                        style={{ backgroundColor: accentColor }}
                        aria-hidden
                      />
                    ) : null}

                    {track.events.map((event, index) => {
                      const size = Math.min(
                        Math.max(Math.round(pxPerSecond * 1.45), 14),
                        24
                      );
                      const topOffset = 10 + (index % 2) * 18;

                      return (
                        <EventMarker
                          key={event.id}
                          actor={track.name}
                          event={event}
                          onClearTooltip={clearTooltip}
                          onShowTooltipFromElement={showTooltipFromElement}
                          onShowTooltipFromPointer={showTooltipFromPointer}
                          pxPerSecond={pxPerSecond}
                          size={size}
                          topOffset={topOffset}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {hasTimelineEvents && isDesktopCompareMode ? (
        <div className="mt-4 space-y-3 max-[920px]:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(126,173,249,0.24)] bg-[rgba(16,26,44,0.44)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[rgba(126,173,249,0.28)] bg-[rgba(34,58,99,0.38)] px-2.5 py-1 text-[0.72rem] text-[#dce9ff]">
                {text.timelineSelfLabel}
              </span>
              {selectedTimelineTrack ? (
                <span className="rounded-full border border-[rgba(126,173,249,0.2)] bg-[rgba(20,35,60,0.45)] px-3 py-1 text-[0.78rem] text-[#edf4ff]">
                  {selectedTimelineTrack.name}
                </span>
              ) : null}
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(126,173,249,0.18)] bg-[rgba(13,22,39,0.6)] text-[#9fb9df]">
                <ArrowRightLeft size={14} />
              </span>
              {activeDesktopCompareTrack ? (
                <span className="rounded-full border border-[rgba(126,173,249,0.2)] bg-[rgba(20,35,60,0.45)] px-3 py-1 text-[0.78rem] text-[#edf4ff]">
                  {activeDesktopCompareTrack.name}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              className={ff14Styles.detailBackButton}
              onClick={closeDesktopCompare}
            >
              <ArrowLeft size={14} />
              {text.timelineBackToOverview}
            </button>
          </div>

          {referenceTimelineTracks.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {referenceTimelineTracks.map((track) => {
                const isActive =
                  activeDesktopCompareTrack?.actorId === track.actorId;

                return (
                  <button
                    key={`desktop-select-${track.actorId}`}
                    type="button"
                    className={`min-w-36 rounded-2xl border px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "border-[rgba(144,191,255,0.6)] bg-[rgba(48,79,136,0.28)] text-[#edf4ff]"
                        : "border-[rgba(126,173,249,0.24)] bg-[rgba(16,26,44,0.44)] text-[#9fb9df]"
                    }`}
                    onClick={() => openDesktopCompare(track.actorId)}
                  >
                    <span className="block truncate text-[0.82rem] font-semibold">
                      {track.name}
                    </span>
                    <span className="mt-1 block text-[0.72rem] opacity-80">
                      {formatNumber(track.rdps)} rDPS
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div
            ref={desktopTimelineRef}
            className="overflow-x-auto rounded-[18px] border border-[rgba(124,156,210,0.22)] bg-[linear-gradient(180deg,rgba(9,16,30,0.88),rgba(14,23,39,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] cursor-grab active:cursor-grabbing"
          >
            <div
              className="relative min-w-full"
              style={{ width: `${timelineWidth}px` }}
              onMouseMove={(mouseEvent) => {
                updateTimelineGuide(
                  "desktopCompare",
                  mouseEvent.currentTarget,
                  mouseEvent.clientX
                );
              }}
              onMouseLeave={clearTimelineGuide}
            >
              {timelineGuide?.area === "desktopCompare" ? (
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[repeating-linear-gradient(to_bottom,rgba(191,214,251,0.88)_0_6px,transparent_6px_12px)] opacity-80"
                  style={{ left: `${timelineGuide.left}px` }}
                  aria-hidden
                />
              ) : null}
              <div
                className="relative overflow-hidden border-b border-[rgba(105,130,170,0.28)] bg-[rgba(25,38,64,0.52)]"
                style={{ height: `${AXIS_HEIGHT}px` }}
              >
                {timelineTicks.map((tick) => {
                  const shouldShowTickLabel =
                    tick === 0 ||
                    tick === lastTimelineTick ||
                    tick % tickLabelStepSec === 0;

                  return (
                    <div
                      key={`desktop-compare-tick-${tick}`}
                      className="absolute inset-y-0 border-l border-[rgba(143,177,230,0.24)]"
                      style={{ left: `${tick * pxPerSecond}px` }}
                    >
                      {shouldShowTickLabel ? (
                        <span className="absolute left-2 top-2 text-[0.72rem] font-semibold tracking-[0.05em] text-[#dce9ff]">
                          {formatTimelineTime(tick * 1000)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {desktopCompareTracks.map((track) => (
                <div
                  key={`desktop-compare-track-${track.actorId}`}
                  className="border-b border-[rgba(105,130,170,0.18)] px-4 py-3 last:border-b-0"
                >
                  <div
                    className={`relative overflow-hidden rounded-xl border ${
                      track.isSelectedCharacter
                        ? "border-[rgba(126,173,249,0.32)] bg-[rgba(52,84,138,0.14)]"
                        : "border-[rgba(105,130,170,0.2)] bg-[rgba(10,19,35,0.4)]"
                    }`}
                    style={{
                      height: `${TRACK_HEIGHT}px`,
                      ...buildTrackBackgroundStyle(
                        pxPerSecond,
                        tickStepSec,
                        tickLabelStepSec
                      ),
                    }}
                  >
                    {track.isSelectedCharacter ? (
                      <div
                        className="absolute inset-y-0 left-0 w-0.5"
                        style={{ backgroundColor: accentColor }}
                        aria-hidden
                      />
                    ) : null}

                    {track.events.map((event, index) => {
                      const size = Math.min(
                        Math.max(Math.round(pxPerSecond * 1.45), 14),
                        24
                      );
                      const topOffset = 10 + (index % 2) * 18;

                      return (
                        <EventMarker
                          key={event.id}
                          actor={track.name}
                          event={event}
                          onClearTooltip={clearTooltip}
                          onShowTooltipFromElement={showTooltipFromElement}
                          onShowTooltipFromPointer={showTooltipFromPointer}
                          pxPerSecond={pxPerSecond}
                          size={size}
                          topOffset={topOffset}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {hasTimelineEvents ? (
        <div className="mt-4 hidden gap-3 max-[920px]:grid">
          <div className="rounded-2xl border border-[rgba(126,173,249,0.24)] bg-[rgba(16,26,44,0.44)] px-4 py-3 text-[0.82rem] leading-[1.6] text-[#b9cdea]">
            {text.timelineMobileHint}
          </div>

          {referenceTimelineTracks.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {referenceTimelineTracks.map((track) => {
                const isActive =
                  activeMobileCompareTrack?.actorId === track.actorId;

                return (
                  <button
                    key={`mobile-select-${track.actorId}`}
                    type="button"
                    className={`min-w-33 rounded-2xl border px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "border-[rgba(144,191,255,0.6)] bg-[rgba(48,79,136,0.28)] text-[#edf4ff]"
                        : "border-[rgba(126,173,249,0.24)] bg-[rgba(16,26,44,0.44)] text-[#9fb9df]"
                    }`}
                    onClick={() => setMobileCompareActorId(track.actorId)}
                  >
                    <span className="block truncate text-[0.8rem] font-semibold">
                      {track.name}
                    </span>
                    <span className="mt-1 block text-[0.7rem] opacity-80">
                      {formatNumber(track.rdps)} rDPS
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div
            ref={mobileTimelineRef}
            className="overflow-x-auto rounded-[18px] border border-[rgba(124,156,210,0.22)] bg-[linear-gradient(180deg,rgba(9,16,30,0.88),rgba(14,23,39,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] cursor-grab active:cursor-grabbing"
          >
            <div
              className="relative min-w-full"
              style={{
                width: `${Math.max(Math.round(topComparison.maxDurationMs / 1000) * pxPerSecond + 32, 560)}px`,
              }}
              onMouseMove={(mouseEvent) => {
                updateTimelineGuide(
                  "mobile",
                  mouseEvent.currentTarget,
                  mouseEvent.clientX
                );
              }}
              onMouseLeave={clearTimelineGuide}
            >
              {timelineGuide?.area === "mobile" ? (
                <div
                  className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[repeating-linear-gradient(to_bottom,rgba(191,214,251,0.88)_0_6px,transparent_6px_12px)] opacity-80"
                  style={{ left: `${timelineGuide.left}px` }}
                  aria-hidden
                />
              ) : null}
              <div
                className="relative overflow-hidden border-b border-[rgba(105,130,170,0.28)] bg-[rgba(25,38,64,0.52)]"
                style={{ height: `${AXIS_HEIGHT}px` }}
              >
                {timelineTicks.map((tick) => {
                  const shouldShowTickLabel =
                    tick === 0 ||
                    tick === lastTimelineTick ||
                    tick % tickLabelStepSec === 0;

                  return (
                    <div
                      key={`mobile-tick-${tick}`}
                      className="absolute inset-y-0 border-l border-[rgba(143,177,230,0.24)]"
                      style={{ left: `${tick * pxPerSecond}px` }}
                    >
                      {shouldShowTickLabel ? (
                        <span className="absolute left-2 top-2 text-[0.72rem] font-semibold tracking-[0.05em] text-[#dce9ff]">
                          {formatTimelineTime(tick * 1000)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {mobileTimelineTracks.map((track) => (
                <div
                  key={`mobile-track-${track.actorId}`}
                  className="border-b border-[rgba(105,130,170,0.18)] px-3 py-3 last:border-b-0"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[0.9rem] font-semibold text-[#edf4ff]">
                        {track.name}
                      </p>
                      <p className="m-0 mt-1 truncate text-[0.72rem] text-[#89a3cb]">
                        {formatNumber(track.rdps)} rDPS
                      </p>
                    </div>

                    {track.isSelectedCharacter ? (
                      <span className="shrink-0 rounded-full border border-[rgba(126,173,249,0.28)] bg-[rgba(34,58,99,0.38)] px-2.5 py-1 text-[0.68rem] text-[#dce9ff]">
                        {text.timelineSelfLabel}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={`relative overflow-hidden rounded-xl border ${
                      track.isSelectedCharacter
                        ? "border-[rgba(126,173,249,0.32)] bg-[rgba(52,84,138,0.14)]"
                        : "border-[rgba(105,130,170,0.2)] bg-[rgba(10,19,35,0.4)]"
                    }`}
                    style={{
                      height: `${MOBILE_TRACK_HEIGHT}px`,
                      ...buildTrackBackgroundStyle(
                        pxPerSecond,
                        tickStepSec,
                        tickLabelStepSec
                      ),
                    }}
                  >
                    {track.isSelectedCharacter ? (
                      <div
                        className="absolute inset-y-0 left-0 w-0.5"
                        style={{ backgroundColor: accentColor }}
                        aria-hidden
                      />
                    ) : null}

                    {track.events.map((event, index) => {
                      const size = Math.min(
                        Math.max(Math.round(pxPerSecond * 1.35), 14),
                        22
                      );
                      const topOffset = 9 + (index % 2) * 18;

                      return (
                        <EventMarker
                          key={event.id}
                          actor={track.name}
                          event={event}
                          onClearTooltip={clearTooltip}
                          onShowTooltipFromElement={showTooltipFromElement}
                          onShowTooltipFromPointer={showTooltipFromPointer}
                          pxPerSecond={pxPerSecond}
                          size={size}
                          topOffset={topOffset}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* <div className={ff14Styles.coachingBox}>
        <h3>{text.coachingTitle}</h3>
        <p>{text.coachingDesc1}</p>
        <p>{text.coachingDesc2}</p>
      </div> */}

      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 w-57 rounded-xl border border-[rgba(143,177,230,0.35)] bg-[rgba(9,16,30,0.96)] px-3 py-2 shadow-[0_18px_36px_rgba(6,12,23,0.48)]"
          style={{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }}
        >
          <p className="m-0 truncate text-[0.82rem] font-semibold text-[#f3f8ff]">
            {tooltip.skill}
          </p>
          <p className="m-0 mt-1 text-[0.72rem] text-[#a9c2e6]">
            {tooltip.actor} · {tooltip.time}
          </p>
        </div>
      ) : null}
    </aside>
  );
};

export default TopPlayersCard;
