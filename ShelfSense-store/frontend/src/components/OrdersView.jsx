import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../services/api';
import { getProductImage } from '../App';

const inr = (paise) => `₹${((paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function OrdersView({ onBackToStore, showToast, onRefreshProducts }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [cancellingId, setCancellingId] = useState(null);
  const [trackingModalOrder, setTrackingModalOrder] = useState(null);
  const [receiptModalOrder, setReceiptModalOrder] = useState(null);

  // Fetch orders from backend and sync with localStorage cache
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/orders'));
      if (res.ok) {
        const data = await res.json();
        const serverOrders = data.orders || [];
        setOrders(serverOrders);
        try {
          localStorage.setItem('shelfsense_orders_cache', JSON.stringify(serverOrders));
        } catch {}
      } else {
        throw new Error('Server returned ' + res.status);
      }
    } catch {
      // Fallback to cache if offline
      try {
        const cached = localStorage.getItem('shelfsense_orders_cache');
        if (cached) setOrders(JSON.parse(cached));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    fetchOrders();
  }, []);

  // Handle Order Cancellation
  const handleCancelOrder = async (orderId) => {
    if (!window.confirm(`Are you sure you want to cancel order #${orderId}? This will automatically restock the items to our live catalog.`)) {
      return;
    }

    setCancellingId(orderId);
    try {
      const res = await fetch(getApiUrl(`/api/orders/${orderId}/cancel`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Cancellation failed');

      // Update state locally
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
      );
      showToast?.(`Order #${orderId} cancelled. Inventory restored to store catalog.`);
      if (onRefreshProducts) {
        await onRefreshProducts();
      }
    } catch (e) {
      showToast?.(`Error cancelling order: ${e.message}`);
    } finally {
      setCancellingId(null);
    }
  };

  // Filter orders by status
  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') return ['placed', 'processing', 'dispatched', 'in_transit'].includes(o.status);
    if (filterStatus === 'DELIVERED') return o.status === 'delivered';
    if (filterStatus === 'CANCELLED') return o.status === 'cancelled';
    return true;
  });

  const totalSpent = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total_paise || 0), 0);

  const activeCount = orders.filter((o) =>
    ['placed', 'processing', 'dispatched', 'in_transit'].includes(o.status)
  ).length;

  return (
    <div className="w-full bg-[#fbf9f3] text-[#1b1c18] min-h-screen">
      {/* 1. TOP EDITORIAL BAR */}
      <section className="w-full px-6 lg:px-12 py-5 border-b border-[#eae8e2] bg-[#f5f3ed]/70">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToStore}
              className="inline-flex items-center gap-1 text-xs font-sans font-bold uppercase tracking-wider text-[#444748] hover:text-black transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Back to Store</span>
            </button>
            <span className="text-[#dcdad4]">/</span>
            <h1 className="font-sans text-xl sm:text-2xl font-bold tracking-tight text-[#1b1c18]">
              My Orders &amp; Shipments
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-black text-white font-mono text-xs font-bold">
              {orders.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrders}
              className="h-9 px-3.5 rounded-full border border-[#dcdad4] bg-white hover:bg-[#eae8e2] text-xs font-sans font-bold uppercase tracking-wider text-[#1b1c18] transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>Refresh</span>
            </button>
            <button
              onClick={onBackToStore}
              className="h-9 px-4 rounded-full bg-black hover:bg-[#c6f26a] hover:text-black text-white text-xs font-sans font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">storefront</span>
              <span>Browse Catalog</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. ORDER METRICS BANNER */}
      <section className="w-full px-6 lg:px-12 py-8 bg-[#fbf9f3]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-6 bg-white border border-[#dcdad4] rounded-2xl flex flex-col justify-between shadow-xs">
            <span className="font-mono text-xs uppercase text-[#444748] font-bold">INDEX 01 // TOTAL ORDERS</span>
            <div className="my-2">
              <span className="font-sans text-3xl sm:text-4xl font-bold text-[#1b1c18]">{orders.length}</span>
              <span className="font-body text-xs text-[#444748] block mt-1">Confirmed client acquisitions</span>
            </div>
            <span className="font-mono text-xs text-[#166534] font-bold uppercase">All orders tracked</span>
          </div>

          <div className="p-6 bg-white border border-[#dcdad4] rounded-2xl flex flex-col justify-between shadow-xs">
            <span className="font-mono text-xs uppercase text-[#444748] font-bold">INDEX 02 // IN DISPATCH</span>
            <div className="my-2">
              <span className="font-sans text-3xl sm:text-4xl font-bold text-[#1b1c18]">{activeCount}</span>
              <span className="font-body text-xs text-[#444748] block mt-1">Live shipments in progress</span>
            </div>
            <span className="font-mono text-xs text-[#4b6700] font-bold uppercase flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#4b6700] animate-pulse"></span>
              Carrier Handshake Active
            </span>
          </div>

          <div className="p-6 bg-white border border-[#dcdad4] rounded-2xl flex flex-col justify-between shadow-xs">
            <span className="font-mono text-xs uppercase text-[#444748] font-bold">INDEX 03 // TOTAL INVESTMENT</span>
            <div className="my-2">
              <span className="font-sans text-3xl sm:text-4xl font-bold text-[#1b1c18]">{inr(totalSpent)}</span>
              <span className="font-body text-xs text-[#444748] block mt-1">Excluding cancelled orders</span>
            </div>
            <span className="font-mono text-xs text-[#1b1c18] font-bold uppercase">Verified Payments</span>
          </div>

          <div className="p-6 bg-white border border-[#dcdad4] rounded-2xl flex flex-col justify-between shadow-xs">
            <span className="font-mono text-xs uppercase text-[#444748] font-bold">INDEX 04 // FULFILLMENT SLA</span>
            <div className="my-2">
              <span className="font-sans text-3xl sm:text-4xl font-bold text-[#1b1c18]">24-48 HR</span>
              <span className="font-body text-xs text-[#444748] block mt-1">Express atelier dispatch</span>
            </div>
            <span className="font-mono text-xs text-[#166534] font-bold uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              Direct studio guarantee
            </span>
          </div>
        </div>
      </section>

      {/* 3. ORDERS LIST & CONTROLS */}
      <section className="w-full px-6 lg:px-12 pb-24 bg-[#fbf9f3]">
        <div className="max-w-7xl mx-auto">
          {/* Status Filter Chips */}
          <div className="py-4 border-b border-[#dcdad4] flex flex-wrap items-center justify-between gap-4">
            <div className="h-9 inline-flex p-1 bg-[#eae8e2] rounded-full border border-[#dcdad4] items-center">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`h-7 px-3.5 rounded-full font-sans text-xs uppercase font-bold tracking-wider transition-all ${
                  filterStatus === 'ALL' ? 'bg-black text-white shadow-sm' : 'text-[#444748] hover:text-black'
                }`}
              >
                All Orders ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('ACTIVE')}
                className={`h-7 px-3.5 rounded-full font-sans text-xs uppercase font-bold tracking-wider transition-all ${
                  filterStatus === 'ACTIVE' ? 'bg-black text-white shadow-sm' : 'text-[#444748] hover:text-black'
                }`}
              >
                In Transit ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('DELIVERED')}
                className={`h-7 px-3.5 rounded-full font-sans text-xs uppercase font-bold tracking-wider transition-all ${
                  filterStatus === 'DELIVERED' ? 'bg-black text-white shadow-sm' : 'text-[#444748] hover:text-black'
                }`}
              >
                Delivered ({orders.filter((o) => o.status === 'delivered').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('CANCELLED')}
                className={`h-7 px-3.5 rounded-full font-sans text-xs uppercase font-bold tracking-wider transition-all ${
                  filterStatus === 'CANCELLED' ? 'bg-black text-white shadow-sm' : 'text-[#444748] hover:text-black'
                }`}
              >
                Cancelled ({orders.filter((o) => o.status === 'cancelled').length})
              </button>
            </div>

            <span className="font-mono text-xs text-[#444748]">
              Showing {filteredOrders.length} of {orders.length} orders
            </span>
          </div>

          {/* Orders Feed */}
          {loading && orders.length === 0 ? (
            <div className="py-24 text-center">
              <span className="material-symbols-outlined text-[42px] text-[#444748] animate-spin mb-3">
                progress_activity
              </span>
              <p className="font-sans text-sm font-bold text-[#1b1c18] uppercase tracking-wider">
                Loading orders from live database…
              </p>
            </div>
          ) : filteredOrders.length > 0 ? (
            <div className="mt-8 flex flex-col gap-6">
              {filteredOrders.map((order) => {
                const isCancelled = order.status === 'cancelled';
                const isDelivered = order.status === 'delivered';
                const isPlaced = order.status === 'placed' || order.status === 'processing';

                return (
                  <article
                    key={order.id}
                    className={`bg-white border rounded-2xl overflow-hidden shadow-xs transition-all ${
                      isCancelled
                        ? 'border-rose-200 bg-rose-50/20'
                        : 'border-[#dcdad4] hover:border-black'
                    }`}
                  >
                    {/* Order Card Header */}
                    <div className="p-6 border-b border-[#eae8e2] bg-[#fbf9f3] flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm font-bold text-[#1b1c18]">
                          ORDER #{order.id.replace('ord_', '').toUpperCase()}
                        </span>
                        <span className="text-[#dcdad4]">·</span>
                        <span className="font-body text-xs text-[#444748]">
                          {order.created_at
                            ? new Date(order.created_at).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : 'Today'}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-sans text-xs font-bold uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[15px]">cancel</span>
                            <span>Cancelled &amp; Restocked</span>
                          </span>
                        ) : isDelivered ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-sans text-xs font-bold uppercase tracking-wider">
                            <span className="material-symbols-outlined text-[15px]">verified</span>
                            <span>Delivered</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e8f5e9] text-[#166534] border border-[#bbf7d0] font-sans text-xs font-bold uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
                            <span>Processing &amp; Dispatching</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Visual Dispatch Step Tracker (If not cancelled) */}
                    {!isCancelled && (
                      <div className="px-6 py-4 bg-white border-b border-[#eae8e2]">
                        <div className="grid grid-cols-4 gap-2 font-mono text-[10px] text-center">
                          <div className="flex flex-col items-center">
                            <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-bold mb-1">
                              ✓
                            </span>
                            <span className="font-bold text-[#1b1c18] uppercase">Confirmed</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-bold mb-1">
                              ✓
                            </span>
                            <span className="font-bold text-[#1b1c18] uppercase">Packed</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="w-6 h-6 rounded-full bg-[#c6f26a] text-black flex items-center justify-center font-bold mb-1 animate-pulse">
                              3
                            </span>
                            <span className="font-bold text-[#4b6700] uppercase">Dispatched</span>
                          </div>
                          <div className="flex flex-col items-center opacity-40">
                            <span className="w-6 h-6 rounded-full border border-black flex items-center justify-center font-bold mb-1">
                              4
                            </span>
                            <span className="font-bold text-[#444748] uppercase">Delivered</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Itemized Order Products */}
                    <div className="p-6 divide-y divide-[#eae8e2]">
                      {(order.items || []).map((item, idx) => {
                        const img = getProductImage({
                          id: item.product_id,
                          title: item.title,
                          category: item.category,
                          attributes: { image_url: item.image_url },
                        });

                        return (
                          <div
                            key={item.product_id || idx}
                            className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-xl bg-[#eae8e2] border border-[#dcdad4] overflow-hidden shrink-0 flex items-center justify-center">
                                <img
                                  src={img}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.src = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80';
                                  }}
                                />
                              </div>
                              <div>
                                <span className="font-mono text-[10px] text-[#444748] uppercase tracking-wider font-bold">
                                  {item.category || 'Atelier'}
                                </span>
                                <h4 className="font-sans text-sm font-bold text-[#1b1c18] mt-0.5">
                                  {item.title}
                                </h4>
                                <span className="font-mono text-xs text-[#444748]">
                                  Qty: {item.quantity} × {inr(item.unit_price_paise)}
                                </span>
                              </div>
                            </div>

                            <div className="text-right sm:self-center">
                              <span className="font-mono text-sm font-bold text-[#1b1c18]">
                                {inr(item.unit_price_paise * item.quantity)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Order Card Footer */}
                    <div className="p-6 bg-[#f5f3ed] border-t border-[#eae8e2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <span className="font-sans text-xs text-[#444748] uppercase font-bold tracking-wider">
                          Total Order Value
                        </span>
                        <div className="font-sans text-2xl font-bold text-[#1b1c18]">
                          {inr(order.total_paise)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setReceiptModalOrder(order)}
                          className="px-4 py-2 bg-white border border-[#dcdad4] hover:bg-[#eae8e2] text-xs font-sans font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">receipt</span>
                          <span>Receipt</span>
                        </button>

                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => setTrackingModalOrder(order)}
                            className="px-4 py-2 bg-white border border-[#dcdad4] hover:bg-black hover:text-white text-xs font-sans font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                            <span>Track Package</span>
                          </button>
                        )}

                        {isPlaced && (
                          <button
                            type="button"
                            disabled={cancellingId === order.id}
                            onClick={() => handleCancelOrder(order.id)}
                            className="px-4 py-2 bg-rose-50 border border-rose-300 text-rose-800 hover:bg-rose-600 hover:text-white text-xs font-sans font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                            <span>{cancellingId === order.id ? 'Restocking…' : 'Cancel Order'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="max-w-2xl mx-auto text-center py-20 px-8 border border-dashed border-[#dcdad4] rounded-3xl bg-white mt-8 shadow-xs">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#eae8e2] flex items-center justify-center text-[#1b1c18]">
                <span className="material-symbols-outlined text-[32px]">receipt_long</span>
              </div>
              <h3 className="font-sans text-2xl font-bold text-[#1b1c18] mb-2">
                No orders recorded yet
              </h3>
              <p className="font-body text-sm text-[#444748] max-w-md mx-auto mb-6 leading-relaxed">
                When you acquire craftsmanship from our atelier, your shipment tracking, invoices, and cancellation options will appear right here.
              </p>
              <button
                type="button"
                onClick={onBackToStore}
                className="px-6 py-3 bg-black hover:bg-[#c6f26a] hover:text-black text-white font-sans text-xs uppercase tracking-wider font-bold rounded-full transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">storefront</span>
                <span>Discover Collections</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* MODAL: LIVE PACKAGE TRACKING */}
      {trackingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setTrackingModalOrder(null)}
          ></div>
          <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#dcdad4]">
            <div className="flex items-center justify-between pb-4 border-b border-[#eae8e2]">
              <div>
                <span className="font-mono text-xs text-[#4b6700] uppercase font-bold tracking-wider">
                  Live Dispatch Waybill
                </span>
                <h3 className="font-sans text-xl font-bold text-[#1b1c18]">
                  Tracking #{trackingModalOrder.id.replace('ord_', '').toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setTrackingModalOrder(null)}
                className="w-8 h-8 rounded-full border border-[#dcdad4] flex items-center justify-center hover:bg-[#eae8e2]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="my-6 space-y-4">
              <div className="p-4 bg-[#f5f3ed] rounded-xl font-mono text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#444748]">Carrier Partner:</span>
                  <span className="font-bold text-[#1b1c18]">Blue Dart Atelier Express</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#444748]">AWB Number:</span>
                  <span className="font-bold text-[#1b1c18]">AWB-{trackingModalOrder.id.slice(-6).toUpperCase()}98</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#444748]">Estimated Delivery:</span>
                  <span className="font-bold text-[#166534]">Within 48 Hours</span>
                </div>
              </div>

              <div className="border-l-2 border-black ml-4 pl-4 space-y-4 text-xs font-mono">
                <div>
                  <div className="font-bold text-[#1b1c18]">Out for Transit / Local Hub</div>
                  <div className="text-[11px] text-[#444748]">Package received at Bengaluru Regional Facility · Just now</div>
                </div>
                <div>
                  <div className="font-bold text-[#1b1c18]">Sealed &amp; Quality Audited</div>
                  <div className="text-[11px] text-[#444748]">Independently verified against tensile &amp; finish standards · 2h ago</div>
                </div>
                <div>
                  <div className="font-bold text-[#1b1c18]">Order Confirmed by Atelier</div>
                  <div className="text-[11px] text-[#444748]">Payment cleared and stock reserved · Earlier today</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setTrackingModalOrder(null)}
              className="w-full py-3 bg-black hover:bg-[#c6f26a] hover:text-black text-white font-sans text-xs uppercase tracking-wider font-bold rounded-xl transition-colors"
            >
              Close Tracker
            </button>
          </div>
        </div>
      )}

      {/* MODAL: INVOICE / RECEIPT */}
      {receiptModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setReceiptModalOrder(null)}
          ></div>
          <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#dcdad4]">
            <div className="flex items-center justify-between pb-4 border-b border-[#eae8e2]">
              <div>
                <span className="font-mono text-xs text-[#444748] uppercase font-bold tracking-wider">
                  ShelfSense Atelier Systems
                </span>
                <h3 className="font-sans text-xl font-bold text-[#1b1c18]">
                  Tax Invoice #{receiptModalOrder.id.replace('ord_', '').toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setReceiptModalOrder(null)}
                className="w-8 h-8 rounded-full border border-[#dcdad4] flex items-center justify-center hover:bg-[#eae8e2]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="my-6 space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-[#eae8e2]">
                <span className="text-[#444748]">Date of Purchase:</span>
                <span className="font-bold text-[#1b1c18]">
                  {receiptModalOrder.created_at ? new Date(receiptModalOrder.created_at).toLocaleDateString() : 'Today'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eae8e2]">
                <span className="text-[#444748]">Payment Method:</span>
                <span className="font-bold text-[#1b1c18]">Prepaid (Encrypted 256-bit)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eae8e2]">
                <span className="text-[#444748]">Items Billed:</span>
                <span className="font-bold text-[#1b1c18]">{(receiptModalOrder.items || []).length} SKU(s)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#eae8e2]">
                <span className="text-[#444748]">GST Included (18%):</span>
                <span className="font-bold text-[#1b1c18]">
                  {inr(Math.round((receiptModalOrder.total_paise || 0) * 0.18))}
                </span>
              </div>
              <div className="flex justify-between py-2 text-sm font-bold text-[#1b1c18]">
                <span>Total Amount Paid:</span>
                <span>{inr(receiptModalOrder.total_paise)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-[#eae8e2] hover:bg-[#dcdad4] text-[#1b1c18] font-sans text-xs uppercase tracking-wider font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Print Invoice</span>
              </button>
              <button
                onClick={() => setReceiptModalOrder(null)}
                className="flex-1 py-3 bg-black hover:bg-[#c6f26a] hover:text-black text-white font-sans text-xs uppercase tracking-wider font-bold rounded-xl transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
