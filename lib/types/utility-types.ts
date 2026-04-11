// UTILITY-TYPES
// Types used to define the frontned and backend
// types lists

export type UtcOffset = string;
export type Id = string;
export type UtilityTimestamp = Date;
export type UtilityGeoPoint = { latitude: number; longitude: number };
export type UtilityReference = Id;
export type Url = string;

/**
 * Object with that holds all valid window timespans (in hours).
 * Values are required to be sorted ascendingly
 */
export const TimeWindow = {
  'xs': 4,
  'sm': 6,
  'md': 8,
  'lg': 12,
  'xl': 24,
  'xxl': 72
};
export type TimeWindowKey   = keyof typeof TimeWindow;
export type TimeWindowValue = typeof TimeWindow[TimeWindowKey];
