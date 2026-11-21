import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchResultsView from './components/SearchResultsView';
import MerchantDemandRadar from './components/MerchantDemandRadar';

const inr = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

// Curated studio-grade imagery for all 25 catalog products
const PRODUCT_IMAGES = {
  // Bags & Packs
  prod_001: 'https://lh3.googleusercontent.com/aida/ALJJyrCDayMPVMwmftjoMJiksmYQOMzSMi_j0HHWvM1X1vzc8il-yoyFcOe9YEcbO2e9_-9oqmsZomuHCbVKfQ8gZqr5b2Z5FzknQ5ZgHdoL5oWAeG1hwi_UTOF26beq79LkQiEkT7c3VE860t81ARwBz8c88xY1gIFyxcv2IQywpfOh7FdueoJMEVJwMxF54-b2tTdvzFMFl2Oog6nyXSKlunTN3iQaMmQ6YtLAjGzaNqzqhw',
  prod_002: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1K2QeEqrgGLd4lk8fq8z1OAYcEYb0Ne4Jdq8oft40r2kTyR8Nqib0LPyTlHm5xSECYeM0zzrZArDeR-K3dF8aoQYyMxs84SDcWuCZeChQbjdDUIosERHsDkZtngxJg-GtjWyqCHfrJGblGMXHj_Lr-A84tAO6ev1Kk6c-9w6AeZFXQFh5mOP6CiuzcW3cCp4vRrcJARBmL5F4sh6m8krVTUzj8JvL6y4LvzNAi-0g9mA6PdBJM61w3f2yp5J592vYpcWIg5O2',
  prod_003: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC9-lt0FnmS1wY4x6lJswI5D3Wele8j1ChfaYqdB0v6llDFfNbyo79FvrcmzHUyEmUQDl4rNAIfDad_G-tYfNloKGWVvKeYSRi7x24HTY3ebE5QyONruYaKgCIuYQFQIUxM6cWh_qdE__0r_Zy3jMaRJQYbwycRJg3rbl20KLw2DbaKFnRA679IWHwxaB_Ah62x27KhQ42BWcQWg_-sbpqnCz49s_DNdGtzFIP0zh9TwTxBhQoe2S02rolyYYKlnvx7NQRyDLvw',
  prod_023: 'https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?auto=format&fit=crop&w=800&q=80',

  // Tech & Everyday Carry Accessories
  prod_004: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
  prod_005: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80',
  prod_011: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
  prod_012: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80',
  prod_024: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
  prod_025: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',

  // Trail & Urban Footwear
  prod_006: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPF89VclwIf4yZy8pbD-qyRoA38hVnlCypZa5q1AgWWeYNthDu2xzb6SuaLim-BqnGkmf9kwgaqUgyUZm6Mw3yGb_4tutVI9aR9Vpn0zzn8z1fd37LAcdaL2Ud1V73nPO3gOw2CThilKvtYlrQ1EC_1u2EmnB9zM3gXpv9mLtDKvpdGacMn3l0EFRoIuAsud5FadfQZiRds3jXBh5rWm3GqKXwh-cZycSN3fYH2AAk_NlqlATryhvpUM7PQEFmSv9nKaqx1s87',
  prod_007: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=800&q=80',
  prod_008: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',

  // Technical Apparel
  prod_009: 'https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=800&q=80',
  prod_010: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',

  // Focus Hardware & Electronics
  prod_013: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
  prod_014: 'https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=800&q=80',
  prod_015: 'https://lh3.googleusercontent.com/aida/ALJJyrBnEm1aN7_cXRoN8MIFFcBjGMLjQ153GKjhVBkc821xQ7JQSYpx4ryg2xM04EP75u9Q0eczECFejo0AOEdU4MPqkySdNGWHzPtsqO-7YUYYDOsEH-CAxA1lVVSjd60OUkEhf5CFHYJ64F3cz23y2oi_o4qlfgp5qHF9UbXmjbk2_a06yYZ3ges2dBACNaM9GYc0jWf64l3OuxrGM8gRz7DzEl-BwR059PV1_4FdS76qsw',
  prod_016: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
  prod_017: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB3GOy7W3-IkEKIfRFo4Q4v-HwTZDquEbEp6BvmiGWd77WF1KGZLjS-e4W__CjJkp5tP22gE2qv00A6zSQ6oCfWlsT_sekV8sUaQ-L6N1jgTaml6tn7WtWVy6Zx3rtKz3xm7KnNhIKNBNp9uWjMpOsAVYWQ4GRTX8YP0d-HpNf6Y4pun6_vw4lT3MEuWeJgYKGiADuLAywLwpPbj0F2C1jHBxuy_yiRVHeX-yB3hTO3iN26M3WsgDqk8ZsZFmZ5rI4LSBNezueP',
  prod_021: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
  prod_022: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80',

  // Work & Study Stationery
  prod_018: 'https://lh3.googleusercontent.com/aida/ALJJyrBVL1QWcVDxWLI8O9CMZm347a1ANECXSEN63XNirM44ooLbCcmoJ62uMXVWxQL89zRsvv1cFly7PYjqTXMg3Cp7_H11qWuv4J7lzXIIQ3YTtcO4D6FmYVcuJDhb-eG68WbG25VolLm68U2UnLy0QOqdIOp06oKjrRoEl4tF1qV_GpbWOGdHIUwuyWKiz1EC9E3uTq6FsWgEC22zm4oYN5X9acRd8qhSBpujlcRx5hfeyQ',
  prod_019: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=800&q=80',
  prod_020: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80',
};

const CATEGORY_ITEMS = [
  { id: 'bags', title: 'Travel & Backpacks', emoji: '🎒', desc: 'Waterproof rolltops & commuter slings' },
  { id: 'stationery', title: 'Work & Study', emoji: '🪵', desc: 'Solid walnut organizers & desk ergonomics' },
  { id: 'accessories', title: 'Everyday Tech & Carry', emoji: '⚡', desc: 'Minimalist cables, sleeves & gear' },
  { id: 'shoes', title: 'Trail & Footwear', emoji: '👟', desc: 'Ergonomic urban runners & trail shoes' },
  { id: 'electronics', title: 'Focus Hardware', emoji: '🎧', desc: 'Mechanical peripherals & acoustics' },
];

function Toast({ message, visible, onHide }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 3500);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-on-surface px-5 py-3.5 text-xs font-sans tracking-wide text-white shadow-2xl border border-[#333] transition-all">
      <span className="material-symbols-outlined text-[18px] text-accent">check_circle</span>
      <span>{message}</span>
    </div>
  );
}

