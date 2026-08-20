"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { getFeed, addComment, getReadingsForRange } from "@/lib/client-api"
import type { FrontendUser, ChatAsPost, FrontendPrototype } from "@/lib/types/frontend-data-model"
import {
  PrototypeChart,
  type SelectionRange,
  type PrototypeChartHandle,
} from "@/components/prototype-chart"
import { ChatsFeed } from "@/components/chats-feed"
import { ChartCommentBar } from "@/components/chart-comment-bar"
import { ConnectionsPanel } from "@/components/connections-panel"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SolarScene } from "@/components/solar-scene"

interface DashboardProps {
  currentUser: FrontendUser
  initialPrototypes: FrontendPrototype[]
  initialFeed: ChatAsPost[]
  initialDataFetch: Date
}

export function Dashboard({
  currentUser,
  initialPrototypes: initialPrototypeData,
  initialFeed,
  initialDataFetch,
}: DashboardProps) {
  const [prototypes, setPrototypes] = useState<FrontendPrototype[]>(initialPrototypeData)
  const [activeIndex, setActiveIndex] = useState(0)
  const [feed, setFeed] = useState<ChatAsPost[]>(initialFeed)
  const [selection, setSelection] = useState<SelectionRange | null>(null)
  const lastDataFetchRef = useRef<Date>(initialDataFetch)


  const chartRef = useRef<PrototypeChartHandle>(null)

  const activePrototype = prototypes[activeIndex]

  // Agrega un reading individual recibido por SSE
  const addReading = useCallback((prototypeId: string, reading: {
    id: string
    date: string
    voltage: number
    current: number
    irradiance: number
  }) => {
    const readingDate = new Date(reading.date)
    setPrototypes((previous) =>
      previous.map((prototype) => {
        if (prototype.id !== prototypeId) return prototype
        return {
          ...prototype,
          data: {
            ...prototype.data,
            readings: [...prototype.data.readings, {
              id: reading.id,
              date: readingDate,
              voltage: reading.voltage,
              current: reading.current,
              irradiance: reading.irradiance,
            }].sort((a, b) => {
              const da = a.date instanceof Date ? a.date.getTime() : new Date(a.date as string).getTime()
              const db2 = b.date instanceof Date ? b.date.getTime() : new Date(b.date as string).getTime()
              return da - db2
            }),
            window_upper_bound: readingDate,
            ...(prototype.data.cursor_updates_automatically && {
              cursor: readingDate,
            }),
          },
        }
      })
    )
    lastDataFetchRef.current = readingDate
  }, [])

  // Refresca el feed de comentarios
  const refreshFeed = useCallback(async () => {
    try {
      const updatedFeed = await getFeed({ researcherId: currentUser.id })
      setFeed(updatedFeed)
    } catch (error) {
      console.error("Failed to load feed:", error)
    }
  }, [currentUser.id])

  const activeDomain = useMemo<[number, number] | undefined>(() => {
    if (!activePrototype) return undefined
    const cursor =
      activePrototype.data.cursor instanceof Date
        ? activePrototype.data.cursor
        : new Date(activePrototype.data.cursor)
    if (Number.isNaN(cursor.getTime())) return undefined

    const timeWindowMs = activePrototype.data.time_window * 60 * 60 * 1000
    return [cursor.getTime() - timeWindowMs, cursor.getTime()]
  }, [activePrototype])

  const filteredReadings = useMemo(() => {
    if (!activePrototype) return []
    const windowStart = new Date(
      activePrototype.data.cursor.getTime() - activePrototype.data.time_window * 60 * 60 * 1000,
    )
    const windowEnd = activePrototype.data.cursor
    return activePrototype.data.readings.filter((reading) => {
      const d = reading.date instanceof Date
        ? reading.date
        : new Date(reading.date as string)
      if (d < windowStart || d > windowEnd) return false
      // Solo horas operativas 10am-5pm
      // México usa UTC-6 en invierno y UTC-5 en verano (horario de verano)
      // Detectar offset real usando el offset del sistema o calcularlo por fecha
      const utcHour = d.getUTCHours()
      const month = d.getUTCMonth() + 1 // 1-12
      // Horario de verano en México: primer domingo de abril al último domingo de octubre
      const isDST = month > 4 && month < 10  // aprox: mayo-septiembre siempre DST
      const offsetHours = isDST ? 5 : 6      // UTC-5 en verano, UTC-6 en invierno
      const localHour = (utcHour - offsetHours + 24) % 24
      return localHour >= 10 && localHour < 17
    })
  }, [activePrototype])

  const filteredHighlights = useMemo(() => {
    if (!activePrototype) return []
    const windowStart = new Date(
      activePrototype.data.cursor.getTime() - activePrototype.data.time_window * 60 * 60 * 1000,
    )
    const windowEnd = activePrototype.data.cursor

    return activePrototype.data.highlights.filter((highlight) => {
      const highlightStart = new Date(highlight.start_date)
      const highlightEnd = new Date(highlight.end_date)
      return highlightStart <= windowEnd && highlightEnd > windowStart
    })
  }, [activePrototype])

  const prototypeAccessors = useMemo(
    () =>
      prototypes.map((p) => ({
        getPrototype: () => prototypes.find((proto) => proto.id === p.id),
        setPrototype: (callback: (proto: FrontendPrototype) => FrontendPrototype) => {
          setPrototypes((prev) => {
            const index = prev.findIndex((proto) => proto.id === p.id)
            if (index === -1) return prev
            const next = [...prev]
            next[index] = callback(prev[index])
            return next
          })
        },
      })),
    [prototypes],
  )

  // SSE: recibir readings en tiempo real sin polling
  useEffect(() => {
    const since = lastDataFetchRef.current.toISOString()
    const source = new EventSource(`/api/stream?since=${encodeURIComponent(since)}`)

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          prototype: string
          reading: { id: string; date: string; voltage: number; current: number; irradiance: number }
        }
        addReading(payload.prototype, payload.reading)
      } catch (err) {
        console.error("[SSE] Error procesando mensaje:", err)
      }
    }

    source.onerror = () => {
      // EventSource reconecta automáticamente
    }

    return () => source.close()
  }, [addReading])

  function handleSelectionComplete(range: SelectionRange) {
    setSelection(range)
  }

  function handleClearSelection() {
    setSelection(null)
    chartRef.current?.clearSelection()
  }

  function handleSetActiveIndex(i: number) {
    handleClearSelection()
    setActiveIndex(i)
  }

  const count = prototypes.length

  function prev() {
    handleSetActiveIndex((activeIndex - 1 + count) % count)
  }

  function next() {
    handleSetActiveIndex((activeIndex + 1) % count)
  }

  return (
    <div className="flex gap-8 p-6">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {/* Selector de prototipo */}
        {count > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground shrink-0">Prototipo:</span>
            <Select
              value={String(activeIndex)}
              onValueChange={(v) => handleSetActiveIndex(Number(v))}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prototypes.map((p, i) => (
                  <SelectItem key={p.id} value={String(i)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {count === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-card">
            <span className="text-sm text-muted-foreground">No hay prototipos registrados.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <PrototypeChart
              ref={chartRef}
              prototypeName={activePrototype.label}
              readings={filteredReadings}
              highlights={filteredHighlights}
              domain={activeDomain}
              windowSpan={activePrototype.data.time_window}
              isLoading={activePrototype.is_loading}
              isLive={activePrototype.data.cursor_updates_automatically}
              onGoLive={() => {
                const now = new Date()
                const windowStart = new Date(now.getTime() - 6 * 60 * 60 * 1000)
                prototypeAccessors[activeIndex].setPrototype((p) => ({
                  ...p,
                  data: {
                    ...p.data,
                    // Solo conservar readings de las últimas 6 horas
                    readings: p.data.readings.filter((r) => {
                      const d = r.date instanceof Date ? r.date : new Date(r.date as string)
                      return d >= windowStart && d <= now
                    }),
                    cursor: now,
                    time_window: 6,
                    cursor_updates_automatically: true,
                  },
                }))
              }}
              onSelectionComplete={handleSelectionComplete}
              getPrototype={prototypeAccessors[activeIndex].getPrototype}
              setPrototype={prototypeAccessors[activeIndex].setPrototype}
            />

            {count > 1 && (
              <div className="flex items-center justify-between px-1">
                <button
                  onClick={prev}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>

                <div className="flex items-center gap-1.5">
                  {prototypes.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => handleSetActiveIndex(i)}
                      aria-label={`Prototipo ${i + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        i === activeIndex
                          ? "w-5 bg-primary"
                          : "w-2 bg-border hover:bg-muted-foreground"
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={next}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {activePrototype && (
          <ChartCommentBar
            selection={selection}
            prototypeId={activePrototype.id}
            userId={currentUser.id}
            onClearSelection={handleClearSelection}
            onCommentAdded={refreshFeed}
            addComment={addComment}
          />
        )}

        <SolarScene
          selectedDate={
            activePrototype?.data.cursor instanceof Date
              ? activePrototype.data.cursor
              : activePrototype?.data.cursor
                ? new Date(activePrototype.data.cursor)
                : undefined
          }
          defaultConfig={activePrototype?.solarConfig}
          prototypeId={activePrototype?.id ?? ""}
          currentUserId={currentUser.id}
          ownerId={activePrototype?.ownerId ?? ""}
        />
                    
        <ChatsFeed
          chats={feed}
          onSeekTo={async (startDate, endDate) => {
            if (!activePrototype) return
            const centerMs = (startDate.getTime() + endDate.getTime()) / 2
            const halfWindowMs = activePrototype.data.time_window / 2 * 60 * 60 * 1000
            // Rango amplio: toda la ventana actual centrada en el comentario
            const windowStart = new Date(centerMs - halfWindowMs)
            const windowEnd   = new Date(centerMs + halfWindowMs)
            // Verificar si ya hay readings en ese rango amplio
            const hasData = activePrototype.data.readings.some((r) => {
              const d = r.date instanceof Date ? r.date : new Date(r.date as string)
              return d >= windowStart && d <= windowEnd
            })
            if (!hasData) {
              try {
                // Cargar solo el rango del día del comentario (±12h alrededor del highlight)
                const centerMs = (startDate.getTime() + endDate.getTime()) / 2
                const { readings: rangeReadings, highlights: rangeHighlights } = await getReadingsForRange({
                  prototypeId: activePrototype.id,
                  startDate: new Date(centerMs - 12 * 60 * 60 * 1000),
                  endDate: new Date(centerMs + 12 * 60 * 60 * 1000),
                })
                if (rangeReadings.length > 0) {
                  prototypeAccessors[activeIndex].setPrototype((p) => ({
                    ...p,
                    data: {
                      ...p.data,
                      readings: rangeReadings,
                      highlights: rangeHighlights.length > 0 ? rangeHighlights : p.data.highlights,
                    },
                  }))
                }
              } catch (e) {
                console.error("seekTo: error cargando readings", e)
              }
            }
            chartRef.current?.seekTo(startDate, endDate)
          }}
        />
      </div>

      <div className="w-64 shrink-0">
        <ConnectionsPanel onDaySelect={(date) => {
          if (!activePrototype) return
          prototypeAccessors[activeIndex].setPrototype((p) => ({
            ...p,
            data: {
              ...p.data,
              cursor: date,
              time_window: 6,  // resetear a ventana por defecto al navegar con calendario
              cursor_updates_automatically: false,
            }
          }))
        }} />
      </div>
    </div>
  )
}
