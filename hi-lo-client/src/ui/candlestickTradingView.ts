declare global {
  interface Window {
    TradingView?: {
      widget?: new (options: Record<string, unknown>) => unknown;
    };
  }
}

const TV_SCRIPT_SRC = 'https://s3.tradingview.com/tv.js';

let tvScriptPromise: Promise<void> | null = null;

const ensureTvScript = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.TradingView?.widget) {
    return Promise.resolve();
  }
  if (tvScriptPromise) {
    return tvScriptPromise;
  }

  tvScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TV_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('TradingView script failed to load')),
      );
      return;
    }

    const script = document.createElement('script');
    script.src = TV_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('TradingView script failed to load'));
    document.head.appendChild(script);
  });

  return tvScriptPromise;
};

export async function ensureCandlestickTradingViewWidget(containerId: string) {
  if (typeof window === 'undefined') return;

  await ensureTvScript();

  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Missing #${containerId} container`);
  }

  // Avoid re-initializing on every open.
  if (container.dataset.tvInitialized === 'true') {
    return;
  }

  container.innerHTML = '';

  const Widget = window.TradingView?.widget;
  if (!Widget) {
    throw new Error('TradingView.widget is not available');
  }

  // Candlestick chart
  // style: 1 = candlesticks (TradingView Advanced Chart widget)
  // interval: 1 = 1 minute (smallest supported by this widget)
  // autosize: let it fit the modal container
  // hide_top_toolbar: keep it clean "view only"
  // hide_legend: cleaner for mobile
  // save_image: false to reduce UI clutter
  // details: some embed versions ignore unknown fields; this config works with tv.js
  // eslint-disable-next-line no-new
  new Widget({
    autosize: true,
    symbol: 'BINANCE:BTCUSDT',
    interval: '1',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    hide_top_toolbar: true,
    hide_legend: true,
    withdateranges: false,
    allow_symbol_change: false,
    enable_publishing: false,
    save_image: false,
    container_id: containerId,
  });

  container.dataset.tvInitialized = 'true';
}

export {};
