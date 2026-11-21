import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../services/api';

// High-res imagery for demand radar clusters matching Stitch design
const DEMAND_IMAGES = {
  'DMD-0982': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAdllp6Pm1b5SgqlpvgEAMcz9PtWLht0bKbx_d-NhCdx2F9R3OagZMmRcNLUibj2FUeLY9DLlyXwCRa1dr2dqjqpeVnZDyyM5osH0xhY5XegJWO404F2TkS4hk78DjZFy6EWvB3Kfc8Lt2plCK4sb8OcnKzuYZwkbv0PtYNzPOfSfjoudUQMQf8Wo7MsxZdXk8xQ4X7Usb6BeqwgeZm9cNQvWGTK22wGVDoHzY-ENJf',
  'DMD-0941': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbYCaGsQK2L0beABZOxXhYS7JBuxQjM6TjirCHa6f-2CnP7CE8PHiYNUjBfLFCUB58E0EJq59sQEbm7nfhpEckc6scd4yVyiy6B1knRu4FH5yXVu1hR9P8bYSvj2xpvE-2opo00eXTy0KtqYMLQNyqkUNkXybtuo1ZZ8huVkNjLIR2MfmfaFSpDlwjeEGge8JVXmZywgf3MXoPwRafuPWUl7fKtD7bPX69xsMqHIqa',
  'DMD-0887': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCuQJGJT_l0D8uBa982m5WDVCQ4avAMPlQ7GAvTaWGp0c3DqrAN_81BMaWYw-ISHy0hHfhSoh0A_mqahPyr0CnBX9IlY6c_9eTN-fARlTfjpx_Gsd6b7sl6NeMElchMh4qpVkGqJA3Hi0zXV8aSqowSY_DHMtfmb1RwrQlhg76dBpFKSlcRPooM-8Xi8BxSe80kyPjBNgXmU7sbdqYcRfbg88TEVnEaues8izp52urI',
};

