// Beirut/Lebanon calibrated traffic multipliers
// 1.0 = free-flow baseline, >1.0 = congested, <1.0 = light traffic
import { beirutHour, beirutDay } from "../../utils/lebanonTime.js";

// Average speed drop per hour of day (24-hour local time)
const HOUR_MULTIPLIERS = [
  0.60, // 00:00
  0.55, // 01:00
  0.52, // 02:00
  0.55, // 03:00
  0.62, // 04:00
  0.80, // 05:00
  0.92, // 06:00
  1.45, // 07:00  morning peak begins
  1.65, // 08:00  heavy morning peak
  1.52, // 09:00
  1.22, // 10:00
  1.18, // 11:00
  1.35, // 12:00  school pickup + lunch
  1.28, // 13:00
  1.08, // 14:00
  1.25, // 15:00  school out
  1.48, // 16:00  afternoon builds
  1.72, // 17:00  evening peak — worst hour
  1.68, // 18:00  still very heavy
  1.40, // 19:00
  1.18, // 20:00
  0.95, // 21:00
  0.80, // 22:00
  0.68, // 23:00
];

// Day-of-week multiplier (JS convention: 0=Sunday, 6=Saturday)
// Lebanon weekend = Saturday + Sunday
const DAY_MULTIPLIERS = [
  0.65, // 0 Sunday
  1.00, // 1 Monday
  1.00, // 2 Tuesday
  0.98, // 3 Wednesday
  0.96, // 4 Thursday
  0.82, // 5 Friday (Jumu'ah, many businesses close early)
  0.62, // 6 Saturday
];

export const getTrafficMultiplier = (date = new Date()) => {
  const hour = beirutHour(date);
  const day = beirutDay(date);
  let mult = HOUR_MULTIPLIERS[hour] * DAY_MULTIPLIERS[day];
  // Friday Jumu'ah prayer congestion burst (11:00–13:00)
  if (day === 5 && hour >= 11 && hour <= 13) mult *= 1.22;
  return Math.round(mult * 100) / 100;
};

export const getTrafficCondition = (multiplier) => {
  if (multiplier <= 0.70) return { label: 'Light',    color: '#10B981', severity: 'low'      };
  if (multiplier <= 0.95) return { label: 'Moderate', color: '#84CC16', severity: 'moderate' };
  if (multiplier <= 1.20) return { label: 'Busy',     color: '#F59E0B', severity: 'busy'     };
  if (multiplier <= 1.50) return { label: 'Heavy',    color: '#F97316', severity: 'heavy'    };
  return                         { label: 'Severe',   color: '#EF4444', severity: 'severe'   };
};

// Full 24-hour forecast for a given day
export const getDayForecast = (dayOfWeek = beirutDay()) => {
  return HOUR_MULTIPLIERS.map((hourMult, hour) => {
    const mult = Math.round(hourMult * DAY_MULTIPLIERS[dayOfWeek] * 100) / 100;
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      multiplier: mult,
      ...getTrafficCondition(mult),
    };
  });
};

// Next 3 low-traffic windows from a given departure time
export const getBestDepartureWindows = (date = new Date()) => {
  const day = beirutDay(date);
  const now = beirutHour(date);
  return getDayForecast(day)
    .filter((f) => f.hour >= now && f.multiplier <= 0.90)
    .slice(0, 3);
};

// Human-readable ETA delay description
export const formatDelayDescription = (multiplier) => {
  if (multiplier <= 0.70) return 'faster than usual';
  if (multiplier <= 0.95) return 'normal traffic';
  if (multiplier <= 1.20) return 'slightly delayed';
  if (multiplier <= 1.50) return 'moderate delays expected';
  return 'heavy delays — consider waiting';
};
