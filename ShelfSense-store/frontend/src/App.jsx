import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchResultsView from './components/SearchResultsView';
import MerchantDemandRadar from './components/MerchantDemandRadar';
import { startHybridVoiceSession } from './utils/voiceTranscriber';
import { api } from './services/api';

const inr = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Curated studio-grade imagery for all 25 catalog products
const PRODUCT_IMAGES = {
  // Bags & Packs
  prod_001: 'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?auto=format&fit=crop&w=1200&q=80',
  prod_002: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
  prod_003: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80',
  prod_023: '/products/prod_023.jpg',

  // Tech & Everyday Carry Accessories
  prod_004: '/products/prod_004.jpg',
  prod_005: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80',
  prod_011: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
  prod_012: '/products/prod_012.jpg',
  prod_024: '/products/prod_024.jpg',
  prod_025: '/products/prod_025.jpg',

  // Trail & Urban Footwear
  prod_006: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80',
  prod_007: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=800&q=80',
  prod_008: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',

  // Technical Apparel
  prod_009: '/products/prod_009.jpg',
  prod_010: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',

  // Focus Hardware & Electronics
  prod_013: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80',
  prod_014: '/products/prod_014.jpg',
  prod_015: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
  prod_016: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
  prod_017: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
  prod_021: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80',
  prod_022: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80',

  // Work & Study Stationery
  prod_018: '/products/prod_018.jpg',
  prod_019: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=800&q=80',
  prod_020: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=800&q=80',
};

