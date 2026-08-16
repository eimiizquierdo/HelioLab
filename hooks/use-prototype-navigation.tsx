// hooks/use-prototype-navigation.ts

import { useMemo, useCallback } from "react"
import { getPrototypeDataInRange } from "@/lib/client-api"
import type { FrontendPrototype } from "@/lib/types/frontend-data-model"
import { TimeWindow, TimeWindowValue } from "@/lib/types/utility-types"

export function usePrototypeNavigation(
  getPrototype: () => FrontendPrototype | undefined,
  setPrototype: (callback: (p: FrontendPrototype) => FrontendPrototype) => void,
) {
  const chartTimeStep = useMemo(() => {
    const prototype = getPrototype()
    if (!prototype) return undefined
    switch (prototype.data.time_window as TimeWindowValue) {
      case TimeWindow.xs:  return 1
      case TimeWindow.sm:  return 1.5
      case TimeWindow.md:  return 1.5
      case TimeWindow.lg:  return 2
      case TimeWindow.xl:  return 4
      case TimeWindow.xxl: return 8
    }
  }, [getPrototype])

  const chartTimeStride = useMemo(
    () => chartTimeStep !== undefined ? chartTimeStep * 4 : undefined,
    [chartTimeStep],
  )

  const handleZoomIn = useCallback(() => {
    const prototype = getPrototype();
    if (!prototype || chartTimeStep === undefined || chartTimeStride === undefined) return

    const windowCenterMillis = prototype.data.cursor.getTime() - prototype.data.time_window / 2 * 60 * 60 * 1_000;

    const newWindowSpanHours = Object.values(TimeWindow).toSorted((a, b) => b - a).find(value => value < prototype.data.time_window);
    if (!newWindowSpanHours) return;

    const newWindowSpanMillis = newWindowSpanHours * 60 * 60 * 1_000;
    const newWindowUpperBound = new Date(windowCenterMillis + newWindowSpanMillis / 2);

    setPrototype((prototype) => ({
      ...prototype,
      data: {
        ...prototype.data,
        cursor: newWindowUpperBound,
        time_window: newWindowSpanHours
      }
    }));
  }, [getPrototype, setPrototype, chartTimeStep, chartTimeStride])

  const handleZoomOut = useCallback(() => {
    const prototype = getPrototype();
    if (!prototype || chartTimeStep === undefined || chartTimeStride === undefined) return

    const windowLowerBound = new Date(prototype.data.cursor.getTime() - prototype.data.time_window * 60 * 60 * 1_000);
    const windowSpanMillis = (prototype.data.cursor.getTime() - windowLowerBound.getTime());
    const windowCenterMillis = windowLowerBound.getTime() + windowSpanMillis / 2;

    const newWindowSpanHours = Object.values(TimeWindow).find((value) => value > prototype.data.time_window);
    if (!newWindowSpanHours) return;

    const newWindowSpanMillis = newWindowSpanHours * 60 * 60 * 1_000;
    const newWindowUpperBound = new Date(Math.min(prototype.data.window_upper_bound.getTime(), windowCenterMillis + newWindowSpanMillis / 2));
    const newWindowLowerBound = new Date(newWindowUpperBound.getTime() - newWindowSpanMillis);

    if (newWindowLowerBound < prototype.data.window_lower_bound) {
      setPrototype((prototype) => ({ ...prototype, is_loading: true }));

      const newWindowLowerBoundAfterStride = new Date(newWindowLowerBound.getTime() - chartTimeStride * 60 * 60 * 1_000);
      getPrototypeDataInRange({
        prototypeId: prototype.id,
        startDate: newWindowLowerBoundAfterStride,
        endDate: prototype.data.window_lower_bound
      })
      .then((data) => {
        setPrototype((prototype) => ({ 
          ...prototype, 
          is_loading: false,
          data: {
            ...prototype.data,
            highlights: [ ...data.highlights, ...prototype.data.highlights ],
            readings: [ ...data.readings, ...prototype.data.readings],
            time_window: newWindowSpanHours,
            window_lower_bound: newWindowLowerBoundAfterStride,
            cursor: newWindowUpperBound
          }
        }));
      })
    } else {
      setPrototype((prototype) => ({ 
        ...prototype, 
        data: { 
          ...prototype.data, 
          time_window: newWindowSpanHours,
          cursor: newWindowUpperBound 
        } 
      }));
    }
  }, [getPrototype, setPrototype, chartTimeStep, chartTimeStride])

  // Dado un Date, devuelve la fecha con hora 17:00 (5pm) en UTC-6
  // usando el offset correcto según horario de verano/invierno
  function dayAt5pm(date: Date): Date {
    // Horario de verano en México: abril-octubre → UTC-5, resto → UTC-6
    const month = date.getMonth() + 1
    const offsetHours = (month >= 4 && month <= 10) ? 5 : 6
    // Construir 5pm hora local como UTC
    const local = new Date(date)
    // Poner a medianoche UTC del mismo día UTC
    const dayUTC = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
    // Sumar horas: 17 (local) + offset = UTC
    return new Date(dayUTC.getTime() + (17 + offsetHours) * 60 * 60 * 1000)
  }

  const handleScrollLeft = useCallback(async () => {
    const prototype = getPrototype()
    if (!prototype) return

    // Cursor actual → obtener el día anterior a las 5pm
    const currentCursor = prototype.data.cursor
    const prevDay5pm = dayAt5pm(new Date(currentCursor.getTime() - 24 * 60 * 60 * 1000))

    // time_window fijo en 7h (10am a 5pm)
    const newWindow = 7
    const scrollLowerBound = prototype.data.window_lower_bound
    const newLowerBound = new Date(prevDay5pm.getTime() - newWindow * 60 * 60 * 1000)

    if (newLowerBound.getTime() >= scrollLowerBound.getTime()) {
      setPrototype((p) => ({
        ...p,
        data: {
          ...p.data,
          cursor: prevDay5pm,
          time_window: newWindow,
          cursor_updates_automatically: false,
        }
      }))
      return
    }

    // Necesita cargar datos anteriores
    setPrototype((p) => ({ ...p, is_loading: true }))
    const fetchFrom = new Date(newLowerBound.getTime() - 24 * 60 * 60 * 1000)
    getPrototypeDataInRange({
      prototypeId: prototype.id,
      startDate: fetchFrom,
      endDate: scrollLowerBound,
    }).then((data) => {
      setPrototype((p) => ({
        ...p,
        is_loading: false,
        data: {
          ...p.data,
          highlights: [...data.highlights, ...p.data.highlights],
          readings: [...data.readings, ...p.data.readings],
          window_lower_bound: fetchFrom,
          cursor: prevDay5pm,
          time_window: newWindow,
          cursor_updates_automatically: false,
        }
      }))
    })
  }, [getPrototype, setPrototype])

  const handleScrollRight = useCallback(() => {
    const prototype = getPrototype()
    if (!prototype) return

    const currentCursor = prototype.data.cursor
    const nextDay5pm = dayAt5pm(new Date(currentCursor.getTime() + 24 * 60 * 60 * 1000))
    const newWindow = 7

    // No pasar del límite superior
    if (nextDay5pm.getTime() > prototype.data.window_upper_bound.getTime()) return

    setPrototype((p) => ({
      ...p,
      data: {
        ...p.data,
        cursor: nextDay5pm,
        time_window: newWindow,
        cursor_updates_automatically: false,
      }
    }))
  }, [getPrototype, setPrototype])

  return { handleScrollLeft, handleScrollRight, handleZoomIn, handleZoomOut, chartTimeStep }
}
