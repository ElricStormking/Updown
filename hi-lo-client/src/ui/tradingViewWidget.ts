// Realtime line chart showing BTC price over the last 10 minutes, updating at 1Hz.
// We keep the same container id so the rest of the UI/layout stays unchanged.

import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { PriceUpdate } from '../types';

const CONTAINER_ID = 'tradingview-chart-inner';
const WINDOW_SECONDS = 1 * 20; // 10 minutes
const PRICE_LABEL_INTERVAL = 1; // dollars
const MIN_PRICE_RANGE = PRICE_LABEL_INTERVAL * 5; // 5 dollars - smaller range makes price changes more visible
const BARS_PER_SECOND = 2; // We plot at 2Hz (every 0.5s).
const RIGHT_OFFSET_BARS = Math.round(WINDOW_SECONDS * BARS_PER_SECOND * 0.5);

let chart: IChartApi | null = null;
let series: ISeriesApi<'Line'> | null = null;
let lastPlottedTime: number | null = null; // seconds, in 0.5s increments
let lastPlottedPrice: number | null = null;
let points: Array<{ time: UTCTimestamp; value: number }> = [];
let lockedPrice: number | null = null;
let roundLockSec: number | null = null;
let roundEndSec: number | null = null;
let lockedBadgeEl: HTMLDivElement | null = null;
let sonarDotEl: HTMLDivElement | null = null;
let priceUpdatesFrozen = false;

function getContainer() {
  const el = document.getElementById(CONTAINER_ID);
  if (!el) {
    throw new Error(`Missing #${CONTAINER_ID} container`);
  }
  return el;
}

