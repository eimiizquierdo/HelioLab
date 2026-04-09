"use client"

import { useMemo, useRef, useCallback, useEffect, useImperativeHandle, forwardRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { Reading } from "@/lib/types/backend-types"
import type { ChatAsHighlight } from "@/lib/types/frontend-types"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react"

export interface SelectionRange {
  startDate: Date
  endDate: Date
}

export interface PrototypeChartHandle {
  clearSelection: () => void
}

interface PrototypeChartProps {
  prototypeName: string
  readings: Reading[]
  highlights: ChatAsHighlight[]
  onSelectionComplete?: (range: SelectionRange) => void
  onTimeWindowChange?: (timeWindow: { start: Date; end: Date }) => void
}

function formatTime(date: Date) {
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const period = hours >= 12 ? "p.m." : "a.m."
  const h = hours % 12 || 12
  return `${h.toString().padStart(2, "0")}:${minutes} ${period}`
}

function formatTooltipLabel(value: number | string) {
  return new Date(Number(value)).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatValueWithSuffix(value: number, suffix: string) {
  return `${value.toFixed(4)}${suffix}`
}

const POWER_LINE_COLOR = "var(--color-chart-1)"
const IRRADIANCE_LINE_COLOR = "var(--color-chart-2)"
const POWER_SUFFIX = " W"
const IRRADIANCE_SUFFIX = " W/m²"
const CHART_MARGIN = { top: 5, right: 20, bottom: 5, left: 0 }
const WINDOW_HOURS = 2

export const PrototypeChart = forwardRef<PrototypeChartHandle, PrototypeChartProps>(
  function PrototypeChart({ prototypeName, readings, highlights, onSelectionComplete, onTimeWindowChange }, ref) {
    const router = useRouter()
    const [showPower, setShowPower] = useState(true)
    const [showIrradiance, setShowIrradiance] = useState(true)
    const [timeWindow, setTimeWindow] = useState<{ start: Date; end: Date } | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const activeLabelRef = useRef<string | null>(null)

    const isDraggingRef = useRef(false)
    const dragStartXRef = useRef(0)
    const dragStartLabelRef = useRef<string | null>(null)
    const dragCurrentLabelRef = useRef<string | null>(null)

    // Frozen orange selection (pixels)
    const frozenSelectionRef = useRef<{ x1: number; x2: number } | null>(null)

    // Highlight pixel ranges (blue) — recomputed whenever readings or highlights change
    const highlightRectsRef = useRef<{ x1: number; x2: number; chatId: string }[]>([])

    const chartData = useMemo(() => {
      const allData = readings.map((r) => ({
        time: new Date(r.date).getTime(),
        timeLabel: formatTime(r.date),
        date: r.date instanceof Date ? r.date : new Date(r.date),
        power: Number((r.voltage * r.current).toFixed(4)),
        irradiance: Number(r.irradiance.toFixed(4)),
      }))

      if (!timeWindow) return allData

      return allData.filter((d) => d.date >= timeWindow.start && d.date <= timeWindow.end)
    }, [readings, timeWindow])
    // Initialize time window when readings change
    useEffect(() => {
      if (chartData.length > 0) {
        const latestTime = chartData[chartData.length - 1].date
        const startTime = new Date(latestTime.getTime() - WINDOW_HOURS * 60 * 60 * 1000)
        const newTimeWindow = { start: startTime, end: latestTime }
        setTimeWindow(newTimeWindow)
        onTimeWindowChange?.(newTimeWindow)
      }
    }, [chartData, onTimeWindowChange])
  const timeLabelToDate = useMemo(() => {
    const map = new Map<string, Date>()
    chartData.forEach((d) => map.set(String(d.time), d.date))
    return map
  }, [chartData])
    // Time navigation functions
    const zoomIn = useCallback(() => {
      if (!timeWindow) return
      const duration = timeWindow.end.getTime() - timeWindow.start.getTime()
      const newDuration = duration * 0.8 // Zoom in by 20%
      const center = (timeWindow.start.getTime() + timeWindow.end.getTime()) / 2
      const newStart = new Date(center - newDuration / 2)
      const newEnd = new Date(center + newDuration / 2)
      const newTimeWindow = { start: newStart, end: newEnd }
      setTimeWindow(newTimeWindow)
      onTimeWindowChange?.(newTimeWindow)
    }, [timeWindow, onTimeWindowChange])

    const zoomOut = useCallback(() => {
      if (!timeWindow) return
      const duration = timeWindow.end.getTime() - timeWindow.start.getTime()
      const newDuration = duration * 1.25 // Zoom out by 25%
      const center = (timeWindow.start.getTime() + timeWindow.end.getTime()) / 2
      const newStart = new Date(center - newDuration / 2)
      const newEnd = new Date(center + newDuration / 2)
      const newTimeWindow = { start: newStart, end: newEnd }
      setTimeWindow(newTimeWindow)
      onTimeWindowChange?.(newTimeWindow)
    }, [timeWindow, onTimeWindowChange])

    const scrollLeft = useCallback(() => {
      if (!timeWindow) return
      const duration = timeWindow.end.getTime() - timeWindow.start.getTime()
      const shift = duration * 0.2 // Scroll by 20% of window
      const newStart = new Date(timeWindow.start.getTime() - shift)
      const newEnd = new Date(timeWindow.end.getTime() - shift)
      const newTimeWindow = { start: newStart, end: newEnd }
      setTimeWindow(newTimeWindow)
      onTimeWindowChange?.(newTimeWindow)
    }, [timeWindow, onTimeWindowChange])

    const scrollRight = useCallback(() => {
      if (!timeWindow) return
      const duration = timeWindow.end.getTime() - timeWindow.start.getTime()
      const shift = duration * 0.2 // Scroll by 20% of window
      const newStart = new Date(timeWindow.start.getTime() + shift)
      const newEnd = new Date(timeWindow.end.getTime() + shift)
      const newTimeWindow = { start: newStart, end: newEnd }
      setTimeWindow(newTimeWindow)
      onTimeWindowChange?.(newTimeWindow)
    }, [timeWindow, onTimeWindowChange])
    const avatarPositions = useMemo(() => {
      if (!chartData.length) return []
      const minTime = chartData[0].time
      const maxTime = chartData[chartData.length - 1].time
      const range = maxTime - minTime
      return highlights.map((h) => {
        const start = new Date(h.start_date).getTime()
        const end = new Date(h.end_date).getTime()
        const center = (start + end) / 2
        const percent = ((center - minTime) / range) * 100
        return {
          chatId: h.chat,
          percent: Math.max(2, Math.min(98, percent)),
          profilePicture: h.creator_profile_picture,
        }
      })
    }, [highlights, chartData])

    // ── Canvas drawing ──────────────────────────────────────────────────────

    // Redraws the entire canvas: blue highlights first, orange selection on top
    const redrawCanvas = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")!
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Blue highlight rects
      for (const rect of highlightRectsRef.current) {
        const left = Math.min(rect.x1, rect.x2)
        const width = Math.abs(rect.x2 - rect.x1)
        if (width < 1) continue
        ctx.fillStyle = "rgba(59,130,246,0.18)"        // blue-500 @ 18%
        ctx.fillRect(left, 0, width, canvas.height)
        ctx.strokeStyle = "rgba(59,130,246,0.55)"
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.strokeRect(left + 0.5, 0.5, width - 1, canvas.height - 1)
      }

      // Orange frozen / live selection on top
      const sel = frozenSelectionRef.current
      if (sel) {
        const left = Math.min(sel.x1, sel.x2)
        const width = Math.abs(sel.x2 - sel.x1)
        if (width >= 2) {
          ctx.fillStyle = "rgba(251,146,60,0.22)"
          ctx.fillRect(left, 0, width, canvas.height)
          ctx.strokeStyle = "rgba(251,146,60,0.75)"
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 3])
          ctx.strokeRect(left + 0.5, 0.5, width - 1, canvas.height - 1)
        }
      }
    }, [])

    const clearSelection = useCallback(() => {
      frozenSelectionRef.current = null
      redrawCanvas()
    }, [redrawCanvas])

    useImperativeHandle(ref, () => ({ clearSelection }), [clearSelection])

    // ── Map highlight timestamps → pixel x positions ──────────────────────
    // Called after resize or when highlights/readings change

    const computeHighlightRects = useCallback(() => {
      const container = containerRef.current
      if (!container || !chartData.length) {
        highlightRectsRef.current = []
        return
      }

      const containerWidth = container.clientWidth
      const minTime = chartData[0].time
      const maxTime = chartData[chartData.length - 1].time
      const range = maxTime - minTime
      if (range === 0) return

      // Recharts reserves left margin pixels before the plot area starts
      const plotLeft = CHART_MARGIN.left
      const plotRight = containerWidth - CHART_MARGIN.right
      const plotWidth = plotRight - plotLeft

      highlightRectsRef.current = highlights.map((h) => {
        const startMs = new Date(h.start_date).getTime()
        const endMs = new Date(h.end_date).getTime()
        const x1 = plotLeft + ((startMs - minTime) / range) * plotWidth
        const x2 = plotLeft + ((endMs - minTime) / range) * plotWidth
        return { x1, x2, chatId: h.chat }
      })
    }, [chartData, highlights])

    // ── Canvas sizing + initial highlight rects ───────────────────────────

    useEffect(() => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return
      const sync = () => {
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight
        computeHighlightRects()
        redrawCanvas()
      }
      sync()
      const ro = new ResizeObserver(sync)
      ro.observe(container)
      return () => ro.disconnect()
    }, [computeHighlightRects, redrawCanvas])

    // Recompute rects when highlights or readings change
    useEffect(() => {
      computeHighlightRects()
      redrawCanvas()
    }, [computeHighlightRects, redrawCanvas])

    // ── Stable refs for closure safety ─────────────────────────────────────

    const onSelectionCompleteRef = useRef(onSelectionComplete)
    useEffect(() => { onSelectionCompleteRef.current = onSelectionComplete }, [onSelectionComplete])

    const timeLabelToDateRef = useRef(timeLabelToDate)
    useEffect(() => { timeLabelToDateRef.current = timeLabelToDate }, [timeLabelToDate])

    // ── Native DOM drag listeners ─────────────────────────────────────────

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      function onMouseDown(e: MouseEvent) {
        if (!activeLabelRef.current) return
        isDraggingRef.current = true
        dragStartXRef.current = e.clientX - container!.getBoundingClientRect().left
        dragStartLabelRef.current = activeLabelRef.current
        dragCurrentLabelRef.current = activeLabelRef.current
        // Clear previous orange selection and redraw blue highlights
        frozenSelectionRef.current = null
        redrawCanvas()
        container!.style.cursor = "crosshair"
      }

      function onMouseMove(e: MouseEvent) {
        if (!isDraggingRef.current) return
        if (activeLabelRef.current) dragCurrentLabelRef.current = activeLabelRef.current
        const currentX = e.clientX - container!.getBoundingClientRect().left
        // Draw live orange rect over the blue highlights
        frozenSelectionRef.current = { x1: dragStartXRef.current, x2: currentX }
        redrawCanvas()
        container!.style.cursor = "col-resize"
      }

      function onMouseUp(e: MouseEvent) {
        if (!isDraggingRef.current) return
        isDraggingRef.current = false
        container!.style.cursor = "crosshair"

        const currentX = e.clientX - container!.getBoundingClientRect().left
        frozenSelectionRef.current = { x1: dragStartXRef.current, x2: currentX }
        redrawCanvas()

        const startLabel = dragStartLabelRef.current
        const endLabel = activeLabelRef.current ?? dragCurrentLabelRef.current
        dragStartLabelRef.current = null
        dragCurrentLabelRef.current = null

        if (!startLabel || !endLabel) return
        const startDate = timeLabelToDateRef.current.get(startLabel)
        const endDate = timeLabelToDateRef.current.get(endLabel)
        if (!startDate || !endDate || startDate.getTime() === endDate.getTime()) return
        const [sd, ed] = startDate <= endDate
          ? [startDate, endDate]
          : [endDate, startDate]
        onSelectionCompleteRef.current?.({ startDate: sd, endDate: ed })
      }

      function onMouseLeave() {
        if (!isDraggingRef.current) return
        isDraggingRef.current = false
        frozenSelectionRef.current = null
        redrawCanvas()
        container!.style.cursor = "crosshair"
        dragStartLabelRef.current = null
        dragCurrentLabelRef.current = null
      }

      container.addEventListener("mousedown", onMouseDown)
      container.addEventListener("mousemove", onMouseMove)
      container.addEventListener("mouseup", onMouseUp)
      container.addEventListener("mouseleave", onMouseLeave)
      return () => {
        container.removeEventListener("mousedown", onMouseDown)
        container.removeEventListener("mousemove", onMouseMove)
        container.removeEventListener("mouseup", onMouseUp)
        container.removeEventListener("mouseleave", onMouseLeave)
      }
    }, [redrawCanvas])

    const handleRechartsMouseMove = useCallback((e: any) => {
      if (e?.activeLabel != null) activeLabelRef.current = String(e.activeLabel)
    }, [])

    const handleRechartsMouseLeave = useCallback(() => {
      activeLabelRef.current = null
    }, [])

    function handleHighlightClick(chatId: string) {
      router.push(`/chat/${chatId}`)
    }

    // Hit-test a click on the canvas against highlight rects
    function handleCanvasClick(e: React.MouseEvent<HTMLElement>) {
      if (frozenSelectionRef.current) return // user just finished a drag, ignore
      const canvas = canvasRef.current
      if (!canvas) return
      const x = e.clientX - canvas.getBoundingClientRect().left
      const hit = highlightRectsRef.current.find(
        (r) => x >= Math.min(r.x1, r.x2) && x <= Math.max(r.x1, r.x2)
      )
      if (hit) handleHighlightClick(hit.chatId)
    }

  const [domainMin, domainMax] = useMemo(() => {
    const max = chartData.length ? chartData[chartData.length - 1].time : Date.now()
    const min = max - WINDOW_HOURS * 60 * 60 * 1000
    return [min, max]
  }, [chartData])

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
                    style={{ borderColor: POWER_LINE_COLOR, color: POWER_LINE_COLOR }}
                  />
                  <span className="inline-flex items-center gap-2" style={{ color: POWER_LINE_COLOR }}>
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
                    style={{ borderColor: IRRADIANCE_LINE_COLOR, color: IRRADIANCE_LINE_COLOR }}
                  />
                  <span className="inline-flex items-center gap-2" style={{ color: IRRADIANCE_LINE_COLOR }}>
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: IRRADIANCE_LINE_COLOR }}
                    />
                    Mostrar irradiancia
                  </span>
                </label>
                {timeWindow && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={zoomIn}
                      className="h-8 w-8 p-0"
                      title="Acercar"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={zoomOut}
                      className="h-8 w-8 p-0"
                      title="Alejar"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={scrollLeft}
                      className="h-8 w-8 p-0"
                      title="Desplazar izquierda"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={scrollRight}
                      className="h-8 w-8 p-0"
                      title="Desplazar derecha"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
          </div>

          <div
            ref={containerRef}
            className="relative h-64 select-none"
            style={{ cursor: "crosshair" }}
            onClick={handleCanvasClick}
          >
            {/* Canvas: blue highlights + orange selection — now handles clicks too */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 z-10"
              style={{ pointerEvents: "none" }}
            />


            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
                <span className="text-sm text-muted-foreground">
                  Sin lecturas en las últimas 24 horas
                </span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={CHART_MARGIN}
                  onMouseMove={handleRechartsMouseMove}
                  onMouseLeave={handleRechartsMouseLeave}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="time"
                    type="number"
                    scale="time"
                    domain={[domainMin, domainMax]}
                    tickCount={8}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    tickFormatter={(ms: number) => formatTime(new Date(ms))}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    domain={["auto", "auto"]}
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
                      const numericValue = Number(value)
                      const suffix = name === "Potencia" ? POWER_SUFFIX : IRRADIANCE_SUFFIX
                      return [formatValueWithSuffix(numericValue, suffix), name]
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
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
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
    )
  }
)