const CATEGORY_ITEMS = [
  { id: 'all', title: 'All Collections', icon: 'grid_view', desc: 'Browse full atelier catalog' },
  { id: 'bags', title: 'Travel & Backpacks', icon: 'backpack', desc: 'Waterproof rolltops & commuter slings' },
  { id: 'apparel', title: 'Technical Apparel', icon: 'checkroom', desc: 'Weatherproof outerwear & layers' },
  { id: 'electronics', title: 'Focus Hardware', icon: 'headphones', desc: 'Mechanical peripherals & acoustics' },
  { id: 'accessories', title: 'Everyday Tech & Carry', icon: 'devices', desc: 'Minimalist cables, sleeves & gear' },
  { id: 'shoes', title: 'Trail & Footwear', icon: 'footprint', desc: 'Ergonomic urban runners & trail shoes' },
  { id: 'stationery', title: 'Work & Study', icon: 'edit_note', desc: 'Solid walnut organizers & desk ergonomics' },
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

export function getProductImage(product) {
  if (!product) return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80';
  if (PRODUCT_IMAGES[product.id]) return PRODUCT_IMAGES[product.id];
  if (product.attributes?.image_url) return product.attributes.image_url;
  if (product.image_url) return product.image_url;

  const text = `${product.title || ''} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  if (anyWord(text, ['backpack', 'rolltop', 'aeroshield', 'featherweight', 'commuter pack'])) {
    return PRODUCT_IMAGES.prod_001;
  }
  if (anyWord(text, ['sling', 'crossbody', 'courier'])) return PRODUCT_IMAGES.prod_003;
  if (anyWord(text, ['tote'])) return PRODUCT_IMAGES.prod_023;
  if (anyWord(text, ['sleeve', 'neoprene'])) return PRODUCT_IMAGES.prod_004;
  if (anyWord(text, ['organizer', 'walnut', 'station', 'bamboo'])) return PRODUCT_IMAGES.prod_018;
  if (anyWord(text, ['stand', 'riser'])) return PRODUCT_IMAGES.prod_025;
  if (anyWord(text, ['hub', 'dock', 'usb'])) return PRODUCT_IMAGES.prod_014;
  if (anyWord(text, ['charger', 'gan', 'power bank'])) return PRODUCT_IMAGES.prod_010;
  if (anyWord(text, ['bottle', 'sipper', 'flask'])) return PRODUCT_IMAGES.prod_012;
  if (anyWord(text, ['umbrella'])) return PRODUCT_IMAGES.prod_024;
  if (anyWord(text, ['jacket', 'rain', 'outerwear'])) return PRODUCT_IMAGES.prod_009;
  if (anyWord(text, ['shoe', 'runner', 'sneaker', 'trail'])) return PRODUCT_IMAGES.prod_006;
  if (anyWord(text, ['earbud', 'headphone', 'audio', 'anc'])) return PRODUCT_IMAGES.prod_013;
  if (anyWord(text, ['keyboard', 'switch', 'mouse'])) return PRODUCT_IMAGES.prod_015;
  if (anyWord(text, ['lamp', 'light'])) return PRODUCT_IMAGES.prod_021;

  const cat = (product.category || '').toLowerCase();
  if (cat === 'bags') return PRODUCT_IMAGES.prod_001;
  if (cat === 'accessories') return PRODUCT_IMAGES.prod_012;
  if (cat === 'electronics') return PRODUCT_IMAGES.prod_010;
  if (cat === 'stationery') return PRODUCT_IMAGES.prod_018;
  if (cat === 'apparel') return PRODUCT_IMAGES.prod_009;
  if (cat === 'shoes') return PRODUCT_IMAGES.prod_006;

  return PRODUCT_IMAGES.prod_001;
}

function anyWord(text, words) {
  return words.some((w) => text.includes(w));
}

function ProductCard({ product, onAdd, onWishlist, isWished }) {
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const imgUrl = getProductImage(product);

  return (
    <article id={`prod-${product.id}`} className="group relative bg-surface-card border border-border-subtle rounded-2xl overflow-hidden hover:border-on-surface transition-all duration-500 flex flex-col justify-between">
      <div>
        <div className="relative w-full aspect-[4/3] bg-surface-subtle overflow-hidden">
          {imgUrl ? (
            <img
              alt={product.title}
              src={imgUrl}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80';
              }}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="flex w-full h-full items-center justify-center bg-surface-subtle group-hover:scale-105 transition-transform duration-700 ease-out">
              <span className="material-symbols-outlined text-5xl text-on-surface-muted/60">inventory_2</span>
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
            <span
              className={`material-symbols-outlined text-[18px] ${isWished ? 'material-symbols-filled text-rose-600' : ''}`}
              style={isWished ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {isWished ? 'favorite' : 'favorite_border'}
            </span>
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-3 min-h-[3.25rem]">
            <h3 className="font-sans text-base sm:text-lg font-bold uppercase tracking-tight text-on-surface group-hover:text-black leading-snug line-clamp-2">
              {product.title}
            </h3>
            <span className="font-sans text-base sm:text-lg font-bold text-on-surface whitespace-nowrap shrink-0 mt-0.5">
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
            const itemImg = getProductImage(product);
            return (
              <div key={product.id} className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-card p-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-subtle overflow-hidden flex-shrink-0 border border-border-subtle">
                  {itemImg ? (
                    <img src={itemImg} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-on-surface-muted">inventory_2</span>
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
                Order confirmed. Your package is being prepared for dispatch.
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
            {checkoutState.loading ? 'Securing your order…' : 'Complete Checkout'}
          </button>
          <p className="mt-2.5 text-center font-mono text-[10px] text-on-surface-muted">
            SECURE 256-BIT ENCRYPTION · INSTANT CONFIRMATION
          </p>
        </div>
      </aside>
    </div>
  );
}

function WishlistDrawer({ open, onClose, wishlist, products, onAddToCart, onRemoveWishlist }) {
  const wishItems = Object.entries(wishlist)
    .filter(([_, isWishlisted]) => isWishlisted)
    .map(([id]) => products.find((p) => p.id === id))
    .filter(Boolean);

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
            <span className="material-symbols-outlined text-[20px] text-rose-600">favorite</span>
            <span className="font-sans font-bold text-lg uppercase tracking-tight text-on-surface">Your Wishlist</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-sans text-[11px] font-bold">
              {wishItems.length}
            </span>
          </div>
          <button className="p-1 rounded text-on-surface-muted hover:text-on-surface transition-colors" onClick={onClose}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {wishItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="material-symbols-outlined text-4xl mb-3 text-rose-300">favorite_border</span>
              <p className="font-sans text-sm font-bold uppercase tracking-wider text-on-surface">Your Wishlist is empty</p>
              <p className="mt-1 font-body text-xs text-on-surface-muted">Tap the heart icon on any product to save it for later.</p>
            </div>
          )}

          {wishItems.map((product) => {
            const itemImg = getProductImage(product);
            return (
              <div key={product.id} className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-card p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-subtle overflow-hidden flex-shrink-0 border border-border-subtle">
                  {itemImg ? (
                    <img src={itemImg} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-on-surface-muted">inventory_2</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-on-surface-muted block">{product.category}</span>
                  <p className="truncate font-sans text-xs font-bold uppercase text-on-surface mt-0.5">{product.title}</p>
                  <p className="font-mono text-xs font-bold text-on-surface mt-1">{inr(product.price_paise)}</p>
                  <div className="mt-2.5 flex items-stretch gap-2">
                    <button
                      onClick={() => {
                        onAddToCart(product);
                        onRemoveWishlist(product.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-accent text-on-surface font-sans text-[11px] font-bold uppercase tracking-wider hover:bg-[#bbf055] transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[13px]">shopping_cart</span>
                      <span>Move to Cart</span>
                    </button>
                    <button
                      onClick={() => onRemoveWishlist(product.id)}
                      className="aspect-square rounded-lg border border-border-subtle text-on-surface-muted hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center justify-center shrink-0"
                      title="Remove from wishlist"
                    >
                      <span className="material-symbols-outlined text-[15px] leading-none">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
          <p className="mt-1 text-[11px] text-on-surface-muted">Live PostgreSQL sync</p>
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
                        <span className="material-symbols-outlined text-lg text-on-surface-muted">inventory_2</span>
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
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setToastVisible(true);
  }, []);

  // Keyword & AI Intent Search
  const [catalogSearch, setCatalogSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const searchSuggestions = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return allProducts
      .filter((p) => {
        const title = (p.title || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const tags = (p.tags || []).map((t) => t.toLowerCase());
        return tokens.some(
          (tok) =>
            title.includes(tok) ||
            category.includes(tok) ||
            tags.some((t) => t.includes(tok))
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
      title: 'Catalog Inventory Updated',
      message: 'Warehouse inventory synchronized with live catalog.',
      time: '2h ago',
      unread: false,
    },
  ]);

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

  const [adminOverview, setAdminOverview] = useState(null);
  const fetchAdminOverview = useCallback(async () => {
    try {
      const data = await api('/api/admin/overview');
      setAdminOverview(data);
      await loadAllProducts();
    } catch {
      // Graceful
    }
  }, [loadAllProducts]);

  useEffect(() => {
    fetchAdminOverview();
  }, [fetchAdminOverview]);

  // Viewport scroll reset: Every time the user navigates between views or categories, scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [view, selectedCategory]);

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
    let list = allProducts;
    if (selectedCategory && selectedCategory.toLowerCase() !== 'all') {
      list = list.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase().trim();
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter((p) => {
        const title = (p.title || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const tags = (p.tags || []).map((t) => t.toLowerCase());
        return tokens.some(
          (tok) =>
            title.includes(tok) ||
            category.includes(tok) ||
            tags.some((t) => t.includes(tok))
        );
      });
    }
    return list;
  }, [allProducts, selectedCategory, catalogSearch]);

  const addToCart = (product) => {
    if (!product || !product.id) return;
    setAllProducts((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      return [...prev, product];
    });
    const maxStock = product.stock && product.stock > 0 ? product.stock : 10;
    setCart((c) => ({
      ...c,
      [product.id]: Math.min((c[product.id] || 0) + 1, maxStock),
    }));
    showToast(`Added ${product.title} to cart`);
    setCheckoutState({ loading: false, order: null, error: '' });
    setCartOpen(true);
  };

  const toggleWishlist = (productOrId) => {
    const id = typeof productOrId === 'object' ? productOrId.id : productOrId;
    if (!id) return;
    if (typeof productOrId === 'object') {
      setAllProducts((prev) => {
        if (prev.some((p) => p.id === id)) return prev;
        return [...prev, productOrId];
      });
    }
    setWishlist((w) => {
      const next = !w[id];
      showToast(next ? 'Saved to Wishlist' : 'Removed from Wishlist');
      return { ...w, [id]: next };
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
    setView('search');

    try {
      const res = await api('/api/ai/shop', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });
      setSearchResult(res);
      if (res.products && res.products.length > 0) {
        setAllProducts((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          res.products.forEach((p) => map.set(p.id, p));
          return Array.from(map.values());
        });
      }
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

  // Dual-Engine (Hybrid) Speech Recognition inside Header Search Bar
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const voiceSessionRef = useRef(null);
  const voiceDebounceTimerRef = useRef(null);

  const stopVoiceListening = useCallback(async () => {
    if (voiceDebounceTimerRef.current) {
      clearTimeout(voiceDebounceTimerRef.current);
      voiceDebounceTimerRef.current = null;
    }
    if (voiceSessionRef.current) {
      const session = voiceSessionRef.current;
      voiceSessionRef.current = null;
      setIsVoiceListening(false);
      setIsSpeaking(false);
      const text = await session.stop();
      if (text && text.trim()) {
        setCatalogSearch(text.trim());
        setSearchFocused(true);
        handleAiSearch(text.trim());
      }
    } else {
      setIsVoiceListening(false);
      setIsSpeaking(false);
    }
  }, [handleAiSearch]);

  const toggleHeaderVoice = useCallback(async () => {
    if (isVoiceListening) {
      await stopVoiceListening();
      return;
    }

    try {
      setIsVoiceListening(true);
      setIsSpeaking(false);
      setSearchFocused(true);

      const session = await startHybridVoiceSession({
        language: 'en-IN',
        onTranscript: (liveWords) => {
          setCatalogSearch(liveWords);
          setSearchFocused(true);
          if (voiceDebounceTimerRef.current) clearTimeout(voiceDebounceTimerRef.current);
          voiceDebounceTimerRef.current = setTimeout(() => {
            stopVoiceListening();
          }, 2000);
        },
        onSpeakingChange: (speaking) => {
          setIsSpeaking(speaking);
        },
        onMicStatus: (status) => {
          if (status === 'silent') {
            showToast('Microphone sound is silent (0%). Check that your mic is unmuted in Windows Sound Settings.');
          }
        },
      });

      voiceSessionRef.current = session;
    } catch (err) {
      setIsVoiceListening(false);
      setIsSpeaking(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showToast('Microphone access blocked. Click the lock/settings icon in your browser URL bar to Allow.');
      } else {
        showToast('Could not access microphone: ' + (err.message || 'Check audio devices'));
      }
    }
  }, [isVoiceListening, showToast, stopVoiceListening]);

  useEffect(() => {
    return () => {
      if (voiceSessionRef.current) {
        voiceSessionRef.current.abort();
      }
    };
  }, []);

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

      {/* 1. FLOATING EDITORIAL NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full bg-[#F5F3ED]/95 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between gap-6">
          {/* Brand & Logotype */}
          <div className="flex items-center gap-3.5 flex-shrink-0">
            <button
              onClick={() => { setView('store'); setSearchResult(null); setCatalogSearch(''); setIntentInput(''); }}
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
              onClick={() => { setView('store'); setSearchResult(null); setCatalogSearch(''); setIntentInput(''); }}
              className={`whitespace-nowrap py-1 relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] transition-all ${view === 'store'
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
                className={`whitespace-nowrap flex items-center gap-1 py-1 transition-colors ${categoriesDropdownOpen ? 'text-on-surface font-bold' : 'text-on-surface-muted hover:text-on-surface'
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

                  {CATEGORY_ITEMS.map((cat) => {
                    const count = cat.id === 'all'
                      ? allProducts.length
                      : allProducts.filter((p) => p.category.toLowerCase() === cat.id.toLowerCase()).length;
                    const isSelected = (cat.id === 'all' && selectedCategory.toLowerCase() === 'all') ||
                      selectedCategory.toLowerCase() === cat.id.toLowerCase();
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setView('store');
                          setSearchResult(null);
                          setCatalogSearch('');
                          setSelectedCategory(cat.id === 'all' ? 'All' : cat.id);
                          setCategoriesDropdownOpen(false);
                          setTimeout(() => {
                            document.getElementById('curation')?.scrollIntoView({ behavior: 'smooth' });
                          }, 50);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl hover:bg-surface-subtle transition-colors text-left group ${isSelected ? 'bg-surface-subtle' : ''
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="material-symbols-outlined text-[20px] text-on-surface-muted group-hover:text-black flex-shrink-0">
                            {cat.icon}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-sans text-xs font-bold truncate ${isSelected ? 'text-black font-extrabold' : 'text-on-surface group-hover:text-black'}`}>
                                {cat.title}
                              </span>
                              <span className="px-1.5 py-0.2 rounded-full bg-surface border border-border-subtle font-mono text-[9px] font-bold text-on-surface-muted flex-shrink-0">
                                {count}
                              </span>
                            </div>
                            <span className="font-body text-[10px] text-on-surface-muted block leading-tight truncate">
                              {cat.desc}
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[14px] text-on-surface-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          chevron_right
                        </span>
                      </button>
                    );
                  })}
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
                className={`relative flex items-center ${
                  isVoiceListening
                    ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-400/40 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                    : 'bg-white border-border-subtle hover:border-on-surface focus-within:border-on-surface focus-within:ring-2 focus-within:ring-on-surface/10'
                } rounded-full h-9 pl-3 pr-1 gap-1.5 transition-all w-44 sm:w-60 md:w-68 lg:w-72 xl:w-80 shadow-sm overflow-visible`}
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
                  placeholder={isVoiceListening ? "Listening... speak now" : "Search catalog or ask AI..."}
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

                {/* Streaming Mic Button inside Search Bar (Whisper graphic_eq icon moves when speaking) */}
                <button
                  type="button"
                  onClick={toggleHeaderVoice}
                  title={isVoiceListening ? "Listening... click to search" : "Speak to search"}
                  className={`p-1.5 rounded-full flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
                    isVoiceListening
                      ? `bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-sm ring-2 ring-rose-300/80 ${isSpeaking ? 'animate-pulse scale-105' : ''}`
                      : 'text-on-surface-muted hover:text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {isVoiceListening ? 'graphic_eq' : 'mic'}
                  </span>
                </button>

                {/* Integrated AI Engine Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSearchFocused(false);
                    if (catalogSearch.trim()) {
                      handleAiSearch(catalogSearch);
                    } else {
                      if (view !== 'search') {
                        setIntentInput('');
                        setSearchResult(null);
                      }
                      setView(view === 'search' ? 'store' : 'search');
                    }
                  }}
                  title={catalogSearch.trim() ? "Search with AI Intent" : "Toggle AI Engine"}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-sans text-[10px] uppercase font-bold tracking-wider transition-all flex-shrink-0 shadow-sm active:scale-95 group ${view === 'search'
                    ? 'bg-accent text-on-surface hover:bg-[#bbf055]'
                    : 'bg-[#171717] hover:bg-black text-[#C7F36B]'
                    }`}
                >
                  <span className="material-symbols-outlined text-[13px] group-hover:rotate-12 transition-transform">
                    auto_awesome
                  </span>
                  <span>AI</span>
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
                        const img = getProductImage(prod);
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
                                <span className="flex w-full h-full items-center justify-center">
                                  <span className="material-symbols-outlined text-lg text-on-surface-muted">inventory_2</span>
                                </span>
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
                      AI
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Clean Wishlist Icon Button */}
            <button
              aria-label="Wishlist"
              title="Wishlist"
              onClick={() => setWishlistOpen(true)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors border relative ${wishCount > 0
                ? 'border-border-subtle bg-surface-card text-rose-600'
                : 'border-border-subtle bg-surface-card hover:bg-surface-subtle text-on-surface'
                }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                favorite_border
              </span>
              {wishCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center rounded-full shadow-sm">
                  {wishCount}
                </span>
              )}
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
                        className={`py-3 px-2 rounded-lg transition-colors ${item.unread ? 'bg-surface-subtle/50' : 'hover:bg-surface-subtle/30'
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

            {/* Merchant Radar Switcher Pill */}
            <button
              onClick={() => setView(view === 'admin' ? 'store' : 'admin')}
              title={view === 'admin' ? "Return to Storefront" : "Open Merchant Demand Radar"}
              className={`h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full border border-border-subtle font-sans text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition-colors ${view === 'admin'
                ? 'bg-on-surface text-accent border-on-surface'
                : 'bg-surface-card text-on-surface hover:bg-surface-subtle'
                }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {view === 'admin' ? 'storefront' : 'radar'}
              </span>
              <span>{view === 'admin' ? 'Storefront' : 'Merchant Radar'}</span>
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
          initialQuery={intentInput}
          searchResult={searchResult}
          allProducts={allProducts}
          productImages={PRODUCT_IMAGES}
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
                      <span className="font-bold tracking-wider uppercase text-on-surface">SMART INTENT SEARCH</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-0.5 rounded bg-surface-subtle text-[10px] font-mono text-on-surface-muted uppercase">
                        AI POWERED
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
                      <span>Smart matching: materials, use cases, and budget limits.</span>
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
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80';
                        }}
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
                            type="button"
                            className="w-9 h-9 rounded-full bg-accent text-on-surface flex items-center justify-center font-bold hover:scale-105 transition-transform shadow-sm cursor-pointer"
                            aria-label="Add AeroShield to Cart"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              let prod = allProducts.find((p) => p.id === 'prod_001');
                              if (!prod) {
                                prod = {
                                  id: 'prod_001',
                                  sku: 'BAG-001',
                                  title: 'AeroShield Waterproof 24L',
                                  price_paise: 249900,
                                  stock: 12,
                                  category: 'bags',
                                  tags: ['waterproof', 'laptop', 'backpack'],
                                  description: 'Water-resistant 14-inch laptop backpack with roll-top closure.',
                                };
                              }
                              addToCart(prod);
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
                {categories.map((c) => {
                  const count = c === 'All'
                    ? allProducts.length
                    : allProducts.filter((p) => p.category.toLowerCase() === c.toLowerCase()).length;
                  const isSelected = selectedCategory.toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        setSearchResult(null);
                        setCatalogSearch('');
                        setSelectedCategory(c);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-sans uppercase font-bold tracking-wider transition flex items-center gap-1.5 ${isSelected
                        ? 'bg-on-surface text-white shadow-sm'
                        : 'border border-border-subtle bg-surface-card text-on-surface-muted hover:text-on-surface'
                        }`}
                    >
                      <span>{c === 'All' ? 'All Products' : c}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-subtle text-on-surface-muted'
                        }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Variable Sized Editorial Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={addToCart}
                  onWishlist={toggleWishlist}
                  isWished={Boolean(wishlist[product.id])}
                />
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="py-20 text-center rounded-2xl border border-dashed border-border-subtle p-8 bg-surface-card">
                <span className="material-symbols-outlined text-4xl text-on-surface-muted mb-3">inventory_2</span>
                <p className="font-sans text-base font-bold uppercase text-on-surface">No products found</p>
                <p className="font-body text-xs text-on-surface-muted mt-1 max-w-sm mx-auto">
                  No items matched your current filter criteria in this category.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setCatalogSearch('');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-on-surface text-white text-xs font-sans font-bold uppercase tracking-wider hover:bg-black transition-colors"
                >
                  View All Products ({allProducts.length})
                </button>
              </div>
            )}
          </section>

          {/* 5. BRAND STORYTELLING & MANIFESTO */}
          <section className="w-full bg-[#EAE7DF] border-b border-border-subtle py-20 lg:py-28 px-6 lg:px-12" id="manifesto">
            <div className="max-w-[1440px] mx-auto">
              <div className="max-w-4xl">
                <span className="font-sans text-xs tracking-editorial uppercase text-on-surface-muted font-bold block mb-4">
                  OUR MANIFESTO / ESSAY 01
                </span>
                <blockquote className="font-sans text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-on-surface leading-[1.05] uppercase">
                  "Direct commerce driven by <span className="serif-italic font-normal lowercase tracking-normal">verified quality,</span> not sponsored placement spam."
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
            <div className="w-full bg-surface-card border border-border-subtle rounded-3xl p-8 sm:p-12 lg:p-14 relative overflow-hidden shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                {/* Left Column: Form */}
                <div className="lg:col-span-7 relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-on-surface font-sans text-xs font-bold tracking-wider uppercase mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                    CUSTOM SOURCING REQUEST
                  </div>
                  <h2 className="font-sans text-3xl sm:text-5xl font-bold uppercase tracking-tight text-on-surface leading-tight">
                    Can’t find what <br />
                    you’re <span className="serif-italic font-normal lowercase tracking-normal">looking for?</span>
                  </h2>
                  <p className="font-body text-base text-on-surface-muted mt-5 mb-8 leading-relaxed max-w-xl">
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
                        Merchant Sourcing Charter
                      </a>
                    </div>
                  </form>

                  <div className="mt-8 pt-6 border-t border-border-subtle flex items-center gap-3 text-xs font-sans text-on-surface-muted">
                    <span className="material-symbols-outlined text-[18px] text-on-surface">verified_user</span>
                    <span>Over 1,240 custom customer orders successfully matched and fulfilled across India this season.</span>
                  </div>
                </div>

                {/* Right Column: Architectural Blueprint (Direct E-Commerce Fulfillment) */}
                <div className="lg:col-span-5 relative">
                  <div className="bg-[#F5F2EA] border border-[#DDD5C5] rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
                    {/* Commerce Header */}
                    <div className="flex items-center justify-between border-b border-[#D8CEB9] pb-3 mb-3">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[#7C7462] block font-bold">
                          DEMAND-DRIVEN SOURCING PROTOCOL
                        </span>
                        <span className="font-sans text-xs font-bold text-[#2B271F] uppercase tracking-wider">
                          DIRECT COMMERCE ARCHITECTURE · LIVE FULFILLMENT
                        </span>
                      </div>
                    </div>

                    {/* E-Commerce Guarantee Circular Seal Stamp */}
                    <div className="absolute top-12 right-6 z-20 rotate-[-6deg] border-2 border-dashed border-[#8B3A2B]/75 rounded-full w-20 h-20 p-1 flex flex-col items-center justify-center text-center bg-[#F5F2EA]/95 backdrop-blur-xs select-none shadow-xs pointer-events-none">
                      <span className="font-mono text-[6.5px] font-bold text-[#8B3A2B] uppercase tracking-widest leading-none">
                        SHELFSENSE
                      </span>
                      <span className="font-serif italic text-[10px] font-bold text-[#8B3A2B] leading-none my-0.5">
                        Direct Retail
                      </span>
                      <span className="font-mono text-[6px] uppercase tracking-wider text-[#8B3A2B]/80 font-bold">
                        FAST DISPATCH
                      </span>
                    </div>

                    {/* Hand-Drawn Vintage Architectural Pencil Art: Direct E-Commerce Merchant Coupling */}
                    <div className="w-full bg-[#FAF7F2] rounded-xl overflow-hidden border border-[#D9D0BD] shadow-xs relative group">
                      <img
                        src="/human-ecommerce-blueprint.jpg"
                        alt="Direct E-Commerce: Shopper to Boutique Merchant"
                        className="w-full h-auto object-cover group-hover:scale-[1.01] transition-transform duration-500"
                      />
                    </div>

                    {/* Bottom Commerce Caption & Inspiring Retail Quote */}
                    <div className="mt-3.5 pt-3 border-t border-[#D8CEB9] flex flex-col gap-2 text-[11px] font-sans text-[#6B6350]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[15px] text-[#2B271F]">local_shipping</span>
                          <span className="font-medium text-[#2B271F]">Direct Shopper-to-Merchant Fulfillment</span>
                        </div>
                        <span className="font-mono text-[10px] text-[#8B3A2B] font-bold">ZERO OVERSTOCK · 100% INTENT</span>
                      </div>
                      <p className="font-serif italic text-[11.5px] text-[#6E6654] leading-snug">
                        "Connecting real customer demand directly with merchant shelves — eliminating retail waste, maximizing speed."
                      </p>
                    </div>
                  </div>
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
          onRefreshData={async () => {
            await fetchAdminOverview();
            await loadAllProducts();
          }}
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

      {/* Wishlist Drawer (Flipkart style luxury panel) */}
      <WishlistDrawer
        open={wishlistOpen}
        onClose={() => setWishlistOpen(false)}
        wishlist={wishlist}
        products={allProducts}
        onAddToCart={addToCart}
        onRemoveWishlist={toggleWishlist}
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
