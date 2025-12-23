// Lightweight helper to embed the TradingView hosted widget.
// Uses the official embed script and initializes a candlestick chart for BITSTAMP:BTCUSD.

const TV_SCRIPT_SRC = 'https://s3.tradingview.com/tv.js';
const CONTAINER_ID = 'tradingview-chart';

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.TradingView) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TV_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load TradingView script'));
    document.head.appendChild(script);
  });

  return scriptLoading;
}

export async function initTradingViewWidget() {
  if (typeof window === 'undefined') return;

  await loadScript();

  if (!window.TradingView) {
    throw new Error('TradingView failed to initialize');
  }

  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    throw new Error(`Missing #${CONTAINER_ID} container`);
  }
  container.innerHTML = '';

  // eslint-disable-next-line new-cap
  new window.TradingView.widget({
    symbol: 'BITSTAMP:BTCUSD',
    interval: '1',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    toolbar_bg: '#0b1b2a',
    enable_publishing: false,
    hide_side_toolbar: false,
    allow_symbol_change: false,
    container_id: CONTAINER_ID,
    autosize: true,
  });
}