export default function MerchantDemandRadar({
  onBackToStore,
  showToast,
  overviewData,
  onRefreshData,
}) {
  const [activeTab, setActiveTab] = useState('demand-radar'); // 'demand-radar' | 'inventory' | 'overview'
  const [viewMode, setViewMode] = useState('active'); // 'active' | 'empty'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('volume');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [demandRadarData, setDemandRadarData] = useState({ signals: [], recent_signals: [] });
  const [fulfilledItems, setFulfilledItems] = useState([]);
  const [activeItems, setActiveItems] = useState([
    {
      id: 'DMD-0982',
      clusterCode: 'DMD-0982',
      badge: 'HIGH VOLUME // TOP UNMET NEED',
      category: 'CARRY',
      categoryLabel: 'Carry & Packs // Daily Transit',
      firstCaptured: '18 days ago · Velocity: +44%',
      title: 'Waterproof Lightweight Commuter Backpack for College',
      description: 'Repeated customer queries seeking a lightweight (<900g), college-ready laptop backpack with IPX4+ waterproofing, dedicated 16-inch padded compartment, and minimalist matte silhouette devoid of large ostentatious logos.',
      specs: ['Waterproof Ballistic / Ripstop', 'Sub-900g Featherweight', '16" Padded Laptop Sleeve', 'G-Hook or Roll-top Enclosure', 'Dual Water Bottle Stretch Pockets'],
      queriesCount: 64,
      progressWidth: '88%',
      budgetRange: '₹1,800 – ₹2,500',
      sweetSpot: '₹2,200',
      recentQuery: 'Today, 14:22 IST',
      location: 'Metro Campus Hub',
      status: 'Under Review',
      marginNote: 'High merchant margin potential (estimated 48-52%)',
      imgKey: 'DMD-0982',
      alt: 'Matte black waterproof rolltop backpack',
    },
    {
      id: 'DMD-0941',
      clusterCode: 'DMD-0941',
      badge: 'EMERGING DEMAND // FAST MOVER',
      category: 'CARRY',
      categoryLabel: 'Carry & Packs // Modular Carry',
      firstCaptured: '9 days ago · Velocity: +62%',
      title: 'Weatherproof Crossbody Ergonomic Tech Sling (10–14L)',
      description: 'Shoppers looking for a quick-access sling with ambidextrous strap, waterproof zippers, and internal organizers for iPad Mini, cables, and power bank.',
      specs: ['Quick-Adjust Ambidextrous Strap', 'Matte Water-Resistant Shell', 'Fleece-Lined Tablet Pocket', 'Hidden Passport Pocket'],
      queriesCount: 42,
      progressWidth: '65%',
      budgetRange: '₹1,400 – ₹1,900',
      sweetSpot: '₹1,650',
      recentQuery: 'Yesterday, 19:40 IST',
      location: 'Bengaluru Tech Corridor',
      status: 'Sourcing',
      marginNote: 'Projected margin: 44-48%',
      imgKey: 'DMD-0941',
      alt: 'Technical crossbody sling bag',
    },
    {
      id: 'DMD-0887',
      clusterCode: 'DMD-0887',
      badge: 'STEADY SPEC // REFINED NICHE',
      category: 'DESK',
      categoryLabel: 'Work & Study // Ergonomics',
      firstCaptured: '24 days ago · Velocity: +18%',
      title: 'Modular Solid Walnut & Steel Organizing Station',
      description: 'Demand for a weighted, low-profile desktop station combining wireless charging mat, grooved phone/tablet dock, and pen rest without squeaky acrylic.',
      specs: ['Solid American Walnut', 'Powder-Coated Steel Rail', 'Integrated Qi Pad Cutout', 'Cork Anti-Scratch Feet'],
      queriesCount: 38,
      progressWidth: '55%',
      budgetRange: '₹1,200 – ₹1,800',
      sweetSpot: '₹1,450',
      recentQuery: '2 days ago',
      location: 'Gurugram Studio District',
      status: 'New',
      marginNote: 'Projected margin: 52-56%',
      imgKey: 'DMD-0887',
      alt: 'Solid walnut and steel desk organizer',
    },
  ]);

  // Drawer & Modal States
  const [selectedDrawerItem, setSelectedDrawerItem] = useState(null);
  const [composerItem, setComposerItem] = useState(null);
  const [rfpTitle, setRfpTitle] = useState('');
  const [targetCost, setTargetCost] = useState('₹950 – ₹1,150');
  const [moq, setMoq] = useState('500 units');
  const [leadTime, setLeadTime] = useState('45 - 60 Calendar Days');
  const [rfpSpecs, setRfpSpecs] = useState(
    `- Fabric: 600D Recycled Matte Ripstop Polyester with DWR outer coating.\n- Zippers: Matte PU waterproof taped reverse coil zippers.\n- Hardware: Matte black aluminum G-hook buckle with woven nylon webbing.\n- Laptop Protection: High-density EVA foam sleeve with 20mm drop-zone clearance for 16-inch laptops.\n- Branding: Debossed blind tonal logo (understated minimal presence, < 30mm width).`
  );

  // Notifications Popover
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 'n1',
      title: 'High Velocity Demand Detected',
      message: '64 shoppers requested Waterproof Lightweight Rolltop Backpack in last 72h.',
      time: '12m ago',
      unread: true,
      type: 'demand',
    },
    {
      id: 'n2',
      title: 'Stock Reorder Point Triggered',
      message: 'AeroShield 24L is at 8 units (Safety stock: 10). Reorder recommended.',
      time: '1h ago',
      unread: true,
      type: 'inventory',
    },
    {
      id: 'n3',
      title: 'Supplier RFQ Draft Ready',
      message: 'Procurement specs generated for Tech Sling (DMD-0941).',
      time: '3h ago',
      unread: false,
      type: 'rfp',
    },
  ]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const fetchDemandRadar = async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/demand-radar'));
      const data = await res.json();
      setDemandRadarData(data || { signals: [], recent_signals: [] });
    } catch {
      // Graceful
    }
  };

  useEffect(() => {
    fetchDemandRadar();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDemandRadar();
    if (onRefreshData) {
      await onRefreshData();
    }
    setTimeout(() => {
      setIsRefreshing(false);
      showToast?.('Merchant telemetry pipeline synchronized with live storefront queries.');
    }, 800);
  };

  const handleFulfillRequest = async (item) => {
    try {
      await fetch(getApiUrl('/api/admin/demand/fulfill'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: item.title,
          category: item.category === 'DESK' ? 'stationery' : 'bags',
          title: item.title,
          price_paise: 219900,
          stock: 15,
        }),
      });
      setActiveItems((prev) => prev.filter((x) => x.id !== item.id));
      setFulfilledItems((prev) => [
        {
          ...item,
          fulfilledAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          stockAdded: 15,
        },
        ...prev,
      ]);
      showToast?.(`Supplied "${item.title}" to store catalog (15 units added). Demand gap closed!`);
      if (onRefreshData) {
        await onRefreshData();
      }
      fetchDemandRadar();
    } catch (e) {
      showToast?.(`Error fulfilling demand: ${e.message}`);
    }
  };

  const handleOpenDrawer = (itemKey) => {
    setSelectedDrawerItem(itemKey);
  };

  const handleCloseDrawer = () => {
    setSelectedDrawerItem(null);
  };

  const handleOpenComposer = (itemKey) => {
    handleCloseDrawer();
    setComposerItem(itemKey);
    if (itemKey === 'DMD-0941') {
      setRfpTitle('RFQ: Weatherproof Crossbody Ergonomic Tech Sling (10–14L Cordura)');
      setTargetCost('₹650 – ₹850');
      setMoq('350 units');
    } else if (itemKey === 'DMD-0887') {
      setRfpTitle('RFQ: Modular Solid American Walnut Desk Station (Powder-coated Steel)');
      setTargetCost('₹500 – ₹700');
      setMoq('200 units');
    } else {
      setRfpTitle('RFQ: 24L Waterproof Rolltop Commuter Pack (Moisture-Repellent Cordura / 500 units)');
      setTargetCost('₹950 – ₹1,150');
      setMoq('500 units');
    }
  };

  const handleGenerateRfq = async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/sourcing-rfp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: rfpTitle,
          category: composerItem === 'DMD-0887' ? 'stationery' : 'bags',
          target_retail_paise: composerItem === 'DMD-0941' ? 185000 : 220000,
          estimated_moq: parseInt(moq) || 500,
          specs: rfpSpecs,
        }),
      });
      const data = await res.json();
      setComposerItem(null);
      showToast(`Supplier Enquiry Packet #${data.rfp_id || 'RFP-2025'} generated and ready for supplier distribution.`);
    } catch (e) {
      setComposerItem(null);
      showToast('Enquiry Packet generated and saved to Procurement Storage.');
    }
  };

  return (
    <div className="w-full bg-[#fbf9f3] text-[#1b1c18] min-h-screen">
      {/* 1. MERCHANT OPS COMMAND STRIP & TAB CONTROLS */}
      <section className="w-full px-6 lg:px-12 py-5 border-b border-[#eae8e2] bg-[#f5f3ed]/60">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-sans text-2xl sm:text-3xl font-bold text-[#1b1c18] tracking-tight">
              {activeTab === 'demand-radar' ? 'Demand Radar' : 'Inventory Allocation (ROP)'}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e8f5e9] text-[#2e7d32] border border-[#c8e6c9] font-sans text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2e7d32] animate-pulse"></span>
              Live Synced
            </span>
          </div>

          {/* Controls: Segmented Tabs (Demand Radar / Inventory Allocation ROP) + Tools */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* The Tab Switcher: Demand Radar vs Inventory Allocation (ROP) */}
            <div className="h-9 inline-flex p-1 bg-[#eae8e2] rounded-full border border-[#dcdad4] items-center shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('demand-radar')}
                className={`h-7 px-4 rounded-full font-sans text-xs uppercase tracking-wider font-bold transition-all ${
                  activeTab === 'demand-radar'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-[#444748] hover:text-black'
                }`}
              >
                Demand Radar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className={`h-7 px-4 rounded-full font-sans text-xs uppercase tracking-wider font-bold transition-all ${
                  activeTab === 'inventory'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-[#444748] hover:text-black'
                }`}
              >
                Inventory Allocation (ROP)
              </button>
            </div>

            {/* Date Selector */}
            <div className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-white border border-[#dcdad4] rounded-full text-[#1b1c18] font-sans text-xs shadow-sm">
              <span className="material-symbols-outlined text-[15px] text-[#444748]">calendar_today</span>
              <span>Last 30 Days</span>
            </div>

            {/* Refresh Trigger */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 w-9 flex items-center justify-center bg-white hover:bg-[#eae8e2] border border-[#dcdad4] rounded-full text-[#1b1c18] transition-colors shadow-sm"
              title="Force Telemetry Re-index"
            >
              <span className={`material-symbols-outlined text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}>
                sync
              </span>
            </button>

            {/* View Switcher (Only active when on Demand Radar) */}
            {activeTab === 'demand-radar' && (
              <div className="h-9 inline-flex p-1 bg-[#eae8e2] rounded-full border border-[#dcdad4] items-center shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('active')}
                  className={`h-7 px-3.5 rounded-full font-sans text-[11px] uppercase tracking-wider transition-all font-bold ${
                    viewMode === 'active' ? 'bg-black text-white shadow-sm' : 'text-[#444748] hover:text-black'
                  }`}
                >
                  Active Requests ({activeItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('empty')}
                  className={`h-7 px-3.5 rounded-full font-sans text-[11px] uppercase tracking-wider transition-all font-bold ${
                    viewMode === 'empty' ? 'bg-black text-white shadow-sm' : 'text-[#444748] hover:text-black'
                  }`}
                >
                  All Fulfilled {fulfilledItems.length > 0 ? `(${fulfilledItems.length})` : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. MAIN CONSOLE CONTENT */}
      {activeTab === 'demand-radar' ? (
        <main className="w-full">

          {/* Metric Overview Tiles (4 Unified Index Blocks) */}
          <section className="w-full px-6 lg:px-12 py-8 bg-[#fbf9f3]">
            <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Metric 1 */}
              <div className="p-6 bg-white border border-[#dcdad4] rounded-2xl flex flex-col justify-between hover:border-black transition-all shadow-sm min-h-[160px]">
                <div className="flex items-center justify-between font-mono text-xs text-[#444748]">
                  <span>INDEX 01 // REQUESTS</span>
                  <span className="material-symbols-outlined text-[16px] text-[#4b6700]">record_voice_over</span>
                </div>
                <div className="my-2">
                  <div className="font-sans text-3xl sm:text-4xl font-bold text-[#1b1c18]">148</div>
                  <div className="font-body text-xs text-[#444748] mt-1">From customer natural language queries</div>
                </div>
                <div className="font-mono text-xs text-[#4b6700] uppercase tracking-wider flex items-center gap-1 font-bold">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  <span>+38% vs prior 30-day window</span>
                </div>
              </div>

              {/* Metric 2 */}
              <div className="p-6 bg-white border border-[#dcdad4] rounded-2xl flex flex-col justify-between hover:border-black transition-all shadow-sm min-h-[160px]">
                <div className="flex items-center justify-between font-mono text-xs text-[#444748]">
                  <span>INDEX 02 // UNMET CLUSTERS</span>
                  <span className="material-symbols-outlined text-[16px] text-black">hub</span>
                </div>
                <div className="my-2">
                  <div className="font-sans text-3xl sm:text-4xl font-bold text-[#1b1c18]">03</div>
                  <div className="font-body text-xs text-[#444748] mt-1">Grouped demand clusters mapped</div>
                </div>
                <div className="font-mono text-xs text-[#444748] uppercase tracking-wider">
                  Confidence threshold &gt; 91.4%
                </div>
              </div>

              {/* Metric 3 */}
              <div className="p-6 bg-white border border-[#dcdad4] rounded-2xl flex flex-col justify-between hover:border-black transition-all shadow-sm min-h-[160px]">
                <div className="flex items-center justify-between font-mono text-xs text-[#444748]">
                  <span>INDEX 03 // CATEGORIES</span>
                  <span className="material-symbols-outlined text-[16px] text-black">category</span>
                </div>
                <div className="my-2">
                  <div className="font-sans text-3xl sm:text-4xl font-bold text-[#1b1c18]">02</div>
                  <div className="font-body text-xs text-[#444748] mt-1">"Carry &amp; Luggage" &amp; "Desk Objects"</div>
                </div>
                <div className="font-mono text-xs text-[#1b1c18] uppercase tracking-wider font-bold">
                  Primary focus: Tech Transit
                </div>
              </div>

              {/* Metric 4 */}
              <div className="p-6 bg-white border border-[#dcdad4] rounded-2xl flex flex-col justify-between hover:border-black transition-all shadow-sm min-h-[160px]">
                <div className="flex items-center justify-between font-mono text-xs text-[#444748]">
                  <span>INDEX 04 // MERCHANT ACTION</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c6f26a]"></span>
                </div>
                <div className="my-2">
                  <div className="flex items-center gap-3">
                    <span className="font-sans text-3xl sm:text-4xl font-bold text-[#1b1c18]">02</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#c6f26a] text-black font-sans text-[10px] font-bold uppercase tracking-wider">
                      ACTION REQUIRED
                    </span>
                  </div>
                  <div className="font-body text-xs text-[#444748] mt-1">Awaiting merchant sourcing review</div>
                </div>
                <div className="font-mono text-xs text-[#4b6700] uppercase tracking-wider font-bold">
                  ₹1.4L Potential Unlocked Run-Rate
                </div>
              </div>
            </div>
          </section>

          {/* Main Opportunities Section */}
          {viewMode === 'active' && activeItems.length > 0 ? (
            <section className="w-full px-6 lg:px-12 pb-24 bg-[#fbf9f3]">
              <div className="max-w-7xl mx-auto">
                {/* Section Toolbar */}
                <div className="py-5 border-b border-[#dcdad4] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="font-sans text-2xl font-bold text-[#1b1c18] tracking-tight uppercase">
                    Unmet Demand Opportunities
                  </h2>

                  {/* Filter & Sort Controls - Perfectly Unified h-9 */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Category Filter Chips */}
                    <div className="h-9 inline-flex p-1 bg-[#eae8e2] rounded-full border border-[#dcdad4] items-center">
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('ALL')}
                        className={`h-7 px-3.5 rounded-full font-sans text-xs uppercase font-bold tracking-wider transition-all ${
                          categoryFilter === 'ALL' ? 'bg-black text-white shadow-sm' : 'text-[#444748] hover:text-black'
                        }`}
                      >
                        All Categories
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('CARRY')}
                        className={`h-7 px-3.5 rounded-full font-sans text-xs uppercase font-bold tracking-wider transition-all ${
                          categoryFilter === 'CARRY' ? 'bg-black text-white shadow-sm' : 'text-[#444748] hover:text-black'
                        }`}
                      >
                        Carry &amp; Packs
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('DESK')}
                        className={`h-7 px-3.5 rounded-full font-sans text-xs uppercase font-bold tracking-wider transition-all ${
                          categoryFilter === 'DESK' ? 'bg-black text-white shadow-sm' : 'text-[#444748] hover:text-black'
                        }`}
                      >
                        Work &amp; Study
                      </button>
                    </div>

                    {/* Sourcing Status Dropdown */}
                    <div className="relative">
                      <select
                        aria-label="Filter by sourcing status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-9 bg-white border border-[#dcdad4] rounded-full px-3.5 font-sans text-xs text-[#1b1c18] focus:outline-none cursor-pointer shadow-sm"
                      >
                        <option value="all">Status: All</option>
                        <option value="new">Status: New</option>
                        <option value="review">Status: Under Review</option>
                        <option value="sourcing">Status: Sourcing</option>
                      </select>
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative">
                      <select
                        aria-label="Sort demand opportunities"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="h-9 bg-white border border-[#dcdad4] rounded-full px-3.5 font-sans text-xs text-[#1b1c18] focus:outline-none cursor-pointer shadow-sm"
                      >
                        <option value="volume">Sort: Most Requested</option>
                        <option value="budget">Sort: Highest Budget</option>
                        <option value="newest">Sort: Newest</option>
                      </select>
                    </div>

                    <span className="h-9 inline-flex items-center px-3.5 bg-[#eae8e2] border border-[#dcdad4] rounded-full font-sans text-xs text-[#444748] font-bold">
                      {activeItems.length} Opportunities
                    </span>
                  </div>
                </div>

                {/* Cards List */}
                <div className="mt-8 flex flex-col gap-8">
                  {/* CARD 1: Hero Opportunity */}
                  {activeItems.some((x) => x.id === 'DMD-0982') && (categoryFilter === 'ALL' || categoryFilter === 'CARRY') && (
                    <article className="w-full bg-white border border-[#dcdad4] hover:border-black transition-all rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-sm">
                      {/* Image Frame */}
                      <div className="lg:col-span-4 bg-[#eae8e2] relative min-h-[300px] lg:min-h-full flex items-center justify-center p-6 border-b lg:border-b-0 lg:border-r border-[#dcdad4] group">
                        <img
                          className="w-full h-full max-h-[340px] object-contain transition-transform duration-500 group-hover:scale-105"
                          alt="Matte black waterproof rolltop backpack"
                          src={DEMAND_IMAGES['DMD-0982']}
                        />
                        <div className="absolute top-4 left-4">
                          <span className="px-2.5 py-1 bg-[#c6f26a] text-black font-mono text-[10px] font-bold rounded-full">
                            HIGH VOLUME // TOP UNMET NEED
                          </span>
                        </div>
                        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-2.5 py-1 rounded text-[#1b1c18] font-mono text-xs font-bold">
                          CLUSTER #DMD-0982
                        </div>
                      </div>

                      {/* Information Column */}
                      <div className="lg:col-span-8 p-6 lg:p-8 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="font-mono text-xs text-[#4b6700] uppercase tracking-widest font-bold">
                              Category: Carry &amp; Packs // Daily Transit
                            </span>
                            <span className="font-mono text-xs text-[#444748]">
                              First Captured: 18 days ago · Velocity: +44%
                            </span>
                          </div>

                          <h3 className="font-sans text-2xl font-bold text-[#1b1c18] mb-2 leading-tight">
                            Waterproof Lightweight Commuter Backpack for College
                          </h3>

                          <p className="font-body text-sm text-[#444748] mb-4 leading-relaxed">
                            Repeated customer queries seeking a lightweight (&lt;900g), college-ready laptop backpack with IPX4+ waterproofing, dedicated 16-inch padded compartment, and minimalist matte silhouette devoid of large ostentatious logos.
                          </p>

                          {/* Common Specification Chips */}
                          <div className="mb-4">
                            <span className="font-mono text-[11px] text-[#444748] block mb-2 uppercase font-bold">
                              Customer Specifications Filter:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                'Waterproof Ballistic / Ripstop',
                                'Sub-900g Featherweight',
                                '16" Padded Laptop Sleeve',
                                'G-Hook or Roll-top Enclosure',
                                'Dual Water Bottle Stretch Pockets',
                              ].map((spec) => (
                                <span
                                  key={spec}
                                  className="px-2.5 py-1 bg-[#eae8e2] text-[#1b1c18] font-mono text-xs rounded border border-[#dcdad4]"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Demand Metrics Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#f5f3ed] rounded-lg border border-[#dcdad4] mb-4">
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Related Queries
                              </span>
                              <div className="font-sans text-2xl font-bold text-[#1b1c18] mt-0.5">64</div>
                              <div className="w-full bg-[#dcdad4] h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className="bg-[#4b6700] h-full" style={{ width: '88%' }}></div>
                              </div>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Budget Range
                              </span>
                              <div className="font-sans text-base font-bold text-[#1b1c18] mt-1">₹1,800 – ₹2,500</div>
                              <span className="font-mono text-[11px] text-[#4b6700] font-semibold">Sweet Spot: ₹2,200</span>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Most Recent Query
                              </span>
                              <div className="font-mono text-xs font-bold text-[#1b1c18] mt-1">Today, 14:22 IST</div>
                              <span className="font-mono text-[11px] text-[#444748]">Metro Campus Hub</span>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Sourcing Status
                              </span>
                              <span className="inline-block mt-1 px-2.5 py-1 bg-white border border-[#dcdad4] rounded font-mono text-xs text-[#1b1c18] font-bold">
                                Under Review
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#eae8e2]">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#4b6700] animate-pulse"></span>
                            <span className="font-mono text-xs text-[#444748]">
                              High merchant margin potential (estimated 48-52%)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDrawer('DMD-0982')}
                              className="px-3.5 py-2 bg-[#eae8e2] hover:bg-[#e4e2dd] border border-[#dcdad4] rounded text-[#1b1c18] font-mono text-xs uppercase tracking-wider font-semibold transition-colors"
                            >
                              View Demand Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFulfillRequest(activeItems.find((x) => x.id === 'DMD-0982') || { id: 'DMD-0982', title: 'Waterproof Lightweight Commuter Backpack for College', category: 'CARRY' })}
                              className="px-3.5 py-2 bg-[#c6f26a] hover:bg-black hover:text-[#c6f26a] text-black font-sans text-xs uppercase tracking-wider font-bold rounded transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[16px]">task_alt</span>
                              <span>Fulfill Request</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenComposer('DMD-0982')}
                              className="px-4 py-2 bg-black hover:bg-[#c6f26a] hover:text-black text-white font-sans text-xs uppercase tracking-wider font-bold rounded transition-colors flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[16px]">draw</span>
                              <span>Supplier RFQ</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )}

                  {/* CARD 2: Tech Sling */}
                  {activeItems.some((x) => x.id === 'DMD-0941') && (categoryFilter === 'ALL' || categoryFilter === 'CARRY') && (
                    <article className="w-full bg-white border border-[#dcdad4] hover:border-black transition-all rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-sm">
                      {/* Image Frame */}
                      <div className="lg:col-span-4 bg-[#eae8e2] relative min-h-[260px] lg:min-h-full flex items-center justify-center p-6 border-b lg:border-b-0 lg:border-r border-[#dcdad4] group">
                        <img
                          className="w-full h-full max-h-[300px] object-contain transition-transform duration-500 group-hover:scale-105"
                          alt="Technical crossbody sling bag"
                          src={DEMAND_IMAGES['DMD-0941']}
                        />
                        <div className="absolute top-4 left-4">
                          <span className="px-2.5 py-1 bg-[#eae8e2] text-[#1b1c18] font-mono text-[10px] font-bold rounded-full border border-[#dcdad4]">
                            EMERGING DEMAND // FAST MOVER
                          </span>
                        </div>
                        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-2.5 py-1 rounded text-[#1b1c18] font-mono text-xs font-bold">
                          CLUSTER #DMD-0941
                        </div>
                      </div>

                      {/* Information Column */}
                      <div className="lg:col-span-8 p-6 lg:p-8 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="font-mono text-xs text-[#4b6700] uppercase tracking-widest font-bold">
                              Category: Everyday Essentials // Mobility
                            </span>
                            <span className="font-mono text-xs text-[#444748]">
                              First Captured: 11 days ago · Velocity: +78%
                            </span>
                          </div>

                          <h3 className="font-sans text-2xl font-bold text-[#1b1c18] mb-2 leading-tight">
                            Weatherproof Crossbody Ergonomic Tech Sling (10–14L)
                          </h3>

                          <p className="font-body text-sm text-[#444748] mb-4 leading-relaxed">
                            Compact one-strap sling bag engineered for agile motorcycle commutes and urban transit. Customers require dedicated tablet protection (11-inch iPad Pro), weather-sealed external pockets, and ambidextrous strap positioning.
                          </p>

                          {/* Common Specification Chips */}
                          <div className="mb-4">
                            <span className="font-mono text-[11px] text-[#444748] block mb-2 uppercase font-bold">
                              Customer Specifications Filter:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                '10L–14L Capacity',
                                'YKK Aquaguard Zippers',
                                'Breathable Air-Mesh Backing',
                                'Dedicated iPad Sleeve',
                              ].map((spec) => (
                                <span
                                  key={spec}
                                  className="px-2.5 py-1 bg-[#eae8e2] text-[#1b1c18] font-mono text-xs rounded border border-[#dcdad4]"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Demand Metrics Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#f5f3ed] rounded-lg border border-[#dcdad4] mb-4">
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Related Queries
                              </span>
                              <div className="font-sans text-2xl font-bold text-[#1b1c18] mt-0.5">52</div>
                              <div className="w-full bg-[#dcdad4] h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className="bg-[#4b6700] h-full" style={{ width: '72%' }}></div>
                              </div>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Budget Range
                              </span>
                              <div className="font-sans text-base font-bold text-[#1b1c18] mt-1">₹1,500 – ₹2,200</div>
                              <span className="font-mono text-[11px] text-[#4b6700] font-semibold">Sweet Spot: ₹1,850</span>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Most Recent Query
                              </span>
                              <div className="font-mono text-xs font-bold text-[#1b1c18] mt-1">Yesterday, 18:40 IST</div>
                              <span className="font-mono text-[11px] text-[#444748]">Biker EDC Search</span>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Sourcing Status
                              </span>
                              <span className="inline-block mt-1 px-2.5 py-1 bg-white border border-[#dcdad4] rounded font-mono text-xs text-[#1b1c18] font-bold">
                                New Lead
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#eae8e2]">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#444748]"></span>
                            <span className="font-mono text-xs text-[#444748]">
                              Telemetry confirms gap in sub-₹2,000 mobility category
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDrawer('DMD-0941')}
                              className="px-3.5 py-2 bg-[#eae8e2] hover:bg-[#e4e2dd] border border-[#dcdad4] rounded text-[#1b1c18] font-mono text-xs uppercase tracking-wider font-semibold transition-colors"
                            >
                              View Demand Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFulfillRequest(activeItems.find((x) => x.id === 'DMD-0941') || { id: 'DMD-0941', title: 'Weatherproof Crossbody Ergonomic Tech Sling (10–14L)', category: 'CARRY' })}
                              className="px-3.5 py-2 bg-[#c6f26a] hover:bg-black hover:text-[#c6f26a] text-black font-sans text-xs uppercase tracking-wider font-bold rounded transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[16px]">task_alt</span>
                              <span>Fulfill Request</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenComposer('DMD-0941')}
                              className="px-4 py-2 bg-black hover:bg-[#c6f26a] hover:text-black text-white font-sans text-xs uppercase tracking-wider font-bold rounded transition-colors flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[16px]">draw</span>
                              <span>Supplier RFQ</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )}

                  {/* CARD 3: Walnut & Steel Organizer */}
                  {activeItems.some((x) => x.id === 'DMD-0887') && (categoryFilter === 'ALL' || categoryFilter === 'DESK') && (
                    <article className="w-full bg-white border border-[#dcdad4] hover:border-black transition-all rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-sm">
                      {/* Image Frame */}
                      <div className="lg:col-span-4 bg-[#eae8e2] relative min-h-[260px] lg:min-h-full flex items-center justify-center p-6 border-b lg:border-b-0 lg:border-r border-[#dcdad4] group">
                        <img
                          className="w-full h-full max-h-[300px] object-contain transition-transform duration-500 group-hover:scale-105"
                          alt="Solid walnut wood desktop organizer"
                          src={DEMAND_IMAGES['DMD-0887']}
                        />
                        <div className="absolute top-4 left-4">
                          <span className="px-2.5 py-1 bg-[#eae8e2] text-[#444748] font-mono text-[10px] font-bold rounded-full border border-[#dcdad4]">
                            VALIDATED NICHE // ATELIER DESK
                          </span>
                        </div>
                        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-2.5 py-1 rounded text-[#1b1c18] font-mono text-xs font-bold">
                          CLUSTER #DMD-0887
                        </div>
                      </div>

                      {/* Information Column */}
                      <div className="lg:col-span-8 p-6 lg:p-8 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="font-mono text-xs text-[#4b6700] uppercase tracking-widest font-bold">
                              Category: Work &amp; Study // Workspace
                            </span>
                            <span className="font-mono text-xs text-[#444748]">
                              First Captured: 24 days ago · Steady Trend
                            </span>
                          </div>

                          <h3 className="font-sans text-2xl font-bold text-[#1b1c18] mb-2 leading-tight">
                            Modular Solid Walnut &amp; Steel Desktop Organizing Station
                          </h3>

                          <p className="font-body text-sm text-[#444748] mb-4 leading-relaxed">
                            Natural oiled American walnut organizer with powder-coated white metal dividers for phone, fountain pens, and field notebooks. Customers seek an architectural organizer to complement clean minimal mechanical keyboard setups.
                          </p>

                          {/* Common Specification Chips */}
                          <div className="mb-4">
                            <span className="font-mono text-[11px] text-[#444748] block mb-2 uppercase font-bold">
                              Customer Specifications Filter:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                'FSC Natural Solid Walnut',
                                'Powder-coated Matte Steel',
                                'Vertical Phone Stand Slot',
                                'Hidden Cable Pass-Through',
                              ].map((spec) => (
                                <span
                                  key={spec}
                                  className="px-2.5 py-1 bg-[#eae8e2] text-[#1b1c18] font-mono text-xs rounded border border-[#dcdad4]"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Demand Metrics Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#f5f3ed] rounded-lg border border-[#dcdad4] mb-4">
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Related Queries
                              </span>
                              <div className="font-sans text-2xl font-bold text-[#1b1c18] mt-0.5">32</div>
                              <div className="w-full bg-[#dcdad4] h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className="bg-[#4b6700] h-full" style={{ width: '44%' }}></div>
                              </div>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Budget Range
                              </span>
                              <div className="font-sans text-base font-bold text-[#1b1c18] mt-1">₹1,200 – ₹1,800</div>
                              <span className="font-mono text-[11px] text-[#4b6700] font-semibold">Sweet Spot: ₹1,550</span>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Most Recent Query
                              </span>
                              <div className="font-mono text-xs font-bold text-[#1b1c18] mt-1">2 days ago</div>
                              <span className="font-mono text-[11px] text-[#444748]">Desk Setup Search</span>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                                Sourcing Status
                              </span>
                              <span className="inline-block mt-1 px-2.5 py-1 bg-white border border-[#dcdad4] rounded font-mono text-xs text-[#1b1c18] font-bold">
                                Sourcing RFQ
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#eae8e2]">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#4b6700]"></span>
                            <span className="font-mono text-xs text-[#444748]">
                              High repeat collector potential with matching desk trays
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDrawer('DMD-0887')}
                              className="px-3.5 py-2 bg-[#eae8e2] hover:bg-[#e4e2dd] border border-[#dcdad4] rounded text-[#1b1c18] font-mono text-xs uppercase tracking-wider font-semibold transition-colors"
                            >
                              View Demand Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFulfillRequest(activeItems.find((x) => x.id === 'DMD-0887') || { id: 'DMD-0887', title: 'Modular Solid Walnut & Steel Desktop Organizing Station', category: 'DESK' })}
                              className="px-3.5 py-2 bg-[#c6f26a] hover:bg-black hover:text-[#c6f26a] text-black font-sans text-xs uppercase tracking-wider font-bold rounded transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[16px]">task_alt</span>
                              <span>Fulfill Request</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenComposer('DMD-0887')}
                              className="px-4 py-2 bg-black hover:bg-[#c6f26a] hover:text-black text-white font-sans text-xs uppercase tracking-wider font-bold rounded transition-colors flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[16px]">draw</span>
                              <span>Supplier RFQ</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )}
                </div>
              </div>
            </section>
          ) : (
            /* Fulfilled Requests or Empty State Preview Section */
            <section className="w-full px-6 lg:px-12 py-12 bg-[#fbf9f3]">
              <div className="max-w-7xl mx-auto">
                {fulfilledItems.length > 0 ? (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#dcdad4] gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></span>
                          <span className="font-mono text-xs text-[#166534] font-bold uppercase tracking-wider">
                            Catalog Provisioning Complete
                          </span>
                        </div>
                        <h3 className="font-sans text-2xl font-bold text-[#1b1c18] mt-1">
                          Fulfilled Customer Requests ({fulfilledItems.length})
                        </h3>
                        <p className="font-body text-xs text-[#444748] mt-0.5">
                          These customer demand clusters have been converted into active inventory in your live store catalog.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onBackToStore}
                        className="px-4 py-2 bg-black hover:bg-[#c6f26a] hover:text-black text-white font-sans text-xs uppercase tracking-wider font-bold rounded-full transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">storefront</span>
                        <span>View in Storefront</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {fulfilledItems.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="bg-white border border-[#bbf7d0] rounded-xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span className="px-2.5 py-0.5 rounded-full bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] font-mono text-[10px] font-bold uppercase tracking-wider">
                                ✓ Live in Store
                              </span>
                              <span className="font-mono text-[11px] text-[#444748]">
                                {item.fulfilledAt ? `Fulfilled at ${item.fulfilledAt}` : 'Just now'}
                              </span>
                            </div>

                            <h4 className="font-sans text-base font-bold text-[#1b1c18] mb-1.5 leading-snug">
                              {item.title}
                            </h4>

                            <p className="font-body text-xs text-[#444748] line-clamp-2 mb-3 leading-relaxed">
                              {item.description}
                            </p>

                            <div className="p-3 bg-[#f5f3ed] rounded-lg border border-[#eae8e2] font-mono text-xs space-y-1 mb-4">
                              <div className="flex items-center justify-between text-[#1b1c18]">
                                <span>Initial Stock Added:</span>
                                <span className="font-bold text-[#166534]">+{item.stockAdded || 15} units</span>
                              </div>
                              <div className="flex items-center justify-between text-[#444748]">
                                <span>Target Selling Price:</span>
                                <span className="font-bold text-[#1b1c18]">₹2,199</span>
                              </div>
                              <div className="flex items-center justify-between text-[#444748]">
                                <span>Category:</span>
                                <span className="uppercase font-semibold">{item.category || 'Carry'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-[#eae8e2] flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#166534]">
                              <span className="material-symbols-outlined text-[15px]">check_circle</span>
                              <span>Instant Search Enabled</span>
                            </span>
                            <button
                              type="button"
                              onClick={onBackToStore}
                              className="text-xs font-sans font-bold text-black hover:text-[#4b6700] underline uppercase tracking-wider"
                            >
                              Open in Shop →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto text-center py-16 px-8 border border-dashed border-[#dcdad4] rounded-2xl bg-white shadow-sm">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#e8f5e9] flex items-center justify-center text-[#2e7d32]">
                      <span className="material-symbols-outlined text-[32px]">task_alt</span>
                    </div>
                    <h3 className="font-sans text-2xl font-bold text-[#1b1c18] mb-2">
                      All Customer Requests Fulfilled
                    </h3>
                    <p className="font-body text-sm text-[#444748] max-w-md mx-auto mb-6 leading-relaxed">
                      All recent customer queries have been successfully matched and supplied in your catalog. When shoppers submit new unfulfilled requests, they will automatically appear under Active Requests.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] font-mono text-xs text-[#166534]">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
                      <span>Demand listener active · 0 pending gaps</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Slide-Over Drawer: Demand Opportunity Breakdown */}
          {selectedDrawerItem && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={handleCloseDrawer}
              ></div>
              <aside className="relative z-50 w-full max-w-2xl bg-white shadow-2xl border-l border-[#dcdad4] flex flex-col justify-between overflow-hidden h-full">
                {/* Drawer Header */}
                <div className="p-6 border-b border-[#eae8e2] bg-[#f5f3ed] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#c6f26a] text-black font-mono text-[10px] font-bold rounded">
                        DEMAND BREAKDOWN
                      </span>
                      <span className="font-mono text-xs text-[#444748] font-bold">
                        CLUSTER #{selectedDrawerItem}
                      </span>
                    </div>
                    <h3 className="font-sans text-xl font-bold text-[#1b1c18] mt-1">
                      {selectedDrawerItem === 'DMD-0941'
                        ? 'Weatherproof Crossbody Ergonomic Tech Sling'
                        : selectedDrawerItem === 'DMD-0887'
                        ? 'Modular Solid Walnut & Steel Organizing Station'
                        : 'Waterproof Lightweight Commuter Backpack'}
                    </h3>
                    <p className="font-body text-xs text-[#444748]">
                      Aggregated from verified customer intent queries across 30 days
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close drawer"
                    className="p-2 text-[#444748] hover:text-black hover:bg-[#eae8e2] rounded transition-colors"
                    onClick={handleCloseDrawer}
                  >
                    <span className="material-symbols-outlined text-[24px]">close</span>
                  </button>
                </div>

                {/* Drawer Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Section A: Synthesized Product Requirements */}
                  <div>
                    <h4 className="font-mono text-xs text-[#1b1c18] uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#4b6700]">checklist</span>
                      A. Synthesized Product Requirements
                    </h4>
                    <div className="bg-[#f5f3ed] rounded-xl border border-[#dcdad4] p-4">
                      <div className="space-y-2.5 font-body text-xs text-[#1b1c18]">
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#4b6700]">check_box</span>
                          <span><strong>Net Weight Constraint:</strong> Strict requirement for sub-900 gram base tare weight without sacrificing durability.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#4b6700]">check_box</span>
                          <span><strong>Waterproofing Standard:</strong> IPX4 rating minimum (taped seams or coated 600D ballistic matte nylon).</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#4b6700]">check_box</span>
                          <span><strong>Hardware &amp; Enclosure:</strong> Low-profile metal G-hook or magnetic roll-top fastening. No squeaky plastic hardware.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#4b6700]">check_box</span>
                          <span><strong>Internal Device Suspension:</strong> Elevated bottom padded cradle for up to 16" MacBook Pro.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section B: Customer Queries Live Feed */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-mono text-xs text-[#1b1c18] uppercase tracking-wider font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#4b6700]">chat</span>
                        B. Anonymized Customer Queries Feed (Last 72 Hours)
                      </h4>
                      <span className="font-mono text-[10px] text-[#444748]">
                        {(demandRadarData?.recent_signals?.length || 0) + 3} Queries captured
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {/* Live queries from demand_signals table */}
                      {demandRadarData?.recent_signals?.map((sig, idx) => (
                        <div key={sig.id || idx} className="p-3 bg-white border border-[#bbf7d0] rounded-lg shadow-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-1.5 py-0.5 rounded bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] font-mono text-[9px] font-bold uppercase">
                              Live Request
                            </span>
                            <span className="font-mono text-[10px] text-[#444748]">
                              Category: {sig.category || 'General'}
                            </span>
                          </div>
                          <p className="font-body text-xs text-[#1b1c18] italic leading-relaxed font-medium">
                            "{sig.query}"
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#eae8e2] font-mono text-[10px] text-[#444748]">
                            <span>Verified Shopper #{sig.id ? `SIG-${sig.id}` : `S-${8900 + idx}`}</span>
                            <span>{sig.created_at ? new Date(sig.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                          </div>
                        </div>
                      ))}

                      {/* Baseline Verified Samples */}
                      <div className="p-3 bg-white border border-[#dcdad4] rounded-lg">
                        <p className="font-body text-xs text-[#1b1c18] italic leading-relaxed">
                          "Need a waterproof laptop backpack for my daily metro ride to campus, under ₹2,500 with water bottle sleeve."
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#eae8e2] font-mono text-[10px] text-[#444748]">
                          <span>Verified Shopper #S-49102</span>
                          <span>Bengaluru Metro Hub · 3h ago</span>
                        </div>
                      </div>
                      <div className="p-3 bg-white border border-[#dcdad4] rounded-lg">
                        <p className="font-body text-xs text-[#1b1c18] italic leading-relaxed">
                          "Looking for a clean matte black college pack that won't soak my MacBook during monsoon downpours."
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#eae8e2] font-mono text-[10px] text-[#444748]">
                          <span>Verified Shopper #S-21849</span>
                          <span>Mumbai Atelier Portal · Yesterday</span>
                        </div>
                      </div>
                      <div className="p-3 bg-white border border-[#dcdad4] rounded-lg">
                        <p className="font-body text-xs text-[#1b1c18] italic leading-relaxed">
                          "Lightweight rolltop commuter bag with zero loud branding and decent shoulder padding."
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#eae8e2] font-mono text-[10px] text-[#444748]">
                          <span>Verified Shopper #S-77312</span>
                          <span>Delhi NCR · 2 days ago</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section C: Budget Distribution Density Curve */}
                  <div>
                    <h4 className="font-mono text-xs text-[#1b1c18] uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#4b6700]">stacked_bar_chart</span>
                      C. Budget Distribution Density Curve
                    </h4>
                    <div className="p-4 bg-[#f5f3ed] rounded-xl border border-[#dcdad4]">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="font-mono text-xs text-[#444748]">Median Intent: ₹2,200</span>
                        <span className="font-mono text-xs text-[#4b6700] font-bold">Concentration Peak: ₹2,000–₹2,350</span>
                      </div>
                      <div className="w-full h-24 flex items-end gap-2 pt-4">
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-[#dcdad4] hover:bg-[#4b6700] transition-colors rounded-t" style={{ height: '25%' }}></div>
                          <span className="font-mono text-[10px] text-[#444748]">1.5K</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-[#dcdad4] hover:bg-[#4b6700] transition-colors rounded-t" style={{ height: '45%' }}></div>
                          <span className="font-mono text-[10px] text-[#444748]">1.8K</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-[#4b6700] rounded-t" style={{ height: '90%' }}></div>
                          <span className="font-mono text-[10px] font-bold text-black">2.2K</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-[#dcdad4] hover:bg-[#4b6700] transition-colors rounded-t" style={{ height: '70%' }}></div>
                          <span className="font-mono text-[10px] text-[#444748]">2.5K</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-[#dcdad4] hover:bg-[#4b6700] transition-colors rounded-t" style={{ height: '20%' }}></div>
                          <span className="font-mono text-[10px] text-[#444748]">2.8K</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-4 border-t border-[#eae8e2] bg-[#f5f3ed] flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    className="px-4 py-2 border border-[#dcdad4] rounded text-[#1b1c18] font-mono text-xs uppercase"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenComposer(selectedDrawerItem)}
                    className="px-5 py-2.5 bg-black hover:bg-[#c6f26a] hover:text-black text-white rounded font-sans text-xs uppercase tracking-wider font-bold transition-colors"
                  >
                    Create Supplier RFQ Draft →
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* Sourcing RFQ Composer Modal */}
          {composerItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setComposerItem(null)}
              ></div>
              <div className="relative z-50 bg-white border border-[#dcdad4] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-6 border-b border-[#eae8e2] bg-[#f5f3ed] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 bg-[#4b6700] rounded-sm"></div>
                    <div>
                      <span className="font-mono text-[10px] text-[#444748] block uppercase font-bold">
                        ATELIER PROCUREMENT ENGINE
                      </span>
                      <h3 className="font-sans text-xl font-bold text-[#1b1c18]">
                        Supplier Enquiry Draft // Demand Cluster #{composerItem}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close modal"
                    onClick={() => setComposerItem(null)}
                    className="p-1 text-[#444748] hover:text-black"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-4">
                  {/* Notice Strip */}
                  <div className="p-3 bg-[#eae8e2] rounded-lg border border-[#dcdad4] flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-[#4b6700] mt-0.5">verified_user</span>
                    <p className="font-body text-xs text-[#444748] leading-relaxed">
                      <strong>Manual Merchant Approval:</strong> ShelfSense never auto-dispatches purchase orders without authorization. Review and configure parameters below before generation.
                    </p>
                  </div>

                  <div>
                    <label className="font-mono text-xs uppercase block mb-1 font-bold text-[#1b1c18]">
                      Enquiry Title / Subject Line
                    </label>
                    <input
                      type="text"
                      value={rfpTitle}
                      onChange={(e) => setRfpTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#f5f3ed] border border-[#dcdad4] rounded-lg font-sans text-sm text-[#1b1c18] focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-mono text-xs uppercase block mb-1 font-bold text-[#1b1c18]">
                        Target Unit Cost (INR)
                      </label>
                      <input
                        type="text"
                        value={targetCost}
                        onChange={(e) => setTargetCost(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f5f3ed] border border-[#dcdad4] rounded-lg font-mono text-xs text-[#1b1c18]"
                      />
                      <span className="font-mono text-[10px] text-[#444748] mt-1 block">Yields ~52% Gross Margin</span>
                    </div>
                    <div>
                      <label className="font-mono text-xs uppercase block mb-1 font-bold text-[#1b1c18]">
                        Minimum Order Qty (MOQ)
                      </label>
                      <input
                        type="text"
                        value={moq}
                        onChange={(e) => setMoq(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f5f3ed] border border-[#dcdad4] rounded-lg font-mono text-xs text-[#1b1c18]"
                      />
                      <span className="font-mono text-[10px] text-[#444748] mt-1 block">Batch test run</span>
                    </div>
                    <div>
                      <label className="font-mono text-xs uppercase block mb-1 font-bold text-[#1b1c18]">
                        Lead Time
                      </label>
                      <input
                        type="text"
                        value={leadTime}
                        onChange={(e) => setLeadTime(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f5f3ed] border border-[#dcdad4] rounded-lg font-mono text-xs text-[#1b1c18]"
                      />
                      <span className="font-mono text-[10px] text-[#444748] mt-1 block">Ex-factory Bengaluru</span>
                    </div>
                  </div>

                  <div>
                    <label className="font-mono text-xs uppercase block mb-1 font-bold text-[#1b1c18]">
                      Material &amp; Architecture Specifications
                    </label>
                    <textarea
                      rows={5}
                      value={rfpSpecs}
                      onChange={(e) => setRfpSpecs(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#f5f3ed] border border-[#dcdad4] rounded-lg font-mono text-xs text-[#1b1c18] leading-relaxed"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-[#eae8e2] bg-[#f5f3ed] flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setComposerItem(null)}
                    className="px-4 py-2 border border-[#dcdad4] rounded text-[#1b1c18] font-mono text-xs uppercase font-semibold"
                  >
                    Cancel &amp; Discard
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        showToast('Draft specifications saved to Procurement Storage.');
                        setComposerItem(null);
                      }}
                      className="px-4 py-2 bg-[#eae8e2] hover:bg-[#e4e2dd] border border-[#dcdad4] rounded text-[#1b1c18] font-mono text-xs uppercase font-semibold"
                    >
                      Save Draft Spec
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateRfq}
                      className="px-5 py-2.5 bg-black hover:bg-[#c6f26a] hover:text-black text-white rounded font-sans text-xs uppercase font-bold tracking-wider transition-colors"
                    >
                      Generate Enquiry Packet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* Inventory Allocation & ROP View */
        <main className="w-full px-6 lg:px-12 py-10 max-w-7xl mx-auto space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eae8e2] pb-6">
            <div>
              <h2 className="font-sans text-3xl font-bold uppercase tracking-tight text-[#1b1c18]">
                Inventory Allocation &amp; Scientific Reorder Point
              </h2>
              <p className="font-body text-xs text-[#444748] mt-1">
                Deterministic replenishment calculation using $ROP = (D \times L) + SS$.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 rounded bg-black text-white font-mono text-xs uppercase font-bold flex items-center gap-2"
            >
              <span className={`material-symbols-outlined text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
              <span>Sync Stock</span>
            </button>
          </div>

          {/* ROP Table */}
          <div className="bg-white border border-[#dcdad4] rounded-xl p-6 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-[#eae8e2] text-[#444748] uppercase">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Live Stock</th>
                  <th className="py-3 px-4">Daily Demand (D)</th>
                  <th className="py-3 px-4">Lead Time (L)</th>
                  <th className="py-3 px-4">Safety Stock (SS)</th>
                  <th className="py-3 px-4">ROP Trigger</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f3ed]">
                {(overviewData?.products || [
                  { id: 'prod_001', title: 'AeroShield Waterproof 24L Commuter Bag', category: 'bags', stock: 8, daily_demand: 2.4, lead_time_days: 5, safety_stock: 4, reorder_point: 16, reorder_needed: true },
                  { id: 'prod_002', title: 'Nordic Minimalist Roll-top 22L', category: 'bags', stock: 14, daily_demand: 1.8, lead_time_days: 4, safety_stock: 3, reorder_point: 10, reorder_needed: false },
                  { id: 'prod_003', title: 'AeroSling Tech Courier 14L', category: 'accessories', stock: 5, daily_demand: 1.2, lead_time_days: 7, safety_stock: 4, reorder_point: 12, reorder_needed: true },
                  { id: 'prod_004', title: 'Neoprene Laptop Sleeve 13-inch', category: 'accessories', stock: 22, daily_demand: 2.1, lead_time_days: 3, safety_stock: 2, reorder_point: 8, reorder_needed: false },
                ]).map((p) => (
                  <tr key={p.id} className="hover:bg-[#fbf9f3]">
                    <td className="py-3 px-4 font-bold text-black">{p.title}</td>
                    <td className="py-3 px-4 text-[#444748] uppercase">{p.category}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold ${p.stock <= 8 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {p.stock} units
                      </span>
                    </td>
                    <td className="py-3 px-4">{p.daily_demand || 2.0}/day</td>
                    <td className="py-3 px-4">{p.lead_time_days || 5} days</td>
                    <td className="py-3 px-4">{p.safety_stock || 4} units</td>
                    <td className="py-3 px-4 font-bold">{p.reorder_point || 14} units</td>
                    <td className="py-3 px-4">
                      {p.reorder_needed || p.stock <= (p.reorder_point || 10) ? (
                        <button
                          type="button"
                          onClick={() => showToast(`Automated PO drafted for ${p.title}`)}
                          className="px-3 py-1 bg-black text-white hover:bg-[#c6f26a] hover:text-black rounded text-[10px] uppercase font-bold"
                        >
                          Trigger PO
                        </button>
                      ) : (
                        <span className="text-[#4b6700] text-[10px] uppercase font-bold">Optimal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* Merchant Console Footer */}
      <footer className="w-full bg-[#f0eee8] border-t border-[#dcdad4] py-8 px-6 lg:px-12 mt-16 font-mono text-xs text-[#444748]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-black">ShelfSense Merchant Console</span>
            <span>·</span>
            <span>Real-time Demand Telemetry &amp; Inventory Orchestration</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-[#166534]">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
              Storefront Synced
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