function ensureChart() {
  const container = getContainer();
  if (chart && series) {
    return;
  }

  container.innerHTML = '';
  if (typeof window !== 'undefined') {
    const computed = window.getComputedStyle(container);
    if (computed.position === 'static') {
      container.style.position = 'relative';
    }
  }

  lockedBadgeEl = document.createElement('div');
  lockedBadgeEl.style.position = 'absolute';
  lockedBadgeEl.style.top = '10px';
  lockedBadgeEl.style.right = '10px';
  lockedBadgeEl.style.zIndex = '10';
  lockedBadgeEl.style.pointerEvents = 'none';
  lockedBadgeEl.style.padding = '6px 10px';
  lockedBadgeEl.style.borderRadius = '999px';
  lockedBadgeEl.style.fontFamily =
    'Rajdhani, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  lockedBadgeEl.style.fontWeight = '700';
  lockedBadgeEl.style.fontSize = '14px';
  lockedBadgeEl.style.letterSpacing = '0.06em';
  lockedBadgeEl.style.color = '#0b1b2a';
  lockedBadgeEl.style.background = '#ff9f1a';
  lockedBadgeEl.style.boxShadow = '0 8px 18px rgba(0,0,0,0.35)';
  lockedBadgeEl.style.display = 'none';
  container.appendChild(lockedBadgeEl);

  // Create sonar/pulse dot for the line end point
  sonarDotEl = document.createElement('div');
  sonarDotEl.style.position = 'absolute';
  sonarDotEl.style.width = '12px';
  sonarDotEl.style.height = '12px';
  sonarDotEl.style.borderRadius = '50%';
  sonarDotEl.style.background = '#00d2ff';
  sonarDotEl.style.boxShadow = '0 0 8px 2px #00d2ff, 0 0 16px 4px rgba(0,210,255,0.5)';
  sonarDotEl.style.zIndex = '15';
  sonarDotEl.style.pointerEvents = 'none';
  sonarDotEl.style.transform = 'translate(-50%, -50%)';
  sonarDotEl.style.animation = 'sonarPulse 1.5s ease-out infinite';
  container.appendChild(sonarDotEl);

  // Add CSS animation for the sonar pulse effect
  if (!document.getElementById('sonar-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'sonar-pulse-style';
    style.textContent = `
      @keyframes sonarPulse {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
          box-shadow: 0 0 8px 2px #00d2ff, 0 0 16px 4px rgba(0,210,255,0.5);
        }
        50% {
          transform: translate(-50%, -50%) scale(1.8);
          opacity: 0.7;
          box-shadow: 0 0 20px 8px #00d2ff, 0 0 40px 16px rgba(0,210,255,0.3);
        }
        100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
          box-shadow: 0 0 8px 2px #00d2ff, 0 0 16px 4px rgba(0,210,255,0.5);
        }
      }
      @keyframes sonarRing {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.8;
          border-width: 2px;
        }
        100% {
          transform: translate(-50%, -50%) scale(3);
          opacity: 0;
          border-width: 1px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Create outer sonar ring
  const sonarRingEl = document.createElement('div');
  sonarRingEl.style.position = 'absolute';
  sonarRingEl.style.width = '12px';
  sonarRingEl.style.height = '12px';
  sonarRingEl.style.borderRadius = '50%';
  sonarRingEl.style.border = '2px solid #00d2ff';
  sonarRingEl.style.background = 'transparent';
  sonarRingEl.style.zIndex = '14';
  sonarRingEl.style.pointerEvents = 'none';
  sonarRingEl.style.transform = 'translate(-50%, -50%)';
  sonarRingEl.style.animation = 'sonarRing 1.5s ease-out infinite';
  sonarRingEl.id = 'sonar-ring';
  container.appendChild(sonarRingEl);

  chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { color: 'transparent' },
      textColor: '#dfe6e9',
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.06)' },
      horzLines: { color: 'rgba(255,255,255,0.06)' },
    },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.2, bottom: 0.2 },
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: RIGHT_OFFSET_BARS,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkFormatter: (time: Time) => {
        // Show labels every 10 minutes on the X axis.
        if (typeof time !== 'number') return null;
        const minutes = Math.floor(time / 60);
        if (minutes % 10 !== 0) return '';
        const d = new Date(time * 1000);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      },
    },
    crosshair: {
      vertLine: { visible: false },
      horzLine: { visible: false },
    },
  });

  series = chart.addSeries(LineSeries, {
    color: '#00d2ff',
    lineWidth: 2,
    // Display Y-axis labels in $1 increments (integer dollars).
    priceFormat: { type: 'price', precision: 0, minMove: 1 },
  }) as ISeriesApi<'Line'>;

  // We'll control the visible price range manually to keep the scale tight.
  chart.priceScale('right').setAutoScale(false);

  // If we already have a lock signal (set before the chart initialized), show it now.
  if (lockedPrice !== null) {
    void setLockedPrice(lockedPrice);
  }
}

function getRightEdgeSec(nowSec: number) {
  if (lockedPrice !== null && roundEndSec !== null) {
    return Math.max(nowSec, roundEndSec);
  }
  return nowSec;
}

function prune(nowSec: number) {
  const rightEdge = getRightEdgeSec(nowSec);
  const minSec = rightEdge - WINDOW_SECONDS;
  points = points.filter((p) => Number(p.time) >= minSec);
}

function renderRange(nowSec: number) {
  if (!chart) return;
  const rightEdge = getRightEdgeSec(nowSec);
  const from = (rightEdge - WINDOW_SECONDS) as UTCTimestamp;
  const to = rightEdge as UTCTimestamp;
  chart.timeScale().setVisibleRange({ from, to });
}

function updatePriceScaleRange(latestPrice: number) {
  if (!chart || points.length === 0) return;

  const snapDown = (value: number) =>
    Math.floor(value / PRICE_LABEL_INTERVAL) * PRICE_LABEL_INTERVAL;
  const snapUp = (value: number) =>
    Math.ceil(value / PRICE_LABEL_INTERVAL) * PRICE_LABEL_INTERVAL;
  const snapNearest = (value: number) =>
    Math.round(value / PRICE_LABEL_INTERVAL) * PRICE_LABEL_INTERVAL;

  // Keep the visible range aligned to PRICE_LABEL_INTERVAL boundaries.
  const last = snapNearest(latestPrice);
  const values = points.map((p) => Math.round(p.value));
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Prefer a ~200-dollar window centered on latest, but expand if needed to avoid clipping.
  let from = last - MIN_PRICE_RANGE / 2;
  let to = last + MIN_PRICE_RANGE / 2;

  if (from > min) from = min;
  if (to < max) to = max;

  from = snapDown(from);
  to = snapUp(to);

  // Ensure the span is at least MIN_PRICE_RANGE and a multiple of PRICE_LABEL_INTERVAL.
  let span = to - from;
  if (span < MIN_PRICE_RANGE) {
    const pad = MIN_PRICE_RANGE - span;
    from = snapDown(from - pad / 2);
    to = snapUp(to + pad / 2);
    span = to - from;
  }

  // Final sanity: avoid zero/negative range
  if (span <= 0) {
    from = last - MIN_PRICE_RANGE / 2;
    to = last + MIN_PRICE_RANGE / 2;
    from = snapDown(from);
    to = snapUp(to);
  }

  chart.priceScale('right').setVisibleRange({ from, to });
}

export async function initTradingViewWidget() {
  if (typeof window === 'undefined') return;
  ensureChart();
}

export function setRoundTiming(lockTimeIso: string, endTimeIso: string) {
  const lockMs = new Date(lockTimeIso).getTime();
  const endMs = new Date(endTimeIso).getTime();
  if (Number.isFinite(lockMs)) {
    roundLockSec = Math.floor(lockMs / 1000);
  }
  if (Number.isFinite(endMs)) {
    roundEndSec = Math.floor(endMs / 1000);
  }
}

// Show/hide the locked badge during the locked phase.
export function setLockedPrice(nextLockedPrice: number | null) {
  lockedPrice = typeof nextLockedPrice === 'number' ? nextLockedPrice : null;
  ensureChart();
  if (!series || !chart) return;

  if (lockedPrice === null) {
    if (lockedBadgeEl) {
      lockedBadgeEl.style.display = 'none';
    }
    return;
  }

  if (lockedBadgeEl) {
    lockedBadgeEl.textContent = 'LOCKED';
    lockedBadgeEl.style.display = 'block';
  }
}

export function setPriceFreeze(
  frozen: boolean,
  finalPrice?: number | null,
  timestampMs?: number | null,
) {
  priceUpdatesFrozen = frozen;
  if (!frozen) return;
  if (typeof finalPrice === 'number' && Number.isFinite(finalPrice)) {
    const ts =
      typeof timestampMs === 'number' && Number.isFinite(timestampMs)
        ? timestampMs
        : Date.now();
    applyPriceUpdate({ price: finalPrice, timestamp: ts }, true);
  }
}

// Update the sonar dot position to match the last point on the chart
function updateSonarPosition(time: number, price: number) {
  if (!chart || !series || !sonarDotEl) return;
  
  const sonarRingEl = document.getElementById('sonar-ring');
  
  try {
    // Get the pixel coordinates from the chart
    const timeCoord = chart.timeScale().timeToCoordinate(time as UTCTimestamp);
    const priceCoord = series.priceToCoordinate(price);
    
    if (timeCoord === null || priceCoord === null) {
      sonarDotEl.style.display = 'none';
      if (sonarRingEl) sonarRingEl.style.display = 'none';
      return;
    }
    
    // Position the sonar elements
    sonarDotEl.style.display = 'block';
    sonarDotEl.style.left = `${timeCoord}px`;
    sonarDotEl.style.top = `${priceCoord}px`;
    
    if (sonarRingEl) {
      sonarRingEl.style.display = 'block';
      sonarRingEl.style.left = `${timeCoord}px`;
      sonarRingEl.style.top = `${priceCoord}px`;
    }
  } catch {
    // Hide if coordinates can't be calculated
    sonarDotEl.style.display = 'none';
    if (sonarRingEl) sonarRingEl.style.display = 'none';
  }
}

function applyPriceUpdate(update: PriceUpdate, force = false) {
  if (typeof window === 'undefined') return;
  if (!force && priceUpdatesFrozen) return;
  ensureChart();
  if (!series) return;

  // Chart time is seconds; we encode half-second resolution as .0/.5 second values.
  const halfTick = Math.floor(update.timestamp / 500);
  const t = halfTick / 2;
  const price = update.price;

  // First point
  if (lastPlottedTime === null) {
    lastPlottedTime = t;
    lastPlottedPrice = price;
    points = [{ time: t as UTCTimestamp, value: price }];
    series.setData(points);
    renderRange(t);
    updatePriceScaleRange(price);
    updateSonarPosition(t, price);
    return;
  }

  // Same half-second bucket: ignore (we want 2Hz updates)
  if (t === lastPlottedTime) {
    return;
  }

  // Fill any skipped half-seconds with the last known price so the chart advances smoothly at 2Hz.
  if (lastPlottedPrice !== null) {
    for (let tt = lastPlottedTime + 0.5; tt < t; tt += 0.5) {
      points.push({ time: tt as UTCTimestamp, value: lastPlottedPrice });
    }
  }

  points.push({ time: t as UTCTimestamp, value: price });
  lastPlottedTime = t;
  lastPlottedPrice = price;

  prune(t);
  series.setData(points);
  renderRange(t);
  updatePriceScaleRange(price);
  updateSonarPosition(t, price);
}

// Feed this from the server price stream. We sample at 2Hz (every 0.5s).
export function pushPriceUpdate(update: PriceUpdate) {
  applyPriceUpdate(update);
}
