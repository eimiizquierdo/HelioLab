"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { getFeed, addComment, getAllPrototypesLatestData } from "@/lib/client-api"
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
  const [lastDataFetch, setLastDataFetch] = useState<Date>(initialDataFetch)

  const POLLING_INTERVAL_MINUTES = 0.5

  const chartRef = useRef<PrototypeChartHandle>(null)

  const activePrototype = prototypes[activeIndex]

  const pollData = useCallback(async () => {
    try {
      const data = await getAllPrototypesLatestData(lastDataFetch)
      const newLastDataFetch = new Date()

      setPrototypes((previous) =>
        previous.map((prototype) => {
          const datum = data.find((d) => d.prototype === prototype.id)
          if (!datum) return prototype

          return {
            ...prototype,
            data: {
              ...prototype.data,
              readings: [...prototype.data.readings, ...datum.readings],
              highlights: [...prototype.data.highlights, ...datum.highlights],
              window_upper_bound: newLastDataFetch,
              ...(prototype.data.cursor_updates_automatically && {
                cursor: newLastDataFetch,
              }),
            },
          }
        })
      )

      setLastDataFetch(newLastDataFetch)
    } catch (error) {
      console.error("Failed to load data:", error)
    }

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
    return activePrototype.data.readings.filter(
      (reading) => reading.date >= windowStart && reading.date <= windowEnd,
    )
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

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      pollData()
    }, POLLING_INTERVAL_MINUTES * 60 * 1000)

    return () => clearInterval(interval)
  }, [pollData])

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
            onCommentAdded={pollData}
            addComment={addComment}
          />
        )}

        <ChatsFeed chats={feed} />
      </div>

      <div className="w-64 shrink-0">
        <ConnectionsPanel />
      </div>
    </div>
  )
}