function ProductCard({ product, onAdd, onWishlist, isWished }) {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const imgUrl = PRODUCT_IMAGES[product.id];

  return (
    <article id={`prod-${product.id}`} className="group relative bg-surface-card border border-border-subtle rounded-2xl overflow-hidden hover:border-on-surface transition-all duration-500 flex flex-col justify-between">
      <div>
        <div className="relative w-full aspect-[4/3] bg-surface-subtle overflow-hidden">
          {imgUrl ? (
            <img
              alt={product.title}
              src={imgUrl}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="flex w-full h-full items-center justify-center bg-surface-subtle text-5xl group-hover:scale-105 transition-transform duration-700 ease-out">
              {product.emoji || '📦'}
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur font-sans text-[10px] font-bold text-on-surface uppercase tracking-wider shadow-sm">
              {product.category}
            </span>
            {isOutOfStock ? (
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-mono text-[10px] font-bold tracking-wider uppercase border border-rose-200">
                Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="px-2.5 py-0.5 rounded-full bg-accent text-on-surface font-mono text-[10px] font-bold tracking-wider uppercase">
                Only {product.stock} left
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-on-surface text-white font-mono text-[10px] tracking-wider uppercase">
                In Stock ({product.stock})
              </span>
            )}
          </div>

          <button
            aria-label="Save item"
            className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur hover:bg-white flex items-center justify-center transition-colors shadow-sm ${isWished ? 'text-rose-600' : 'text-on-surface'
              }`}
            onClick={() => onWishlist(product.id)}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isWished ? 'favorite' : 'favorite_border'}
            </span>
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-sans text-lg font-bold uppercase tracking-tight text-on-surface group-hover:text-black line-clamp-1">
              {product.title}
            </h3>
            <span className="font-sans text-lg font-bold text-on-surface whitespace-nowrap">
              {inr(product.price_paise)}
            </span>
          </div>

          <p className="mt-2 text-xs font-body text-on-surface-muted line-clamp-2 leading-relaxed">
            {product.description}
          </p>

          {/* Product Highlights */}
          <div className="mt-3.5 p-3 rounded-lg bg-surface-subtle border border-border-subtle">
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-on-surface block mb-0.5">
              HIGHLIGHTS:
            </span>
            <p className="font-body text-[11px] text-on-surface-muted line-clamp-2">
              {product.tags ? product.tags.join(' • ') : 'Calibrated everyday ergonomics'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 pt-0 mt-2">
        <div className="pt-4 border-t border-border-subtle flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-sans text-on-surface-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
            <span>2-Day Dispatch</span>
          </div>
          <button
            className="px-4 py-2 rounded-lg bg-on-surface text-white hover:bg-black font-sans text-[11px] tracking-wider uppercase font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
            disabled={isOutOfStock}
            onClick={() => onAdd(product)}
          >
            <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
            <span>Add to Cart</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function CartDrawer({ open, onClose, cart, products, onQty, onCheckout, checkoutState }) {
  const items = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((x) => x.product);
  const total = items.reduce((sum, x) => sum + x.product.price_paise * x.qty, 0);

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface border-l border-border-subtle shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="flex items-center justify-between border-b border-border-subtle p-6 bg-surface-card">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-on-surface">shopping_cart</span>
            <span className="font-sans font-bold text-lg uppercase tracking-tight text-on-surface">Your Cart</span>
            <span className="px-2 py-0.5 rounded-full bg-accent text-on-surface font-sans text-[11px] font-bold">
              {items.reduce((acc, i) => acc + i.qty, 0)}
            </span>
          </div>
          <button className="p-1 rounded text-on-surface-muted hover:text-on-surface transition-colors" onClick={onClose}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="material-symbols-outlined text-4xl mb-3 text-on-surface-muted">remove_shopping_cart</span>
              <p className="font-sans text-sm font-bold uppercase tracking-wider text-on-surface">Your cart is empty</p>
              <p className="mt-1 font-body text-xs text-on-surface-muted">Describe what you need or browse our live catalog</p>
            </div>
          )}

          {items.map(({ product, qty }) => {
            const itemImg = PRODUCT_IMAGES[product.id];
            return (
              <div key={product.id} className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-card p-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-subtle overflow-hidden flex-shrink-0 border border-border-subtle">
                  {itemImg ? (
                    <img src={itemImg} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{product.emoji || '📦'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-xs font-bold uppercase text-on-surface">{product.title}</p>
                  <p className="font-body text-xs text-on-surface-muted mt-0.5">{inr(product.price_paise)} each</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-2 py-1">
                  <button className="text-xs font-bold text-on-surface-muted hover:text-on-surface px-1" onClick={() => onQty(product.id, qty - 1)}>
                    -
                  </button>
                  <span className="w-4 text-center font-mono text-xs font-bold">{qty}</span>
                  <button
                    className="text-xs font-bold text-on-surface-muted hover:text-on-surface px-1 disabled:opacity-30"
                    disabled={qty >= product.stock}
                    onClick={() => onQty(product.id, qty + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}

          {checkoutState.order && (
            <div className="rounded-xl border border-accent/40 bg-accent/20 p-5 text-on-surface font-sans">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-black">check_circle</span>
                <p className="text-xs font-bold uppercase tracking-wider">Order Dispatched</p>
              </div>
              <p className="mt-2 text-xs font-mono">
                ORDER ID: <strong>{checkoutState.order.id}</strong> · {inr(checkoutState.order.total_paise)}
              </p>
              <p className="mt-1 text-[11px] text-on-surface-muted">
                Inventory decremented atomically. Outbox transaction queued.
              </p>
            </div>
          )}

          {checkoutState.error && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-body text-rose-800">
              <p className="font-bold">Checkout conflict:</p>
              <p className="mt-0.5">{checkoutState.error}</p>
            </div>
          )}
        </div>

        <div className="border-t border-border-subtle p-6 bg-surface-card">
          <div className="mb-4 flex justify-between font-sans">
            <span className="text-xs uppercase tracking-wider text-on-surface-muted">Total (incl. GST)</span>
            <span className="text-xl font-bold text-on-surface">{inr(total)}</span>
          </div>
          <button
            className="w-full py-4 rounded-xl bg-accent text-on-surface font-sans text-xs tracking-wider uppercase font-bold hover:bg-[#bbf055] transition-all shadow-sm disabled:opacity-40"
            disabled={items.length === 0 || checkoutState.loading}
            onClick={onCheckout}
          >
            {checkoutState.loading ? 'Processing atomic lock…' : 'Complete Checkout'}
          </button>
          <p className="mt-2.5 text-center font-mono text-[10px] text-on-surface-muted">
            IMMEDIATE SQLITE WAL COMMIT · IDEMPOTENT TRANSACTION
          </p>
        </div>
      </aside>
    </div>
  );
}

function AdminPanel({ onBackToStore }) {
  const [data, setData] = useState(null);
  const [demandRadar, setDemandRadar] = useState(null);
  const [busy, setBusy] = useState('');
  const [rfpBusy, setRfpBusy] = useState(false);
  const [rfpDraft, setRfpDraft] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [overviewData, radarData] = await Promise.all([
        api('/api/admin/overview'),
        api('/api/admin/demand-radar').catch(() => ({ signals: [], total: 0 })),
      ]);
      setData(overviewData);
      setDemandRadar(radarData);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [load]);

  const regenerate = async (alert) => {
    setBusy(alert.id);
    try {
      await api('/api/admin/restock-draft', {
        method: 'POST',
        body: JSON.stringify({ product_id: alert.product_id, alert_id: alert.id }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const generateRfp = async (signal) => {
    setRfpBusy(true);
    setRfpDraft(null);
    try {
      const res = await api('/api/admin/sourcing-rfp', {
        method: 'POST',
        body: JSON.stringify({
          query: signal.query,
          category: signal.category,
          signal_count: signal.signal_count,
          estimated_lost_paise: signal.estimated_lost_paise,
        }),
      });
      setRfpDraft({ query: signal.query, draft: res.draft, source: res.source });
    } catch (e) {
      setError(e.message);
    } finally {
      setRfpBusy(false);
    }
  };

  const dismiss = async (id) => {
    await api(`/api/admin/dismiss-alert/${id}`, { method: 'POST' });
    load();
  };

  const setStock = async (productId, stock) => {
    await api(`/api/admin/products/${productId}/stock`, {
      method: 'POST',
      body: JSON.stringify({ stock: Number(stock) }),
    });
    load();
  };

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center font-sans text-xs tracking-wider uppercase text-on-surface-muted">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        Syncing Merchant Intelligence… {error}
      </div>
    );
  }

  const lowStock = data.products.filter((p) => p.stock <= data.low_stock_threshold);
  const openAlerts = data.alerts.filter((a) => a.status === 'open');

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 px-6 lg:px-12 py-10 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-accent"></span>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-on-surface">Merchant Intelligence Console</h1>
          </div>
          <p className="mt-1 text-xs font-body text-on-surface-muted">
            Real-time catalog telemetry · Scientific Reorder Point Formula ($ROP = D \times L + SS$) · Demand Radar gaps
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary text-xs" onClick={load}>
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Sync
          </button>
          <button className="btn-primary text-xs" onClick={onBackToStore}>
            Return to Storefront
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-rose-50 p-4 text-xs text-rose-800">{error}</p>}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-surface-card border border-border-subtle rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-muted">Catalog Items</p>
          <p className="mt-1 text-3xl font-bold text-on-surface">{data.products.length}</p>
          <p className="mt-1 text-[11px] text-on-surface-muted">Live SQLite WAL sync</p>
        </div>
        <div className="bg-surface-card border border-border-subtle rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-muted">Low Stock Warnings</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{lowStock.length}</p>
          <p className="mt-1 text-[11px] text-amber-700">Stock ≤ {data.low_stock_threshold} units</p>
        </div>
        <div className="bg-surface-card border border-border-subtle rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-muted">Unmet Demand Signals</p>
          <p className="mt-1 text-3xl font-bold text-on-surface">{data.demand_signal_count ?? demandRadar?.total ?? 0}</p>
          <p className="mt-1 text-[11px] text-on-surface font-semibold">Customer gap telemetry</p>
        </div>
        <div className="bg-surface-card border border-border-subtle rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-muted">Outbox Events</p>
          <p className="mt-1 text-3xl font-bold text-on-surface">{data.events.length}</p>
          <p className="mt-1 text-[11px] text-emerald-600">500ms background worker</p>
        </div>
      </div>

      {/* Demand Radar Section */}
      <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 lg:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-subtle">
          <div>
            <h2 className="text-base font-bold uppercase tracking-tight text-on-surface flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent"></span>
              Demand Radar — Unmet Customer Catalog Gaps
            </h2>
            <p className="text-xs font-body text-on-surface-muted mt-0.5">
              Aggregated zero-result natural searches and customer sourcing requests
            </p>
          </div>
        </div>

        {(!demandRadar || demandRadar.signals.length === 0) ? (
          <p className="text-xs font-body text-on-surface-muted py-6">No demand signals captured yet. Perform a search with no matches to test auto-capture.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b border-border-subtle text-on-surface-muted font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Unmet Requirement</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Requests</th>
                  <th className="py-3 px-4">Est. Lost GMV</th>
                  <th className="py-3 px-4">Procurement Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {demandRadar.signals.map((sig, idx) => (
                  <tr key={idx} className="hover:bg-surface-subtle/50 transition">
                    <td className="py-3 px-4 font-bold text-on-surface">{sig.query}</td>
                    <td className="py-3 px-4 text-on-surface-muted capitalize">{sig.category || 'General'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-accent text-on-surface font-bold text-[10px]">
                        {sig.signal_count} request{sig.signal_count > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-on-surface">{inr(sig.estimated_lost_paise)}</td>
                    <td className="py-3 px-4">
                      <button
                        className="px-3.5 py-1.5 rounded-lg bg-on-surface text-white hover:bg-black font-sans text-[10px] tracking-wider uppercase font-semibold transition"
                        disabled={rfpBusy}
                        onClick={() => generateRfp(sig)}
                      >
                        Generate Supplier RFP
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rfpDraft && (
          <div className="mt-6 rounded-xl border border-border-subtle bg-surface-subtle p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                Sourcing RFP Draft for: {rfpDraft.query} ({rfpDraft.source})
              </span>
              <button className="text-xs text-on-surface-muted hover:text-on-surface" onClick={() => setRfpDraft(null)}>
                Close
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg bg-white p-4 font-mono text-xs text-on-surface border border-border-subtle">
              {rfpDraft.draft}
            </pre>
          </div>
        )}
      </section>

      {/* Grid: Restock Alerts & Outbox Events */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-tight text-on-surface mb-1">Autonomous Restock Alerts</h2>
          <p className="text-xs font-body text-on-surface-muted mb-4">Triggered automatically when inventory dips below threshold</p>
          {openAlerts.length === 0 ? (
            <p className="text-xs font-body text-on-surface-muted py-6">No open alerts. Place orders to deplete stock below threshold.</p>
          ) : (
            <div className="space-y-4">
              {openAlerts.map((a) => {
                const product = data.products.find((p) => p.id === a.product_id);
                return (
                  <div key={a.id} className="rounded-xl border border-border-subtle p-4 bg-surface-subtle/40">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase text-on-surface">{product?.title || a.product_id}</p>
                      <span className="rounded bg-surface-card px-2 py-0.5 text-[10px] font-mono font-bold text-on-surface border border-border-subtle">
                        {a.draft_source}
                      </span>
                    </div>
                    <p className="mb-2 text-[11px] font-body text-on-surface-muted">
                      Current Stock: <strong>{a.evidence.current_stock}</strong> · Sold Recently: <strong>{a.evidence.recent_units_sold}</strong> · Threshold: {a.evidence.threshold}
                    </p>
                    <pre className="mb-3 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-[11px] font-mono text-on-surface border border-border-subtle">
                      {a.draft_text}
                    </pre>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1.5 rounded-lg bg-on-surface text-white text-[11px] font-sans font-bold uppercase tracking-wider"
                        disabled={busy === a.id}
                        onClick={() => regenerate(a)}
                      >
                        {busy === a.id ? 'Drafting…' : 'Regenerate Draft'}
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-lg border border-border-subtle bg-white text-[11px] font-sans font-semibold text-on-surface hover:bg-surface-subtle"
                        onClick={() => dismiss(a.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-tight text-on-surface mb-1">Transactional Outbox Stream</h2>
          <p className="text-xs font-body text-on-surface-muted mb-4">Event ledger processed by background worker every 500ms</p>
          <div className="max-h-80 space-y-2.5 overflow-y-auto">
            {data.events.map((e) => (
              <div key={e.id} className="rounded-lg border border-border-subtle p-3 text-xs bg-white">
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase tracking-wide text-on-surface">{e.event_type}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${e.processed_at ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                    {e.processed_at ? 'PROCESSED' : 'PENDING'}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-on-surface-muted mt-1">
                  ID: {e.aggregate_id} · {new Date(e.created_at).toLocaleTimeString()}
                </p>
              </div>
            ))}
            {data.events.length === 0 && <p className="text-xs font-body text-on-surface-muted py-6">No events in queue.</p>}
          </div>
        </section>
      </div>

      {/* Inventory & Reorder Point Table */}
      <section className="bg-surface-card border border-border-subtle rounded-2xl p-6 lg:p-8 shadow-sm">
        <h2 className="text-base font-bold uppercase tracking-tight text-on-surface mb-1">Live Inventory & Scientific ROP</h2>
        <p className="text-xs font-body text-on-surface-muted mb-4">
          Defensible inventory replenishment: $ROP = (Daily\,Velocity \times Lead\,Days) + Safety\,Stock$
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="border-b border-border-subtle text-on-surface-muted font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Stock Level</th>
                <th className="py-3 px-4">Daily Velocity</th>
                <th className="py-3 px-4">ROP Trigger</th>
                <th className="py-3 px-4">Override Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.products.map((p) => {
                const isUnderRop = p.reorder_point > 0 && p.stock <= p.reorder_point;
                return (
                  <tr key={p.id} className="hover:bg-surface-subtle/50 transition">
                    <td className="py-3 px-4 font-bold text-on-surface flex items-center gap-2.5">
                      {PRODUCT_IMAGES[p.id] ? (
                        <img src={PRODUCT_IMAGES[p.id]} alt="" className="w-8 h-8 rounded-lg object-cover border border-border-subtle shrink-0" />
                      ) : (
                        <span className="text-lg">{p.emoji}</span>
                      )}
                      <span className="truncate">{p.title}</span>
                    </td>
                    <td className="py-3 px-4 text-on-surface-muted capitalize">{p.category}</td>
                    <td className="py-3 px-4 font-bold text-on-surface">{inr(p.price_paise)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-mono font-bold ${p.stock <= data.low_stock_threshold ? 'bg-amber-100 text-amber-800' : 'text-on-surface'
                        }`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-on-surface-muted font-mono">{p.daily_velocity ?? 0}/day</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded px-2 py-0.5 text-xs font-mono font-bold ${isUnderRop ? 'bg-rose-100 text-rose-800' : 'bg-surface-subtle text-on-surface'
                        }`}>
                        {p.reorder_point ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="0"
                        defaultValue={p.stock}
                        className="w-20 rounded border border-border-subtle bg-white px-2 py-1 text-xs font-mono"
                        onBlur={(e) => Number(e.target.value) !== p.stock && setStock(p.id, e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('store'); // 'store' | 'admin'
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Keyword & AI Intent Search
  const [catalogSearch, setCatalogSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const searchSuggestions = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return [];
    return allProducts
      .filter((p) => {
        return (
          p.title.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q))) ||
          p.description.toLowerCase().includes(q)
        );
      })
      .slice(0, 5);
  }, [catalogSearch, allProducts]);

  // AI Shopping Search State (Hero Intent Console only)
  const [intentInput, setIntentInput] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [demandQuery, setDemandQuery] = useState('');
  const [demandCategory, setDemandCategory] = useState('bags');
  const [demandBudget, setDemandBudget] = useState('1800');
  const [demandSubmitting, setDemandSubmitting] = useState(false);

  // Checkout State
  const [checkoutState, setCheckoutState] = useState({ loading: false, order: null, error: '' });
  const idempotencyKey = useRef(null);
  const demandSectionRef = useRef(null);
  const intentInputRef = useRef(null);
  const catalogSearchRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  // Notification Bell State (Top Navigation)
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifList, setNotifList] = useState([
    {
      id: 'notif_1',
      title: 'High Velocity Demand Alert',
      message: '64 shoppers searching for Waterproof Lightweight Commuter Backpack (#DMD-0982).',
      time: '12m ago',
      unread: true,
    },
    {
      id: 'notif_2',
      title: 'Stock Reorder Point Triggered',
      message: 'AeroShield 24L is at 8 units (Threshold: 10). Reorder recommended.',
      time: '45m ago',
      unread: true,
    },
    {
      id: 'notif_3',
      title: 'Catalog Telemetry Synced',
      message: 'Live warehouse inventory synchronized with AI discovery index.',
      time: '2h ago',
      unread: false,
    },
  ]);

  const [adminOverview, setAdminOverview] = useState(null);
  const fetchAdminOverview = useCallback(async () => {
    try {
      const data = await api('/api/admin/overview');
      setAdminOverview(data);
    } catch {
      // Graceful
    }
  }, []);

  useEffect(() => {
    fetchAdminOverview();
  }, [fetchAdminOverview]);

  const loadAllProducts = useCallback(async () => {
    try {
      const data = await api('/api/products');
      setAllProducts(data.products || []);
      setProducts(data.products || []);
    } catch {
      // Graceful
    }
  }, []);

  useEffect(() => {
    loadAllProducts();
  }, [loadAllProducts]);

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus catalog & AI search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        catalogSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(allProducts.map((p) => p.category))].filter(Boolean).sort();
    return ['All', ...cats];
  }, [allProducts]);

  // Instant catalog filtering by category AND keyword search
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategory !== 'All') {
      list = list.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [products, selectedCategory, catalogSearch]);

  const addToCart = (product) => {
    setCart((c) => ({
      ...c,
      [product.id]: Math.min((c[product.id] || 0) + 1, product.stock),
    }));
    showToast(`Added ${product.title} to cart`);
    setCheckoutState({ loading: false, order: null, error: '' });
  };

  const toggleWishlist = (productId) => {
    setWishlist((w) => {
      const next = !w[productId];
      showToast(next ? 'Saved to Wishlist' : 'Removed from Wishlist');
      return { ...w, [productId]: next };
    });
  };

  const setQty = (id, qty) => {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  };

  const handleAiSearch = async (queryText) => {
    const text = (queryText || intentInput).trim();
    if (!text || searchLoading) return;
    setIntentInput(text);
    setSearchLoading(true);
    setSearchResult(null);

    try {
      const res = await api('/api/ai/shop', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });
      setSearchResult(res);
      setView('search');
      if (!res.products || res.products.length === 0) {
        setDemandQuery(text);
        if (res.filters?.category) setDemandCategory(res.filters.category);
        if (res.filters?.max_price_paise) setDemandBudget(String(res.filters.max_price_paise / 100));
      }
      setTimeout(() => {
        const curationEl = document.getElementById('curation');
        if (curationEl) curationEl.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (e) {
      showToast(`Search error: ${e.message}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleDemandSubmit = async (e) => {
    e.preventDefault();
    if (!demandQuery.trim() || demandSubmitting) return;
    setDemandSubmitting(true);

    try {
      await api('/api/demand/request', {
        method: 'POST',
        body: JSON.stringify({
          query: demandQuery.trim(),
          category: demandCategory || null,
          max_budget_paise: demandBudget ? Number(demandBudget) * 100 : null,
        }),
      });
      showToast('Your specification has been captured in our Maker Demand Radar.');
      setDemandQuery('');
    } catch (e) {
      showToast(`Error: ${e.message}`);
    } finally {
      setDemandSubmitting(false);
    }
  };

  const checkout = async () => {
    const items = Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }));
    if (!items.length) return;
    if (!idempotencyKey.current) {
      idempotencyKey.current = window.crypto?.randomUUID ? window.crypto.randomUUID() : `idem-${Date.now()}`;
    }
    setCheckoutState({ loading: true, order: null, error: '' });
    try {
      const data = await api('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ items, idempotency_key: idempotencyKey.current, customer_name: 'Guest Client' }),
      });
      setCheckoutState({ loading: false, order: data.order, error: '' });
      setCart({});
      idempotencyKey.current = null;
      await loadAllProducts();
    } catch (e) {
      setCheckoutState({ loading: false, order: null, error: e.message });
    }
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const wishCount = Object.values(wishlist).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased flex flex-col font-body selection:bg-accent selection:text-black">
      <Toast message={toastMessage} visible={toastVisible} onHide={() => setToastVisible(false)} />

      {/* TOP EDITORIAL TICKER */}
      <aside className="w-full bg-[#171717] text-[#EAE7DF] border-b border-[#303030] py-2 px-6 overflow-hidden">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-[11px] font-sans tracking-widest uppercase">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-accent animate-ping"></span>
            <span className="text-white font-medium">SHELF SENSE:</span>
            <span className="text-[#A5A29B] hidden sm:inline">INTELLIGENT DEMAND-AWARE COMMERCE</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-[#A5A29B] hidden md:inline">FREE EXPRESS DELIVERY ON ORDERS OVER ₹999</span>
            <span className="text-accent font-semibold">ALL PRICES IN INR (₹)</span>
          </div>
        </div>
      </aside>

      {/* 1. FLOATING EDITORIAL NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full bg-[#F5F3ED]/95 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between gap-6">
          {/* Brand & Logotype */}
          <div className="flex items-center gap-3.5 flex-shrink-0">
            <button
              onClick={() => { setView('store'); setSearchResult(null); setCatalogSearch(''); }}
              className="group flex items-center gap-2.5 text-left focus:outline-none"
            >
              <div className="w-8 h-8 flex items-center justify-center text-on-surface text-2xl font-bold group-hover:rotate-90 transition-transform duration-500 select-none">
                ❋
              </div>
              <div className="flex flex-col">
                <span className="font-display font-extrabold text-2xl md:text-[26px] tracking-tight text-on-surface leading-none">
                  Shelf<span className="font-serif italic font-normal text-[25px] tracking-normal text-on-surface">Sense</span>
                </span>
                <span className="font-sans text-[9px] tracking-editorial uppercase text-on-surface-muted mt-0.5">
                  Natural Query Commerce
                </span>
              </div>
            </button>
          </div>

          {/* Nav Links - Guaranteed Single Line with whitespace-nowrap */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 font-sans text-xs tracking-wider uppercase font-medium text-on-surface">
            <button
              onClick={() => { setView('store'); setSearchResult(null); setCatalogSearch(''); }}
              className={`whitespace-nowrap py-1 relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] transition-all ${
                view === 'store'
                  ? 'text-on-surface font-bold after:bg-on-surface'
                  : 'text-on-surface-muted hover:text-on-surface after:bg-transparent'
              }`}
            >
              Home
            </button>
            {/* Interactive Categories Dropdown */}
            <div className="relative" onMouseLeave={() => setCategoriesDropdownOpen(false)}>
              <button
                type="button"
                onClick={() => setCategoriesDropdownOpen((prev) => !prev)}
                onMouseEnter={() => setCategoriesDropdownOpen(true)}
                className={`whitespace-nowrap flex items-center gap-1 py-1 transition-colors ${
                  categoriesDropdownOpen ? 'text-on-surface font-bold' : 'text-on-surface-muted hover:text-on-surface'
                }`}
              >
                <span>Categories</span>
                <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${categoriesDropdownOpen ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {/* Categories Floating Panel */}
              {categoriesDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-border-subtle rounded-2xl shadow-xl z-50 p-2.5 flex flex-col gap-1">
                  <div className="px-3 py-1.5 border-b border-border-subtle flex items-center justify-between">
                    <span className="font-sans text-[10px] uppercase font-bold tracking-wider text-on-surface-muted">
                      Explore Categories
                    </span>
                    <a
                      href="#categories"
                      onClick={() => {
                        setView('store');
                        setCategoriesDropdownOpen(false);
                      }}
                      className="font-sans text-[10px] text-on-surface hover:underline font-semibold"
                    >
                      View Grid →
                    </a>
                  </div>

                  {CATEGORY_ITEMS.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setView('store');
                        setSelectedCategory(cat.id);
                        setCategoriesDropdownOpen(false);
                        setTimeout(() => {
                          document.getElementById('curation')?.scrollIntoView({ behavior: 'smooth' });
                        }, 50);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-surface-subtle transition-colors text-left group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{cat.emoji}</span>
                        <div>
                          <span className="font-sans text-xs font-bold text-on-surface block group-hover:text-black">
                            {cat.title}
                          </span>
                          <span className="font-body text-[10px] text-on-surface-muted block leading-tight">
                            {cat.desc}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[14px] text-on-surface-muted opacity-0 group-hover:opacity-100 transition-opacity">
                        chevron_right
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </nav>

          {/* Right Action Cluster - Unified Search Bar with Embedded AI Button */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
            {/* Integrated Header Search Bar with Autocomplete Dropdown & AI Engine Button */}
            <div className="relative">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearchFocused(false);
                  if (catalogSearch.trim()) {
                    handleAiSearch(catalogSearch);
                  }
                }}
                className="flex items-center bg-white border border-border-subtle hover:border-on-surface focus-within:border-on-surface focus-within:ring-2 focus-within:ring-on-surface/10 rounded-full h-9 pl-3 pr-1 gap-1.5 transition-all w-44 sm:w-60 md:w-68 lg:w-72 xl:w-80 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px] text-on-surface-muted flex-shrink-0 select-none">
                  search
                </span>
                <input
                  ref={catalogSearchRef}
                  type="text"
                  value={catalogSearch}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 250)}
                  onChange={(e) => {
                    setCatalogSearch(e.target.value);
                    setSearchFocused(true);
                  }}
                  placeholder="Search catalog or ask AI..."
                  className="bg-transparent text-xs font-sans text-on-surface placeholder:text-on-surface-muted/60 outline-none w-full min-w-0"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSearch('');
                      setSearchFocused(false);
                    }}
                    className="text-on-surface-muted hover:text-on-surface p-0.5 rounded-full flex-shrink-0"
                    title="Clear search"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
                {/* Integrated AI Engine Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSearchFocused(false);
                    if (catalogSearch.trim()) {
                      handleAiSearch(catalogSearch);
                    } else {
                      setView(view === 'search' ? 'store' : 'search');
                    }
                  }}
                  title={catalogSearch.trim() ? "Search with AI Intent" : "Toggle AI Engine"}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-sans text-[10px] uppercase font-bold tracking-wider transition-all flex-shrink-0 shadow-sm active:scale-95 group ${
                    view === 'search'
                      ? 'bg-accent text-on-surface hover:bg-[#bbf055]'
                      : 'bg-[#171717] hover:bg-black text-[#C7F36B]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px] group-hover:rotate-12 transition-transform">
                    auto_awesome
                  </span>
                  <span>AI</span>
                  <kbd className="hidden sm:inline font-mono text-[9px] opacity-70 ml-0.5">↵</kbd>
                </button>
              </form>

              {/* Autocomplete & Product Suggestions Dropdown */}
              {searchFocused && catalogSearch.trim().length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 w-72 sm:w-96 bg-white border border-border-subtle rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-border-subtle backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  <div className="px-3.5 py-2 bg-surface-subtle/80 flex items-center justify-between">
                    <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-on-surface-muted">
                      Matching Products ({searchSuggestions.length})
                    </span>
                    <span className="font-mono text-[9px] text-on-surface-muted">
                      Click to jump
                    </span>
                  </div>

                  {searchSuggestions.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto divide-y divide-border-subtle/60">
                      {searchSuggestions.map((prod) => {
                        const img = PRODUCT_IMAGES[prod.id];
                        return (
                          <div
                            key={prod.id}
                            onMouseDown={() => {
                              setCatalogSearch(prod.title);
                              setSearchFocused(false);
                              setView('store');
                              setTimeout(() => {
                                const targetEl = document.getElementById(`prod-${prod.id}`);
                                if (targetEl) {
                                  targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  targetEl.classList.add('ring-2', 'ring-accent', 'transition-all');
                                  setTimeout(() => targetEl.classList.remove('ring-2', 'ring-accent'), 2500);
                                } else {
                                  document.getElementById('curation')?.scrollIntoView({ behavior: 'smooth' });
                                }
                              }, 100);
                            }}
                            className="p-2.5 flex items-center gap-3 hover:bg-surface-subtle transition-colors cursor-pointer group text-left"
                          >
                            <div className="w-10 h-10 rounded-lg bg-surface-subtle overflow-hidden flex-shrink-0 border border-border-subtle">
                              {img ? (
                                <img src={img} alt={prod.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              ) : (
                                <span className="flex w-full h-full items-center justify-center text-lg">{prod.emoji || '📦'}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-sans text-xs font-bold text-on-surface truncate group-hover:text-black">
                                  {prod.title}
                                </p>
                                <span className="font-sans text-xs font-bold text-on-surface whitespace-nowrap">
                                  {inr(prod.price_paise)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="px-1.5 py-0.5 rounded bg-surface-card border border-border-subtle font-sans text-[9px] uppercase font-bold text-on-surface-muted">
                                  {prod.category}
                                </span>
                                {prod.stock <= 5 && prod.stock > 0 && (
                                  <span className="text-[10px] text-amber-700 font-medium">Only {prod.stock} left</span>
                                )}
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-[16px] text-on-surface-muted opacity-0 group-hover:opacity-100 transition-opacity">
                              arrow_forward
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="font-sans text-xs font-semibold text-on-surface">No exact catalog keyword</p>
                      <p className="font-body text-[11px] text-on-surface-muted mt-0.5">
                        No product matches "{catalogSearch}" directly in name.
                      </p>
                    </div>
                  )}

                  {/* Ask AI Footer Button */}
                  <div
                    onMouseDown={() => {
                      setSearchFocused(false);
                      handleAiSearch(catalogSearch);
                    }}
                    className="p-2.5 bg-black text-[#C7F36B] hover:bg-neutral-900 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[15px] text-[#C7F36B] flex-shrink-0 animate-pulse">
                        auto_awesome
                      </span>
                      <span className="font-sans text-xs font-bold truncate text-white">
                        Ask AI Intent: <span className="text-[#C7F36B] italic font-normal">"{catalogSearch}"</span>
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#C7F36B] text-black font-mono text-[9px] font-bold tracking-wider uppercase shrink-0">
                      AI ↵
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Clean Wishlist Icon Button */}
            <button
              aria-label="Wishlist"
              title="Wishlist"
              onClick={() => {
                showToast(wishCount > 0 ? `${wishCount} item(s) in Wishlist` : 'Wishlist is empty. Tap ♡ on any product.');
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors border ${wishCount > 0
                ? 'border-border-subtle bg-surface-card text-rose-600'
                : 'border-border-subtle bg-surface-card hover:bg-surface-subtle text-on-surface'
                }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {wishCount > 0 ? 'favorite' : 'favorite_border'}
              </span>
            </button>

            {/* Notification Bell Icon Button (Added as requested) */}
            <div className="relative">
              <button
                aria-label="Notifications"
                title="Notifications"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors border border-border-subtle bg-surface-card hover:bg-surface-subtle text-on-surface relative"
              >
                <span className="material-symbols-outlined text-[18px]">notifications</span>
                {notifList.filter((n) => n.unread).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-on-surface font-mono text-[9px] font-bold flex items-center justify-center rounded-full shadow-sm animate-pulse">
                    {notifList.filter((n) => n.unread).length}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-border-subtle rounded-2xl shadow-2xl z-50 p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                    <span className="font-sans text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">notifications_active</span>
                      Activity &amp; Alerts ({notifList.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifList((prev) => prev.map((n) => ({ ...n, unread: false })));
                        showToast('All notifications marked as read');
                      }}
                      className="font-sans text-[10px] text-on-surface-muted hover:text-on-surface underline uppercase font-semibold"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="divide-y divide-border-subtle max-h-72 overflow-y-auto mt-2">
                    {notifList.map((item) => (
                      <div
                        key={item.id}
                        className={`py-3 px-2 rounded-lg transition-colors ${
                          item.unread ? 'bg-surface-subtle/50' : 'hover:bg-surface-subtle/30'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-on-surface flex items-center gap-1.5">
                            {item.unread && <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>}
                            {item.title}
                          </span>
                          <span className="font-mono text-[9px] text-on-surface-muted">{item.time}</span>
                        </div>
                        <p className="font-body text-[11px] text-on-surface-muted mt-1 leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ops Console Switcher Pill */}
            <button
              onClick={() => setView(view === 'store' ? 'admin' : 'store')}
              className={`h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full border border-border-subtle font-sans text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition-colors ${view === 'admin'
                ? 'bg-on-surface text-accent border-on-surface'
                : 'bg-surface-card text-on-surface hover:bg-surface-subtle'
                }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {view === 'admin' ? 'storefront' : 'tune'}
              </span>
              <span>{view === 'admin' ? 'Store' : 'Ops'}</span>
            </button>

            {/* Cart Trigger */}
            <button
              className="h-9 flex items-center gap-2 px-3.5 rounded-full bg-on-surface text-white hover:bg-black transition-colors font-sans text-xs tracking-wider uppercase font-semibold whitespace-nowrap shadow-sm"
              onClick={() => setCartOpen(true)}
            >
              <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
              <span>Cart</span>
              <span className="px-1.5 py-0.5 rounded-full bg-accent text-on-surface font-bold text-[10px] leading-tight">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      {view === 'search' ? (
        <SearchResultsView
          initialQuery={intentInput || "I need a lightweight laptop bag for college, waterproof, under ₹2,500..."}
          onSearch={(q) => handleAiSearch(q)}
          isLoading={searchLoading}
          addToCart={addToCart}
          toggleWishlist={toggleWishlist}
          wishlist={wishlist}
          showToast={showToast}
          onOpenDemandRequest={() => {
            setView('store');
            setTimeout(() => {
              demandSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 250);
          }}
          onBackToHome={() => setView('store')}
        />
      ) : view === 'store' ? (
        <main className="w-full">
          {/* 2. HERO SECTION — EDITORIAL CAMPAIGN & IMMERSIVE CENTERPIECE */}
          <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-12 md:pt-20 pb-16 lg:pb-24 border-b border-border-subtle">
            {/* Top Micro-Tag Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-on-surface font-sans text-[11px] font-bold tracking-wider uppercase shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span>
                  Intelligent Product Discovery
                </span>
                <span className="text-xs font-sans font-medium text-on-surface-muted hidden sm:inline">
                  ✓ 100% Verified Live Catalog Stock
                </span>
              </div>
              <div className="text-xs font-sans text-on-surface-muted flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[16px] text-on-surface">local_shipping</span>
                <span>Express 2-Day Delivery</span>
                <span className="text-on-surface font-semibold"></span>
              </div>
            </div>

            {/* Main Asymmetric Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
              {/* Left Column: Editorial Typography & Intent Console */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div>
                  <h1 className="font-sans text-4xl sm:text-6xl xl:text-7xl font-bold uppercase tracking-tightest leading-[0.95] text-on-surface">
                    Shopping <br />
                    should <span className="serif-italic lowercase text-4xl sm:text-6xl xl:text-7xl font-normal text-on-surface tracking-normal inline-block ml-1">understand</span> <br />
                    you.
                  </h1>
                  <p className="font-body text-base sm:text-lg text-on-surface-muted max-w-xl mt-6 mb-10 leading-relaxed font-normal">
                    Tell us what you need in plain, natural human prose. Discover products calibrated to your posture, everyday movement, and budget ceiling.
                  </p>
                </div>

                {/* Natural Language Interactive Discovery Engine (Awwwards Grade) */}
                <div className="w-full bg-surface-card border border-border-subtle rounded-xl p-6 sm:p-7 shadow-editorial relative overflow-hidden" id="intent-engine">
                  {/* Frame Corner Marks */}
                  <div className="absolute top-2 left-2 text-[9px] text-border-subtle font-mono select-none">┌</div>
                  <div className="absolute top-2 right-2 text-[9px] text-border-subtle font-mono select-none">┐</div>
                  <div className="absolute bottom-2 left-2 text-[9px] text-border-subtle font-mono select-none">└</div>
                  <div className="absolute bottom-2 right-2 text-[9px] text-border-subtle font-mono select-none">┘</div>

                  {/* Terminal Header */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-border-subtle text-xs font-sans">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-accent"></span>
                      <span className="font-bold tracking-wider uppercase text-on-surface">AI INTENT ENGINE / V2.4</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-0.5 rounded bg-surface-subtle text-[10px] font-mono text-on-surface-muted uppercase">
                        SYNTACTIC PARSER LIVE
                      </span>
                    </div>
                  </div>

                  {/* Text Input Area */}
                  <div className="relative">
                    <label className="sr-only" htmlFor="intent-input">Enter what you are searching for</label>
                    <textarea
                      ref={intentInputRef}
                      className="w-full bg-[#FAF9F5] border border-border-subtle rounded-lg p-4 font-sans text-sm sm:text-base text-on-surface placeholder:text-on-surface-muted/60 focus:outline-none focus:ring-1 focus:ring-on-surface focus:border-on-surface transition-all resize-none leading-relaxed"
                      id="intent-input"
                      placeholder="I need a lightweight waterproof commuter bag for college, minimal aesthetics, under ₹2,500..."
                      rows="3"
                      value={intentInput}
                      onChange={(e) => setIntentInput(e.target.value)}
                    ></textarea>
                  </div>

                  {/* Bottom Control Row */}
                  <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-sans text-on-surface-muted">
                      <span className="material-symbols-outlined text-[16px] text-on-surface">psychology</span>
                      <span>Contextual parsing: materials, ergonomics, price thresholds.</span>
                    </div>
                    <button
                      className="px-6 py-3 rounded-lg bg-accent text-on-surface font-sans text-xs tracking-wider uppercase font-bold hover:bg-[#bbf055] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                      disabled={searchLoading || !intentInput.trim()}
                      onClick={() => handleAiSearch()}
                    >
                      {searchLoading ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                          <span>Decoding...</span>
                        </>
                      ) : (
                        <>
                          <span>Decode Intent</span>
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Curated Quick Prompt Pills */}
                  <div className="mt-5 pt-4 border-t border-border-subtle/80 flex flex-wrap items-center gap-2">
                    <span className="font-sans text-[11px] uppercase tracking-wider text-on-surface-muted font-semibold mr-1">Curated:</span>
                    <button
                      className="px-3 py-1 rounded-full border border-border-subtle bg-surface hover:bg-surface-subtle text-on-surface text-xs font-sans transition-colors"
                      onClick={() => handleAiSearch('Minimal study ergonomics with quiet mechanical switches under ₹2,000')}
                    >
                      Minimal study ergonomics
                    </button>
                    <button
                      className="px-3 py-1 rounded-full border border-border-subtle bg-surface hover:bg-surface-subtle text-on-surface text-xs font-sans transition-colors"
                      onClick={() => handleAiSearch('Waterproof tech backpack under ₹3,000 with clean silhouette')}
                    >
                      Travel essentials under ₹3,000
                    </button>
                    <button
                      className="px-3 py-1 rounded-full border border-border-subtle bg-surface hover:bg-surface-subtle text-on-surface text-xs font-sans transition-colors"
                      onClick={() => handleAiSearch('Matte black desk organizers with solid architectural balance')}
                    >
                      Matte black tech accessories
                    </button>
                  </div>

                  {/* Real-time Status Overlay */}
                  {searchLoading && (
                    <div className="mt-4 p-3 bg-surface-subtle rounded-lg border border-border-subtle flex items-center justify-between text-xs font-sans">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] animate-spin text-on-surface">sync</span>
                        <span className="font-medium text-on-surface">Synthesizing semantic weights... Querying catalog.</span>
                      </div>
                      <span className="font-mono text-[10px] text-on-surface-muted">LATENCY: ~80MS</span>
                    </div>
                  )}

                  {searchResult && (
                    <div className="mt-4 p-3 bg-[#EAE7DF] rounded-lg border border-border-subtle flex items-center justify-between text-xs font-sans">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-black">task_alt</span>
                        <span className="font-bold text-on-surface">
                          {searchResult.products?.length || 0} catalog product(s) found for your request.
                        </span>
                      </div>
                      <button
                        onClick={() => setSearchResult(null)}
                        className="text-[10px] uppercase font-bold text-on-surface-muted hover:text-on-surface"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Asymmetric High-Fashion Hero Vignette */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="relative group">
                  {/* Product Highlight Tag */}
                  <div className="absolute -top-3 left-6 z-20 px-3 py-1 bg-on-surface text-accent font-sans text-[10px] tracking-editorial font-bold uppercase rounded-sm shadow-md">
                    FEATURED // WATERPROOF COMMUTER
                  </div>

                  {/* Outer Asymmetric Frame with Hover Zoom */}
                  <div className="w-full aspect-[4/5] bg-surface-subtle border border-border-subtle rounded-2xl overflow-hidden p-3 relative transition-all duration-500 group-hover:border-on-surface">
                    <div className="w-full h-full rounded-xl overflow-hidden relative bg-[#E2DFD6]">
                      <img
                        alt="AeroShield Waterproof 24L Commuter Bag"
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                        src={PRODUCT_IMAGES.prod_001}
                      />
                      {/* Overlay Vignette Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 pointer-events-none"></div>

                      {/* Floating Interactive Metadata Nodes */}
                      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                        <div className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur text-on-surface font-sans text-xs font-bold shadow-md">
                          ₹2,499
                        </div>
                        <div className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur text-white font-mono text-[10px] tracking-wider uppercase">
                          SEALED ROLLTOP
                        </div>
                      </div>

                      {/* Bottom Floating Spec Card */}
                      <div className="absolute bottom-4 left-4 right-4 z-10 p-4 rounded-xl bg-surface-card/95 backdrop-blur-md border border-border-subtle shadow-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-sans text-[10px] tracking-editorial uppercase text-on-surface-muted block font-semibold">
                              VERIFIED IN STOCK
                            </span>
                            <h4 className="font-sans text-base font-bold text-on-surface leading-tight mt-0.5">
                              AeroShield Waterproof 24L
                            </h4>
                          </div>
                          <button
                            className="w-9 h-9 rounded-full bg-accent text-on-surface flex items-center justify-center font-bold hover:scale-105 transition-transform shadow-sm"
                            onClick={() => {
                              const prod = allProducts.find((p) => p.id === 'prod_001');
                              if (prod) addToCart(prod);
                            }}
                          >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                          </button>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] font-sans text-on-surface-muted">
                          <span>16" TECH SLEEVE</span>
                          <span>420D CORDURA®</span>
                          <span className="text-on-surface font-semibold">2-DAY DISPATCH</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3. UNCONVENTIONAL CATEGORY DISCOVERY (ASYMMETRIC EDITORIAL GRID) */}
          <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 lg:py-24 border-b border-border-subtle" id="categories">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10 border-b border-border-subtle mb-12">
              <div>
                <span className="font-sans text-xs tracking-editorial uppercase text-on-surface-muted font-bold block mb-2">
                  01 / INTENT-DRIVEN TAXONOMY
                </span>
                <h2 className="font-sans text-3xl sm:text-5xl font-bold uppercase tracking-tighter text-on-surface">
                  Explore by <span className="serif-italic font-normal lowercase tracking-normal">what you need.</span>
                </h2>
              </div>
              <p className="font-body text-sm text-on-surface-muted max-w-md">
                Structured around contextual activities, micro-environments, and daily behavioral workflows instead of static retailer categories.
              </p>
            </div>

            {/* Asymmetric Modular Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* Block 1: Work & Study (7 cols) */}
              <button
                onClick={() => {
                  setSelectedCategory('stationery');
                  document.getElementById('curation')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="md:col-span-7 group relative bg-surface-card border border-border-subtle rounded-2xl p-8 lg:p-10 flex flex-col justify-between hover:border-on-surface transition-all duration-300 min-h-[360px] overflow-hidden text-left"
              >
                <div className="relative z-10 flex items-start justify-between w-full">
                  <div className="flex flex-col">
                    <span className="px-2.5 py-1 rounded-full bg-surface-subtle font-sans text-[11px] uppercase tracking-wider font-semibold text-on-surface w-fit mb-3">
                      142 VERIFIED ITEMS
                    </span>
                    <h3 className="font-sans text-2xl sm:text-4xl font-bold uppercase tracking-tight text-on-surface group-hover:text-black">
                      Work &amp; Study
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-full border border-border-subtle group-hover:bg-on-surface group-hover:text-accent group-hover:border-on-surface flex items-center justify-center transition-all duration-300">
                    <span className="material-symbols-outlined text-[20px]">arrow_outward</span>
                  </div>
                </div>
                <div className="relative z-10 pt-12">
                  <p className="font-body text-sm sm:text-base text-on-surface-muted max-w-md mb-4 leading-relaxed">
                    Curated desk ergonomics, task illumination, solid hardwood organizers, and deep focus peripherals crafted for 8+ hour cognitive sprints.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border-subtle/80">
                    <span className="text-[11px] font-sans px-2.5 py-1 rounded bg-surface-subtle text-on-surface font-medium">Silent Switches</span>
                    <span className="text-[11px] font-sans px-2.5 py-1 rounded bg-surface-subtle text-on-surface font-medium">Walnut Joinery</span>
                    <span className="text-[11px] font-sans px-2.5 py-1 rounded bg-surface-subtle text-on-surface font-medium">Cable Architecture</span>
                  </div>
                </div>
                <div className="absolute right-4 bottom-1 font-sans text-[100px] sm:text-[120px] font-extrabold leading-none text-surface-subtle/80 select-none pointer-events-none group-hover:text-accent/30 transition-colors">
                  01
                </div>
              </button>

              {/* Block 2: Everyday Essentials (5 cols) */}
              <button
                onClick={() => {
                  setSelectedCategory('accessories');
                  document.getElementById('curation')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="md:col-span-5 group relative bg-surface-subtle border border-border-subtle rounded-2xl p-8 flex flex-col justify-between hover:border-on-surface transition-all duration-300 min-h-[360px] overflow-hidden text-left"
              >
                <div className="flex items-start justify-between w-full">
                  <span className="px-2.5 py-1 rounded-full bg-surface-card font-sans text-[11px] uppercase tracking-wider font-semibold text-on-surface">
                    88 ITEMS
                  </span>
                  <div className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center group-hover:bg-on-surface group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[18px]">north_east</span>
                  </div>
                </div>
                <div className="pt-8">
                  <h3 className="font-sans text-2xl sm:text-3xl font-bold uppercase tracking-tight text-on-surface mb-3">
                    Everyday Essentials
                  </h3>
                  <p className="font-body text-xs sm:text-sm text-on-surface-muted leading-relaxed">
                    Modular carry, titanium key clips, thermal vessels, and tactile pocket accessories built for unyielding durability.
                  </p>
                </div>
              </button>

              {/* Block 3: Travel & Adventure (5 cols) */}
              <button
                onClick={() => {
                  setSelectedCategory('bags');
                  document.getElementById('curation')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="md:col-span-5 group relative bg-surface-subtle border border-border-subtle rounded-2xl p-8 flex flex-col justify-between hover:border-on-surface transition-all duration-300 min-h-[320px] overflow-hidden text-left"
              >
                <div className="flex items-start justify-between w-full">
                  <span className="px-2.5 py-1 rounded-full bg-surface-card font-sans text-[11px] uppercase tracking-wider font-semibold text-on-surface">
                    64 ITEMS
                  </span>
                  <div className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center group-hover:bg-on-surface group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[18px]">north_east</span>
                  </div>
                </div>
                <div className="pt-8">
                  <h3 className="font-sans text-2xl sm:text-3xl font-bold uppercase tracking-tight text-on-surface mb-3">
                    Travel &amp; Adventure
                  </h3>
                  <p className="font-body text-xs sm:text-sm text-on-surface-muted leading-relaxed">
                    Weather-sealed ripstop bags, compression packing modules, and ultra-compact adapters for agile transit.
                  </p>
                </div>
              </button>

              {/* Block 4: Home & Living (7 cols) */}
              <button
                onClick={() => {
                  setSelectedCategory('electronics');
                  document.getElementById('curation')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="md:col-span-7 group relative bg-surface-card border border-border-subtle rounded-2xl p-8 lg:p-10 flex flex-col justify-between hover:border-on-surface transition-all duration-300 min-h-[320px] overflow-hidden text-left"
              >
                <div className="relative z-10 flex items-start justify-between w-full">
                  <div className="flex flex-col">
                    <span className="px-2.5 py-1 rounded-full bg-surface-subtle font-sans text-[11px] uppercase tracking-wider font-semibold text-on-surface w-fit mb-3">
                      112 CURATED PIECES
                    </span>
                    <h3 className="font-sans text-2xl sm:text-4xl font-bold uppercase tracking-tight text-on-surface">
                      Home &amp; Living
                    </h3>
                  </div>
                  <div className="w-12 h-12 rounded-full border border-border-subtle group-hover:bg-on-surface group-hover:text-accent group-hover:border-on-surface flex items-center justify-center transition-all duration-300">
                    <span className="material-symbols-outlined text-[20px]">arrow_outward</span>
                  </div>
                </div>
                <div className="relative z-10 pt-8">
                  <p className="font-body text-sm sm:text-base text-on-surface-muted max-w-lg mb-4 leading-relaxed">
                    Architectural ceramics, matte powder-coated steel shelving, air-purifying stoneware, and sensory living fixtures.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border-subtle/80">
                    <span className="text-[11px] font-sans px-2.5 py-1 rounded bg-surface-subtle text-on-surface font-medium">Stone Ceramics</span>
                    <span className="text-[11px] font-sans px-2.5 py-1 rounded bg-surface-subtle text-on-surface font-medium">Ambient Light</span>
                    <span className="text-[11px] font-sans px-2.5 py-1 rounded bg-surface-subtle text-on-surface font-medium">Organic Fiber</span>
                  </div>
                </div>
              </button>
            </div>
          </section>

          {/* 4. FEATURED EDITORIAL PRODUCT SHOWCASE */}
          <section className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16 lg:py-24 border-b border-border-subtle" id="curation">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10 border-b border-border-subtle mb-12">
              <div>
                <span className="font-sans text-xs tracking-editorial uppercase text-on-surface-muted font-bold block mb-2">
                  02 / ALL PRODUCTS
                </span>
                <h2 className="font-sans text-3xl sm:text-5xl font-bold uppercase tracking-tighter text-on-surface">
                  All Products <span className="serif-italic font-normal lowercase tracking-normal">matched to human intent.</span>
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCategory(c)}
                    className={`px-3 py-1 rounded-full text-xs font-sans uppercase font-bold tracking-wider transition ${selectedCategory.toLowerCase() === c.toLowerCase()
                      ? 'bg-on-surface text-white'
                      : 'border border-border-subtle bg-surface-card text-on-surface-muted hover:text-on-surface'
                      }`}
                  >
                    {c === 'All' ? 'All Products' : c}
                  </button>
                ))}
              </div>
            </div>

            {/* If search result has no matches, show the Demand Radar Alert */}
            {searchResult && searchResult.products?.length === 0 && (
              <div className="mb-12 rounded-2xl border border-border-subtle bg-surface-card p-8 shadow-editorial">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-accent text-on-surface flex items-center justify-center flex-shrink-0 font-bold text-2xl">
                    ❋
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <span className="inline-block px-3 py-0.5 rounded-full bg-accent text-on-surface font-sans text-[10px] font-bold tracking-wider uppercase mb-2">
                      CATALOG GAP LOGGED
                    </span>
                    <h3 className="font-sans text-xl font-bold uppercase text-on-surface">
                      No exact catalog product matched your query: “{intentInput}”
                    </h3>
                    <p className="mt-1 font-body text-xs text-on-surface-muted leading-relaxed">
                      We have captured this specification in the <strong>Merchant Demand Radar</strong>. Our merchant network can source and stock this requested product.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      demandSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-6 py-3 rounded-lg bg-on-surface text-white hover:bg-black font-sans text-xs tracking-wider uppercase font-bold whitespace-nowrap"
                  >
                    Request This Product →
                  </button>
                </div>
              </div>
            )}

            {/* Variable Sized Editorial Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
              {(searchResult?.products?.length ? searchResult.products : filteredProducts).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={addToCart}
                  onWishlist={toggleWishlist}
                  isWished={Boolean(wishlist[product.id])}
                />
              ))}
            </div>
          </section>

          {/* 5. BRAND STORYTELLING & MANIFESTO */}
          <section className="w-full bg-[#EAE7DF] border-b border-border-subtle py-20 lg:py-28 px-6 lg:px-12" id="manifesto">
            <div className="max-w-[1440px] mx-auto">
              <div className="max-w-4xl">
                <span className="font-sans text-xs tracking-editorial uppercase text-on-surface-muted font-bold block mb-4">
                  OUR MANIFESTO / ESSAY 01
                </span>
                <blockquote className="font-sans text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-on-surface leading-[1.05] uppercase">
                  "Commerce built on <span className="serif-italic font-normal lowercase tracking-normal">human intent,</span> not keyword manipulation."
                </blockquote>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-16 pt-12 border-t border-border-subtle">
                <div className="flex flex-col">
                  <span className="font-sans text-4xl lg:text-5xl font-bold text-on-surface tracking-tighter">0.00%</span>
                  <span className="font-sans text-xs font-bold uppercase tracking-wider text-on-surface mt-2 mb-3">Sponsored Placement Spam</span>
                  <p className="font-body text-xs sm:text-sm text-on-surface-muted leading-relaxed">
                    Every merchant on ShelfSense is ranked exclusively on how completely their physical craftsmanship aligns with your stated use case, ergonomics, and material preferences.
                  </p>
                </div>
                <div className="flex flex-col">
                  <span className="font-sans text-4xl lg:text-5xl font-bold text-on-surface tracking-tighter">12,400+</span>
                  <span className="font-sans text-xs font-bold uppercase tracking-wider text-on-surface mt-2 mb-3">Validated Parameters</span>
                  <p className="font-body text-xs sm:text-sm text-on-surface-muted leading-relaxed">
                    From tensile strength and waterproof seam welding to tactile actuation weight. Products are cataloged down to tactile substance, not marketing hype.
                  </p>
                </div>
                <div className="flex flex-col">
                  <span className="font-sans text-4xl lg:text-5xl font-bold text-on-surface tracking-tighter">72 HR</span>
                  <span className="font-sans text-xs font-bold uppercase tracking-wider text-on-surface mt-2 mb-3">Maker Response Loop</span>
                  <p className="font-body text-xs sm:text-sm text-on-surface-muted leading-relaxed">
                    When catalog matches fail, your request is directly piped to our verified network of independent studios, leatherworkers, and industrial prototypers.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 6. DEMAND-GAP DISCOVERY PANEL (UNMET DEMAND ENGINE) */}
          <section ref={demandSectionRef} className="max-w-[1440px] mx-auto px-6 lg:px-12 py-20 lg:py-28 border-b border-border-subtle" id="demand-gap">
            <div className="w-full bg-surface-card border border-border-subtle rounded-3xl p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-sm">
              <div className="absolute right-0 top-0 w-1/3 h-full border-l border-border-subtle hidden lg:block pointer-events-none opacity-40">
                <div className="h-1/2 border-b border-border-subtle"></div>
              </div>
              <div className="max-w-2xl relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-on-surface font-sans text-xs font-bold tracking-wider uppercase mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                  CUSTOM SOURCING REQUEST
                </div>
                <h2 className="font-sans text-3xl sm:text-5xl font-bold uppercase tracking-tight text-on-surface leading-tight">
                  Can’t find what <br />
                  you’re <span className="serif-italic font-normal lowercase tracking-normal">looking for?</span>
                </h2>
                <p className="font-body text-base text-on-surface-muted mt-6 mb-8 leading-relaxed">
                  Submit your specific requirements and budget constraints. Your request is logged into our Merchant Demand Radar so our partner network can source and stock the exact product you need.
                </p>

                <form onSubmit={handleDemandSubmit} className="space-y-4">
                  <div>
                    <label className="block font-sans text-xs uppercase tracking-wider font-bold text-on-surface mb-2">
                      PRODUCT DESCRIPTION &amp; REQUIREMENTS
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="e.g. 15.6-inch waterproof commuter rolltop under ₹2,000"
                      value={demandQuery}
                      onChange={(e) => setDemandQuery(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-sans text-xs uppercase tracking-wider font-bold text-on-surface mb-2">
                        CATEGORY
                      </label>
                      <select
                        className="input capitalize"
                        value={demandCategory}
                        onChange={(e) => setDemandCategory(e.target.value)}
                      >
                        <option value="bags">Travel &amp; Carry</option>
                        <option value="shoes">Footwear &amp; Trail</option>
                        <option value="electronics">Focus Electronics</option>
                        <option value="apparel">Technical Apparel</option>
                        <option value="accessories">Modular Everyday</option>
                        <option value="stationery">Stationery &amp; Desk</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-sans text-xs uppercase tracking-wider font-bold text-on-surface mb-2">
                        MAX BUDGET CEILING (₹)
                      </label>
                      <input
                        type="number"
                        min="100"
                        className="input"
                        placeholder="2500"
                        value={demandBudget}
                        onChange={(e) => setDemandBudget(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <button
                      type="submit"
                      disabled={demandSubmitting || !demandQuery.trim()}
                      className="px-8 py-4 rounded-xl bg-accent text-on-surface font-sans text-xs tracking-wider uppercase font-bold hover:bg-[#bbf055] transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-40"
                    >
                      <span>{demandSubmitting ? 'Submitting to Radar…' : 'Submit Unmet Request'}</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                    <a
                      className="px-6 py-4 rounded-xl border border-border-subtle bg-surface-subtle hover:bg-white text-on-surface font-sans text-xs tracking-wider uppercase font-semibold text-center transition-colors"
                      href="#manifesto"
                    >
                      Maker Standards Charter
                    </a>
                  </div>
                </form>

                <div className="mt-8 pt-6 border-t border-border-subtle flex items-center gap-3 text-xs font-sans text-on-surface-muted">
                  <span className="material-symbols-outlined text-[18px] text-on-surface">verified_user</span>
                  <span>Over 1,240 custom requests successfully manufactured and delivered across India this season.</span>
                </div>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <MerchantDemandRadar
          onBackToStore={() => setView('store')}
          showToast={showToast}
          overviewData={adminOverview}
          onRefreshData={fetchAdminOverview}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        products={allProducts}
        onQty={setQty}
        onCheckout={checkout}
        checkoutState={checkoutState}
      />

      {/* 7. LUXURY EDITORIAL FOOTER */}
      <footer className="w-full bg-[#171717] text-[#FAF9F5] pt-20 pb-12 px-6 lg:px-12 border-t border-[#303030]">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-16 border-b border-[#303030]">
            <div className="lg:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-accent text-2xl font-bold">❋</span>
                  <span className="font-display font-extrabold text-2xl tracking-tight text-white">Shelf<span className="font-serif italic font-normal text-[24px] text-white/90">Sense</span></span>
                </div>
                <p className="font-body text-xs sm:text-sm text-[#A5A29B] mt-4 max-w-sm leading-relaxed">
                  An algorithmic atelier. Natural language product discovery shaped entirely around human physiology, context, and honest utility.
                </p>
              </div>
              <div className="mt-8">
                <span className="font-sans text-[11px] font-bold tracking-editorial uppercase text-[#A5A29B] block mb-2">
                  DISPATCH GAZETTE // WEEKLY ESSAYS
                </span>
                <div className="flex items-center max-w-md">
                  <input
                    className="w-full bg-[#242321] border border-[#3E3C38] rounded-l-lg px-4 py-3 text-xs font-sans text-white placeholder:text-[#7A776F] focus:outline-none focus:border-accent"
                    placeholder="Enter your email for architectural releases"
                    type="email"
                  />
                  <button
                    onClick={() => showToast('Subscribed to Dispatch Gazette.')}
                    className="px-5 py-3 rounded-r-lg bg-accent text-black font-sans text-xs tracking-wider uppercase font-bold hover:bg-[#bbf055] transition-colors whitespace-nowrap"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs font-sans">
              <div className="flex flex-col gap-3">
                <span className="font-bold tracking-editorial uppercase text-white pb-1 border-b border-[#303030]">EXPLORE</span>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#curation">Catalog Index</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#categories">Work &amp; Study</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#categories">Everyday Carry</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#categories">Travel Gear</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#categories">Architectural Living</a>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-bold tracking-editorial uppercase text-white pb-1 border-b border-[#303030]">DEMAND ENGINE</span>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#demand-gap">Submit Request</a>
                <button onClick={() => setView('admin')} className="text-left text-[#A5A29B] hover:text-white transition-colors">Merchant Radar</button>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#manifesto">Maker Registry</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#manifesto">Material Standards</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#manifesto">Transparency Log</a>
              </div>
              <div className="flex flex-col gap-3 col-span-2 sm:col-span-1">
                <span className="font-bold tracking-editorial uppercase text-white pb-1 border-b border-[#303030]">ATELIER</span>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#manifesto">Manifesto</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#manifesto">System Changelog</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#manifesto">Press &amp; Awards</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#manifesto">Privacy Charter</a>
                <a className="text-[#A5A29B] hover:text-white transition-colors" href="#manifesto">Terms of Exchange</a>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-sans text-[#7A776F]">
            <div>
              © 2025 SHELFSENSE ATELIER INC. ALL RIGHTS RESERVED. CRAFTED FOR INTENT COMMERCE.
            </div>
            <div className="flex items-center gap-6">
              <span className="hover:text-white cursor-pointer">AWWWARDS SITE OF THE DAY</span>
              <span className="text-white font-mono">INR (₹) / NEW DELHI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
