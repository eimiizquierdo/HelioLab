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

  const handleScrollLeft = useCallback(async () => {
    const prototype = getPrototype()
    if (!prototype || chartTimeStep === undefined || chartTimeStride === undefined) return

    const windowLowerBound = new Date(prototype.data.cursor.getTime() - prototype.data.time_window * 60 * 60 * 1_000);
    const windowUpperBoundAfterStep = new Date(prototype.data.cursor.getTime() - chartTimeStep * 60 * 60 * 1_000);
    const windowLowerBoundAfterStep = new Date(windowLowerBound.getTime() - chartTimeStep * 60 * 60 * 1_000);
    const scrollLowerBound = prototype.data.window_lower_bound;
    
    if (windowLowerBoundAfterStep.getTime() > scrollLowerBound.getTime()) {
      setPrototype((prototype) => {
        return {
          ...prototype,
          data: {
            ...prototype.data,
            cursor_updates_automatically: false,
            cursor: windowUpperBoundAfterStep,
          }
        };
      })
      return;
    }

    setPrototype((prototype) => ({ ...prototype, is_loading: true }));

    const windowLowerBoundAfterStepAndStride = new Date(windowLowerBoundAfterStep.getTime() - chartTimeStride * 60 * 60 * 1_000);
    getPrototypeDataInRange({
      prototypeId: prototype.id,
      startDate: windowLowerBoundAfterStepAndStride,
      endDate: scrollLowerBound
    })
    .then((data) => {
      setPrototype((prototype) => ({ 
        ...prototype, 
        is_loading: false,
        data: {
          ...prototype.data,
          highlights: [ ...data.highlights, ...prototype.data.highlights ],
          readings: [ ...data.readings, ...prototype.data.readings],
          window_lower_bound: windowLowerBoundAfterStepAndStride,
          cursor: windowUpperBoundAfterStep
        }
      }));
    })
    ;
  }, [getPrototype, setPrototype, chartTimeStep, chartTimeStride])

  const handleScrollRight = useCallback(() => {
    const prototype = getPrototype()
    if (!prototype || chartTimeStep === undefined) return

    const proposedWindowUpperBound = new Date(
      prototype.data.cursor.getTime() + chartTimeStep * 60 * 60 * 1000,
    )
    const newWindowUpperBound = new Date(
      Math.min(proposedWindowUpperBound.getTime(), prototype.data.window_upper_bound.getTime()),
    )

    setPrototype((p) => ({
      ...p,
      data: { ...p.data, cursor: newWindowUpperBound },
    }))
  }, [getPrototype, setPrototype, chartTimeStep])

  return { handleScrollLeft, handleScrollRight, handleZoomIn, handleZoomOut }
}
