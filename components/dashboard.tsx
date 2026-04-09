"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { getReadings, getHighlights, getFeed, addComment, getAllPrototypesData } from "@/lib/api-client"
import type { UserLocal } from "@/lib/types/frontend-types"
import type { Reading } from "@/lib/types/backend-types"
import type { ChatAsPost, ChatAsHighlight } from "@/lib/types/frontend-types"
import type { PrototypeData } from "@/app/(app)/page"
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
  currentUser: UserLocal
  initialPrototypeData: PrototypeData[]
  initialFeed: ChatAsPost[]
}

export function Dashboard({ currentUser, initialPrototypeData, initialFeed }: DashboardProps) {
  const [prototypeData, setPrototypeData] = useState<PrototypeData[]>(initialPrototypeData)
  const [activeIndex, setActiveIndex] = useState(0)
  const [feed, setFeed] = useState<ChatAsPost[]>(initialFeed)
  const [selection, setSelection] = useState<SelectionRange | null>(null)
  const [timeWindows, setTimeWindows] = useState<Map<string, { start: Date; end: Date }>>(new Map())

  const chartRef = useRef<PrototypeChartHandle>(null)

  // Refreshes only readings and highlights, not the full page
  const loadData = useCallback(async () => {
    try {
      const updated = await getAllPrototypesData()
      // Transform the readings to have Date objects
      const transformed = updated.map(({ prototype, readings, highlights }) => ({
        prototype,
        readings: readings.map((r) => ({
          ...r,
          date: new Date(r.date),
        })),
        highlights,
      }))
      setPrototypeData(transformed)
    } catch (error) {
      console.error("Failed to load data:", error)
      // Fallback to individual fetches if getAllPrototypesData fails
      const updated = await Promise.all(
        prototypeData.map(async ({ prototype }) => {
          const [rawReadings, highlights] = await Promise.all([
            getReadings({ prototypeId: prototype.id }),
            getHighlights({ prototypeId: prototype.id }),
          ])
          const readings: Reading[] = rawReadings.map((r) => ({
            ...r,
            date: new Date(r.date),
          }))
          return { prototype, readings, highlights }
        })
      )
      setPrototypeData(updated)
    }

    const updatedFeed = await getFeed({ researcherId: currentUser.id })
    setFeed(updatedFeed)
  }, [prototypeData, currentUser.id])

  const handleTimeWindowChange = useCallback((timeWindow: { start: Date; end: Date }) => {
    const activePrototype = prototypeData[activeIndex]
    if (activePrototype) {
      setTimeWindows(prev => new Map(prev.set(activePrototype.prototype.id, timeWindow)))
    }
  }, [prototypeData, activeIndex])

  // Polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadData()
    }, 30000) // Poll every 30 seconds

    return () => clearInterval(interval)
  }, [loadData])

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

  const active = prototypeData[activeIndex]
  const count = prototypeData.length

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
              prototypeName={active.prototype.name}
              readings={active.readings}
              highlights={active.highlights}
              onSelectionComplete={handleSelectionComplete}
              onTimeWindowChange={handleTimeWindowChange}
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
                  {prototypeData.map((_, i) => (
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

        {active && (
          <ChartCommentBar
            selection={selection}
            prototypeId={active.prototype.id}
            userId={currentUser.id}
            onClearSelection={handleClearSelection}
            onCommentAdded={loadData}
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