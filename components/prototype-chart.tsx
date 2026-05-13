"use client";

import {
  useMemo,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Reading } from "@/lib/types/backend-data-model";
import type { ChatAsHighlight, FrontendPrototype } from "@/lib/types/frontend-data-model";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { usePrototypeNavigation } from "@/hooks/use-prototype-navigation";

export interface SelectionRange {
  startDate: Date;
  endDate: Date;
}

export interface PrototypeChartHandle {
  clearSelection: () => void;
}

interface PrototypeChartProps {
  prototypeName: string;
  readings: Reading[];
  highlights: ChatAsHighlight[];
  domain?: [number, number];
  windowSpan: number;
  isLoading?: boolean;
  onSelectionComplete?: (range: SelectionRange) => void;
  getPrototype: () => FrontendPrototype | undefined;
  setPrototype: (callback: (prototype: FrontendPrototype) => FrontendPrototype) => void;
}

function formatTime(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "p.m." : "a.m.";
  const h = hours % 12 || 12;
  return `${h.toString().padStart(2, "0")}:${minutes} ${period}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function formatTooltipLabel(value: number | string) {
  return new Date(Number(value)).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValueWithSuffix(value: number, suffix: string) {
  return `${value.toFixed(4)}${suffix}`;
}

const POWER_LINE_COLOR = "var(--color-chart-1)";
const IRRADIANCE_LINE_COLOR = "var(--color-chart-2)";
const POWER_SUFFIX = " W";
const IRRADIANCE_SUFFIX = " W/m²";
const CHART_MARGIN = { top: 5, right: 20, bottom: 5, left: 0 };
const WINDOW_HOURS = 2;

// ── Custom X-axis tick component ──────────────────────────────────────────
// Renders a two-line label (time + date) for boundary ticks (priority 3),
// and a single-line label for day transitions (priority 2) and step marks
// (priority 1).

interface XTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
  tickPriorityMap: Map<number, number>;
}

function XTick({ x = 0, y = 0, payload, tickPriorityMap }: XTickProps) {
  if (!payload) return null;
  const ms = payload.value;
  const priority = tickPriorityMap.get(ms) ?? 1;
  const date = new Date(ms);

  const baseStyle: React.CSSProperties = {
    fontSize: 11,
    fill: "currentColor",
    dominantBaseline: "hanging",
  };

  if (priority === 3) {
    // Two-line: time on top, date below
    return (
      <g transform={`translate(${x},${y + 4})`}>
        <text textAnchor="middle" style={baseStyle}>
          {formatTime(date)}
        </text>
        <text textAnchor="middle" dy={14} style={{ ...baseStyle, opacity: 0.6 }}>
          {formatDate(date)}
        </text>
      </g>
    );
  }

  if (priority === 2) {
    // Single-line date label for day transitions
    return (
      <g transform={`translate(${x},${y + 4})`}>
        <text textAnchor="middle" style={baseStyle}>
          {formatDate(date)}
        </text>
      </g>
    );
  }

  // Priority 1: step mark — single-line time
  return (
    <g transform={`translate(${x},${y + 4})`}>
      <text textAnchor="middle" style={baseStyle}>
        {formatTime(date)}
      </text>
    </g>
  );
}

export const PrototypeChart = forwardRef<
  PrototypeChartHandle,
  PrototypeChartProps
>(function PrototypeChart(
  {
    prototypeName,
    readings,
    highlights,
    domain,
    windowSpan,
    isLoading = false,
    onSelectionComplete,
    getPrototype,
    setPrototype,
  },
  ref,
) {
  const router = useRouter();
  const [showPower, setShowPower] = useState(true);
  const [showIrradiance, setShowIrradiance] = useState(true);
  const [avgWindow, setAvgWindow] = useState<5 | 10 | 15 | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeLabelRef = useRef<string | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartLabelRef = useRef<string | null>(null);
  const dragCurrentLabelRef = useRef<string | null>(null);

  const frozenSelectionRef = useRef<{ x1: number; x2: number } | null>(null);
  const highlightRectsRef = useRef<{ x1: number; x2: number; chatId: string }[]>([]);

  const {
    handleScrollLeft: onScrollLeft,
    handleScrollRight: onScrollRight,
    handleZoomIn: onZoomIn,
    handleZoomOut: onZoomOut,
    chartTimeStep,
  } = usePrototypeNavigation(getPrototype, setPrototype);

  const chartData = useMemo(() => {
    return readings.map((r) => ({
      time: new Date(r.date).getTime(),
      timeLabel: formatTime(r.date),
      date: r.date instanceof Date ? r.date : new Date(r.date),
      power: Number((r.voltage * r.current).toFixed(4)),
      irradiance: Number(r.irradiance.toFixed(4)),
    }));
  }, [readings]);

  const avgSegments = useMemo(() => {
    if (!avgWindow || !chartData.length) return [];
    const windowMs = avgWindow * 60 * 1000;
    const first = chartData[0].time;
    const last = chartData[chartData.length - 1].time;
    const segments: { startTime: number; endTime: number; value: number }[] = [];

    for (let start = first; start < last; start += windowMs) {
      const end = start + windowMs;
      const inWindow = chartData.filter((d) => d.time >= start && d.time < end);
      if (!inWindow.length) continue;
      const avg = inWindow.reduce((sum, d) => sum + d.power, 0) / inWindow.length;
      segments.push({ startTime: start, endTime: end, value: avg });
    }
    return segments;
  }, [chartData, avgWindow]);
  
  const timeLabelToDate = useMemo(() => {
    const map = new Map<string, Date>();
    chartData.forEach((d) => map.set(String(d.time), d.date));
    return map;
  }, [chartData]);

  const avatarPositions = useMemo(() => {
    if (!chartData.length) return [];
    const minTime = chartData[0].time;
    const maxTime = chartData[chartData.length - 1].time;
    const range = maxTime - minTime;
    return highlights.map((h) => {
      const start = new Date(h.start_date).getTime();
      const end = new Date(h.end_date).getTime();
      const center = (start + end) / 2;
      const percent = ((center - minTime) / range) * 100;
      return {
        chatId: h.chat,
        percent: Math.max(2, Math.min(98, percent)),
        profilePicture: h.creator_profile_picture,
      };
    });
  }, [highlights, chartData]);

  // ── Canvas drawing ──────────────────────────────────────────────────────

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const rect of highlightRectsRef.current) {
      const left = Math.min(rect.x1, rect.x2);
      const width = Math.abs(rect.x2 - rect.x1);
      if (width < 1) continue;
      ctx.fillStyle = "rgba(59,130,246,0.18)";
      ctx.fillRect(left, 0, width, canvas.height);
      ctx.strokeStyle = "rgba(59,130,246,0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(left + 0.5, 0.5, width - 1, canvas.height - 1);
    }

    const sel = frozenSelectionRef.current;
    if (sel) {
      const left = Math.min(sel.x1, sel.x2);
      const width = Math.abs(sel.x2 - sel.x1);
      if (width >= 2) {
        ctx.fillStyle = "rgba(251,146,60,0.22)";
        ctx.fillRect(left, 0, width, canvas.height);
        ctx.strokeStyle = "rgba(251,146,60,0.75)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(left + 0.5, 0.5, width - 1, canvas.height - 1);
      }
    }
  }, []);

  const clearSelection = useCallback(() => {
    frozenSelectionRef.current = null;
    redrawCanvas();
  }, [redrawCanvas]);

  useImperativeHandle(ref, () => ({ clearSelection }), [clearSelection]);

  // ── Map highlight timestamps → pixel x positions ──────────────────────

  const computeHighlightRects = useCallback(() => {
    const container = containerRef.current;
    if (!container || !chartData.length) {
      highlightRectsRef.current = [];
      return;
    }

    const containerWidth = container.clientWidth;
    const minTime = chartData[0].time;
    const maxTime = chartData[chartData.length - 1].time;
    const range = maxTime - minTime;
    if (range === 0) return;

    const plotLeft = CHART_MARGIN.left;
    const plotRight = containerWidth - CHART_MARGIN.right;
    const plotWidth = plotRight - plotLeft;

    highlightRectsRef.current = highlights.map((h) => {
      const startMs = new Date(h.start_date).getTime();
      const endMs = new Date(h.end_date).getTime();
      const x1 = plotLeft + ((startMs - minTime) / range) * plotWidth;
      const x2 = plotLeft + ((endMs - minTime) / range) * plotWidth;
      return { x1, x2, chatId: h.chat };
    });
  }, [chartData, highlights]);

  // ── Canvas sizing + initial highlight rects ───────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const sync = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      computeHighlightRects();
      redrawCanvas();
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, [computeHighlightRects, redrawCanvas]);

  useEffect(() => {
    computeHighlightRects();
    redrawCanvas();
  }, [computeHighlightRects, redrawCanvas]);

  // ── Stable refs for closure safety ─────────────────────────────────────

  const onSelectionCompleteRef = useRef(onSelectionComplete);
  useEffect(() => {
    onSelectionCompleteRef.current = onSelectionComplete;
  }, [onSelectionComplete]);

  const timeLabelToDateRef = useRef(timeLabelToDate);
  useEffect(() => {
    timeLabelToDateRef.current = timeLabelToDate;
  }, [timeLabelToDate]);

  // ── Native DOM drag listeners ─────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onMouseDown(e: MouseEvent) {
      if (!activeLabelRef.current) return;
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX - container!.getBoundingClientRect().left;
      dragStartLabelRef.current = activeLabelRef.current;
      dragCurrentLabelRef.current = activeLabelRef.current;
      frozenSelectionRef.current = null;
      redrawCanvas();
      container!.style.cursor = "crosshair";
    }

    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      if (activeLabelRef.current)
        dragCurrentLabelRef.current = activeLabelRef.current;
      const currentX = e.clientX - container!.getBoundingClientRect().left;
      frozenSelectionRef.current = { x1: dragStartXRef.current, x2: currentX };
      redrawCanvas();
      container!.style.cursor = "col-resize";
    }

    function onMouseUp(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      container!.style.cursor = "crosshair";

      const currentX = e.clientX - container!.getBoundingClientRect().left;
      frozenSelectionRef.current = { x1: dragStartXRef.current, x2: currentX };
      redrawCanvas();

      const startLabel = dragStartLabelRef.current;
      const endLabel = activeLabelRef.current ?? dragCurrentLabelRef.current;
      dragStartLabelRef.current = null;
      dragCurrentLabelRef.current = null;

      if (!startLabel || !endLabel) return;
      const startDate = timeLabelToDateRef.current.get(startLabel);
      const endDate = timeLabelToDateRef.current.get(endLabel);
      if (!startDate || !endDate || startDate.getTime() === endDate.getTime())
        return;
      const [sd, ed] =
        startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
      onSelectionCompleteRef.current?.({ startDate: sd, endDate: ed });
    }

    function onMouseLeave() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      frozenSelectionRef.current = null;
      redrawCanvas();
      container!.style.cursor = "crosshair";
      dragStartLabelRef.current = null;
      dragCurrentLabelRef.current = null;
    }

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseup", onMouseUp);
    container.addEventListener("mouseleave", onMouseLeave);
    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [redrawCanvas]);

  const handleRechartsMouseMove = useCallback((e: any) => {
    if (e?.activeLabel != null) activeLabelRef.current = String(e.activeLabel);
  }, []);

  const handleRechartsMouseLeave = useCallback(() => {
    activeLabelRef.current = null;
  }, []);

  function handleHighlightClick(chatId: string) {
    router.push(`/chat/${chatId}`);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLElement>) {
    if (frozenSelectionRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const x = e.clientX - canvas.getBoundingClientRect().left;
    const hit = highlightRectsRef.current.find(
      (r) => x >= Math.min(r.x1, r.x2) && x <= Math.max(r.x1, r.x2),
    );
    if (hit) handleHighlightClick(hit.chatId);
  }

  const [domainMin, domainMax] = useMemo(() => {
    if (domain) return domain;
    const max = chartData.length
      ? chartData[chartData.length - 1].time
      : Date.now();
    const min = max - WINDOW_HOURS * 60 * 60 * 1000;
    return [min, max];
  }, [chartData, domain]);

  // ── X-axis ticks ──────────────────────────────────────────────────────
  // Three tiers of labels (highest wins when two ticks collide):
  //   3 = time boundary (left and right edges) — two-line: time + date
  //   2 = day transition (midnight) — single-line date
  //   1 = step mark (every chartTimeStep hours) — single-line time
  // A tick is suppressed if a higher-priority tick falls within
  // MIN_TICK_GAP_MS of it.

  const xTicks = useMemo(() => {
    if (!chartTimeStep) return;

    const stepMs = chartTimeStep * 60 * 60 * 1000
    const MIN_TICK_GAP_MS = stepMs * 0.4

    type Tick = { ms: number; priority: number }
    const ticks: Tick[] = []

    // Tier 3: time boundaries (left and right edges)
    ticks.push({ ms: domainMin, priority: 3 })
    ticks.push({ ms: domainMax, priority: 3 })

    // Tier 2: day transitions (midnights) within the domain
    const startOfFirstDay = new Date(domainMin)
    startOfFirstDay.setHours(0, 0, 0, 0)
    let midnight = startOfFirstDay.getTime() + 24 * 60 * 60 * 1000
    while (midnight < domainMax) {
      if (midnight > domainMin) ticks.push({ ms: midnight, priority: 2 })
      midnight += 24 * 60 * 60 * 1000
    }

    // Tier 1: step marks — align to the nearest step boundary before domainMax
    const stepOrigin = domainMax
    for (let ms = stepOrigin; ms > domainMin; ms -= stepMs) {
      ticks.push({ ms, priority: 1 })
    }

    // Sort ascending, then deduplicate: keep highest priority within gap
    ticks.sort((a, b) => a.ms - b.ms)

    const kept: Tick[] = []
    for (const tick of ticks) {
      const lastKept = kept[kept.length - 1]
      if (lastKept && Math.abs(tick.ms - lastKept.ms) < MIN_TICK_GAP_MS) {
        if (tick.priority > lastKept.priority) kept[kept.length - 1] = tick
      } else {
        kept.push(tick)
      }
    }

    return kept
  }, [domainMin, domainMax, chartTimeStep])

  const xTickPriorityMap = useMemo(() => {
    if (!xTicks) return;

    const map = new Map<number, number>()
    xTicks.forEach((t) => map.set(t.ms, t.priority))
    return map
  }, [xTicks])

  // Passed as a prop so XTick doesn't need to close over a stale map
  const renderXTick = useCallback(
    (props: any) => <XTick {...props} tickPriorityMap={xTickPriorityMap} />,
    [xTickPriorityMap],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-card-foreground">
              {prototypeName}
            </h2>
            {chartData.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Haz clic y arrastra para comentar
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={showPower}
                onCheckedChange={(checked) => setShowPower(Boolean(checked))}
                disabled={isLoading}
                style={{
                  borderColor: POWER_LINE_COLOR,
                  color: POWER_LINE_COLOR,
                }}
              />
              <span
                className="inline-flex items-center gap-2"
                style={{ color: POWER_LINE_COLOR }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: POWER_LINE_COLOR }}
                />
                Mostrar potencia
              </span>
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={showIrradiance}
                onCheckedChange={(checked) => setShowIrradiance(Boolean(checked))}
                disabled={isLoading}
                style={{
                  borderColor: IRRADIANCE_LINE_COLOR,
                  color: IRRADIANCE_LINE_COLOR,
                }}
              />
              <span
                className="inline-flex items-center gap-2"
                style={{ color: IRRADIANCE_LINE_COLOR }}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: IRRADIANCE_LINE_COLOR }}
                />
                Mostrar irradiancia
              </span>
            </label>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Promedio:</span>
              {([5, 10, 15] as const).map((min) => (
                <button
                  key={min}
                  onClick={() => setAvgWindow(avgWindow === min ? null : min)}
                  className={`rounded px-2 py-1 border text-xs transition-colors ${
                    avgWindow === min
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {min} min
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onZoomIn}
                disabled={isLoading || !onZoomIn}
                className="h-8 w-8 p-0"
                title="Acercar"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onZoomOut}
                disabled={isLoading || !onZoomOut}
                className="h-8 w-8 p-0"
                title="Alejar"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onScrollLeft}
                disabled={isLoading || !onScrollLeft}
                className="h-8 w-8 p-0"
                title="Desplazar izquierda"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onScrollRight}
                disabled={isLoading || !onScrollRight}
                className="h-8 w-8 p-0"
                title="Desplazar derecha"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative h-64 select-none"
          style={{ cursor: "crosshair" }}
          onClick={handleCanvasClick}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 z-10"
            style={{ pointerEvents: "none" }}
          />

          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[2px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={CHART_MARGIN}
              onMouseMove={handleRechartsMouseMove}
              onMouseLeave={handleRechartsMouseLeave}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/50"
              />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={[domainMin, domainMax]}
                ticks={xTicks?.map((t) => t.ms)}
                tick={renderXTick}
                height={36}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                domain={readings.length === 0 ? [0, 1000] : [0, "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  borderColor: "var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--color-card-foreground)" }}
                labelFormatter={(label) => formatTooltipLabel(label)}
                formatter={(value, name) => {
                  const numericValue = Number(value);
                  const suffix =
                    name === "Potencia" ? POWER_SUFFIX : IRRADIANCE_SUFFIX;
                  return [formatValueWithSuffix(numericValue, suffix), name];
                }}
                content={(props) => {
                  if (!props.active || !props.payload?.length) return null;
                  const timeMs = Number(props.label);
                  const seg = avgSegments.find(
                    (s) => timeMs >= s.startTime && timeMs <= s.endTime
                  );
                  return (
                    <div style={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                    }}>
                      <p style={{ color: "var(--color-card-foreground)", marginBottom: 4 }}>
                        {new Date(timeMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {props.payload.map((entry: any) => (
                        <p key={entry.name} style={{ color: entry.stroke, margin: "2px 0" }}>
                          {entry.name}: {Number(entry.value).toFixed(4)}{entry.name === "Potencia" ? " W" : " W/m²"}
                        </p>
                      ))}
                      {seg && (
                        <p style={{ color: "#6b7280", marginTop: 4, borderTop: "1px solid var(--color-border)", paddingTop: 4 }}>
                          Prom {avgWindow}min: {seg.value.toFixed(3)}W
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              {showPower && (
                <Line
                  type="monotone"
                  dataKey="power"
                  stroke={POWER_LINE_COLOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: POWER_LINE_COLOR }}
                  name="Potencia"
                  isAnimationActive={false}
                />
              )}
              {showIrradiance && (
                <Line
                  type="monotone"
                  dataKey="irradiance"
                  stroke={IRRADIANCE_LINE_COLOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: IRRADIANCE_LINE_COLOR }}
                  name="Irradiancia"
                  isAnimationActive={false}
                />
              )}
              {showPower && avgSegments.map((seg, i) => (
                <ReferenceLine
                  key={i}
                  segment={[
                    { x: seg.startTime, y: seg.value },
                    { x: seg.endTime, y: seg.value },
                  ]}
                  stroke="#6b7280"
                  strokeDasharray="6 3"
                  strokeWidth={2}
                  label={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {avatarPositions.length > 0 && (
        <div className="relative h-10 mx-4">
          {avatarPositions.map((ap) => (
            <button
              key={ap.chatId}
              className="absolute -translate-x-1/2 transition-transform hover:scale-110"
              style={{ left: `${ap.percent}%` }}
              onClick={() => handleHighlightClick(ap.chatId)}
              aria-label="Ver chat"
            >
              <Avatar className="size-8 border-2 border-card">
                <AvatarImage src={ap.profilePicture} alt="" />
                <AvatarFallback className="text-[10px]">?</AvatarFallback>
              </Avatar>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
