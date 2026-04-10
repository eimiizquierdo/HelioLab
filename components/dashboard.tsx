"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { getReadings, getHighlights, getFeed, addComment, getAllPrototypesLatestData, getPrototypeDataInRange } from "@/lib/client-api"
import type { Reading } from "@/lib/types/backend-data-model"
import type { FrontendUser, ChatAsPost, ChatAsHighlight, PrototypeData, FrontendPrototype } from "@/lib/types/frontend-data-model"
import {
  PrototypeChart,
  type SelectionRange,
  type PrototypeChartHandle,
} from "@/components/prototype-chart"
import { ChatsFeed } from "@/components/chats-feed"
import { ChartCommentBar } from "@/components/chart-comment-bar"
import { ConnectionsPanel } from "@/components/connections-panel"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { TimeWindow, TimeWindowValue } from "@/lib/types/utility-types"

interface DashboardProps {
  currentUser: FrontendUser
  initialPrototypes: FrontendPrototype[]
  initialFeed: ChatAsPost[]
}

export function Dashboard({ currentUser, initialPrototypes: initialPrototypeData, initialFeed }: DashboardProps) {
  const [prototypes, setPrototypes] = useState<FrontendPrototype[]>(initialPrototypeData)
  const [activeIndex, setActiveIndex] = useState(0)
  const [feed, setFeed] = useState<ChatAsPost[]>(initialFeed)
  const [selection, setSelection] = useState<SelectionRange | null>(null)

  const POLLING_INTERVAL_MINUTES = 4;
  const chartRef = useRef<PrototypeChartHandle>(null)

  const activePrototype = prototypes[activeIndex]
  const setActivePrototype = useCallback((callback: (input: FrontendPrototype) => FrontendPrototype) => {
    setPrototypes((prototypes) => {
      const newPrototype = callback(prototypes[activeIndex]);
      const copiedPrototypes = [...prototypes];
      copiedPrototypes[activeIndex] = newPrototype;
      console.log({ newPrototype });
      return copiedPrototypes;
    });
  }, [activeIndex])

  // Refreshes only readings and highlights, not the full page
  const pollData = useCallback(async () => {
    try {
    } catch (error) {
      console.error("Failed to load data:", error)
    }

    const updatedFeed = await getFeed({ researcherId: currentUser.id })
    setFeed(updatedFeed)
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
    const windowStart = new Date(activePrototype.data.cursor.getTime() - activePrototype.data.time_window * 60 * 60 * 1000);
    const windowEnd = activePrototype.data.cursor;
    return activePrototype.data.readings.filter(
      (reading) =>
        reading.date >= windowStart &&
        reading.date <= windowEnd,
    )
  }, [activePrototype])

  const filteredHighlights = useMemo(() => {
    if (!activePrototype) return []
    const windowStart = new Date(activePrototype.data.cursor.getTime() - activePrototype.data.time_window * 60 * 60 * 1000);
    const windowEnd = activePrototype.data.cursor;

    return activePrototype.data.highlights.filter((highlight) => {
      const highlightStart = new Date(highlight.start_date)
      const highlightEnd = new Date(highlight.end_date)
      return highlightStart <= windowEnd && highlightEnd > windowStart
    })
  }, [activePrototype])

  const chartTimeStep = useMemo(() => {
    switch (activePrototype.data.time_window as TimeWindowValue) {
      case TimeWindow.xs: return 1;
      case TimeWindow.sm: return 1.5;
      case TimeWindow.md: return 1.5;
      case TimeWindow.lg: return 2;
      case TimeWindow.xl: return 4;
      case TimeWindow.xxl: return 8;
    }
  }, [activePrototype]);

  /** The number of hours to use as padding when deciding whether to load new data */
  const chartTimePadding = useMemo(() => {
    if (!chartTimeStep) return;
    return 2 * chartTimeStep;
  }, [ chartTimeStep ]);

  const chartTimeStride = useMemo(() => {
    if (!chartTimeStep) return;
    return 4 * chartTimeStep;
  }, [ chartTimeStep ]);

  const handleZoomIn = useCallback(() => {
  }, [activePrototype])

  const handleZoomOut = useCallback(() => {
  }, [activePrototype])

  const handleScrollLeft = useCallback(async () => {
    if (!activePrototype || !chartTimeStep || !chartTimePadding || !chartTimeStride) return;
    const newCursor = new Date(activePrototype.data.cursor.getTime() - chartTimeStep * 60 * 60 * 1000);
    const newWindowStart = new Date(newCursor.getTime() - activePrototype.data.time_window * 60 * 60 * 1000);
    const paddedWindowStart = new Date(activePrototype.data.window_lower_bound.getTime() + chartTimePadding * 60 * 60 * 1000);

    if (newWindowStart <= paddedWindowStart) {
      const lowerBound = new Date(activePrototype.data.window_lower_bound.getTime() - chartTimeStride * 60 * 60 * 1000);
      await getPrototypeDataInRange({ 
        prototypeId: activePrototype.id, 
        startDate: lowerBound, 
        endDate: activePrototype.data.window_lower_bound 
      })
        .then((data) => {
          setPrototypes((prototypes) => {
            const copiedPrototypes = [...prototypes];
            const referencedPrototype = copiedPrototypes.find((prototype) => prototype.id == data.prototype)!;

            referencedPrototype.data.highlights.unshift(...data.highlights);
            referencedPrototype.data.readings.unshift(...data.readings);
            referencedPrototype.data.window_lower_bound = new Date(referencedPrototype.data.window_lower_bound.getTime() - data.time_window * 60 * 60 * 1000);

            return copiedPrototypes;
          });
        })
      ;
    }
    
    setActivePrototype((prototype) => ({
      ...prototype,
      data: {
        ...prototype.data,
        cursor: newCursor
      }
    }));
  }, [ activePrototype, chartTimeStep, chartTimePadding, chartTimeStride ])

  const handleScrollRight = useCallback(() => {
    if (!activePrototype || !chartTimeStep) return;
    const proposedCursor = new Date(activePrototype.data.cursor.getTime() + chartTimeStep * 60 * 60 * 1000);
    const newCursor = new Date(Math.min(proposedCursor.getTime(), activePrototype.data.window_upper_bound.getTime()));

    setActivePrototype((prototype) => ({
      ...prototype,
      data: {
        ...prototype.data,
        cursor: newCursor
      }
    }));
  }, [ activePrototype, chartTimeStep ])

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      pollData()
    }, POLLING_INTERVAL_MINUTES * 60 * 1000)
    console.log({activeDomain: activeDomain?.map((value) => new Date(value))});

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
              onSelectionComplete={handleSelectionComplete}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onScrollLeft={handleScrollLeft}
              onScrollRight={handleScrollRight}
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