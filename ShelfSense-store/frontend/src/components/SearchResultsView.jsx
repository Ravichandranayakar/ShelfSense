import React, { useState } from 'react';

// Exact image URLs matching the Google Stitch design
const SEARCH_IMAGES = {
  hero: 'https://lh3.googleusercontent.com/aida/ALJJyrCDayMPVMwmftjoMJiksmYQOMzSMi_j0HHWvM1X1vzc8il-yoyFcOe9YEcbO2e9_-9oqmsZomuHCbVKfQ8gZqr5b2Z5FzknQ5ZgHdoL5oWAeG1hwi_UTOF26beq79LkQiEkT7c3VE860t81ARwBz8c88xY1gIFyxcv2IQywpfOh7FdueoJMEVJwMxF54-b2tTdvzFMFl2Oog6nyXSKlunTN3iQaMmQ6YtLAjGzaNqzqhw',
  rolltop: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBFMnhXrnyyuL7IGC7mWyEgDyhsK0cyrq65eVh-RMm_ulIZaqXNvwIkD67Cz5xivw7IjRg58ucHWJ4S7lEjEpdtw4voOvNfjtt_s5iZI3EOvlObQNbMaUM7I1ZbXAoYMtE99i21HX7Ezn1HXHtbAv2TyN1Nu3r5Me0ep0YygXFo6kaEcXvPxxigoiOzzQaGuKvvUaouOZDLs_2Pujc2-u9RGltQY5rF98aa7Cgv53pD',
  courier: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCrOoZiPmj9TDB-SHl9OTCcMap6yA_odKhR49GbawduwJFpPOQZCm64RtXBDAvk04wIcljvZ-nzYbBV77srwZT1xrb9ui9u5yosEXCg8C5BVfc6Nbgl3knOQ3CkalSXrW-1TxiKh6KrumCkzCBkLxD2aEu612sa-KEZt5-ZMPx_MfTJi0FPkXMlZM_rxSNetRMmJbS74r3Ix1ZoRX_efnajEjaarl-bXEY_-lCvYUax',
};

export default function SearchResultsView({
  initialQuery = 'I need a lightweight laptop bag for college, waterproof, under ₹2,500...',
  onSearch,
  isLoading = false,
  addToCart,
  toggleWishlist,
  wishlist = {},
  showToast,
  onOpenDemandRequest,
  onBackToHome,
}) {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [activeState, setActiveState] = useState('results'); // 'results' | 'loading' | 'gap' | 'offline'
  const [layoutView, setLayoutView] = useState('grid'); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState('relevance');

  // Extracted intent chips
  const [intentChips, setIntentChips] = useState([
    { id: '1', label: 'Backpack format' },
    { id: '2', label: 'College / Campus use' },
    { id: '3', label: 'Waterproof (IPX4+)' },
    { id: '4', label: 'Weight < 900g' },
    { id: '5', label: 'Max Budget: ₹2,500' },
  ]);

  // Sidebar filter states
  const [filters, setFilters] = useState({
    allPacks: true,
    rolltop: true,
    slings: true,
    modular: false,
    under2000: false,
    midRange: true,
    above2500: false,
    inStock: true,
    madeToOrder: false,
  });

  const removeChip = (id) => {
    setIntentChips((prev) => prev.filter((c) => c.id !== id));
    showToast('Preference constraint removed');
  };

  const handleAddConstraint = () => {
    const val = prompt("Enter additional criteria (e.g. 'Must fit 15-inch laptop', 'Has luggage strap'):");
    if (val && val.trim()) {
      const newChip = { id: String(Date.now()), label: val.trim() };
      setIntentChips((prev) => [...prev, newChip]);
      showToast(`Added constraint: "${val.trim()}"`);
    }
  };

  const handleDeepenPrompt = () => {
    const refined = `${queryInput.trim()}, with side hydration pocket and luggage pass-through`;
    setQueryInput(refined);
    showToast('Intent query deepened. Refining catalog match...');
    if (onSearch) {
      onSearch(refined);
    }
  };

  const handleSubmitSearch = (e) => {
    e?.preventDefault();
    if (!queryInput.trim()) return;
    if (onSearch) {
      onSearch(queryInput);
    }
  };

  const resetAllFilters = () => {
    setFilters({
      allPacks: true,
      rolltop: true,
      slings: true,
      modular: false,
      under2000: false,
      midRange: true,
      above2500: false,
      inStock: true,
      madeToOrder: false,
    });
    showToast('Filters reset to default');
  };

  return (
    <div className="w-full bg-[#fbf9f3] text-[#1b1c18] min-h-screen">
      {/* 1. EDITORIAL CONTEXT SUB-TICKER & INTENT METRICS */}
      <section className="w-full bg-[#eae8e2] text-[#1b1c18] border-b border-[#e4e2dd] px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px] font-sans font-bold uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#4b6700]"></span>
            <span className="font-semibold tracking-wider text-[#1b1c18]">
              Results for:
            </span>
            <span className="text-[#444748] font-normal normal-case text-xs tracking-normal truncate max-w-md">
              “{queryInput}”
            </span>
          </div>
          <div className="flex items-center gap-4 text-[#444748]">
            <span className="font-mono text-xs font-semibold text-[#1b1c18]">6 PRODUCTS FOUND</span>
          </div>
        </div>
      </section>

      {/* 2. NATURAL INTENT INPUT & QUERY REFINEMENT */}
      <section className="w-full px-6 lg:px-8 pt-8 pb-10 bg-[#fbf9f3]">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Natural Language Command Box */}
          <div className="bg-white p-4 sm:p-6 shadow-sm rounded-xl border border-[#c4c7c7]/50">
            <label className="block text-[11px] font-sans uppercase text-[#444748] mb-3 tracking-widest font-bold">
              Describe what you need
            </label>
            <form onSubmit={handleSubmitSearch} className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#444748] text-[22px]">
                  neurology
                </span>
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-[#f5f3ed] text-[#1b1c18] font-sans text-[16px] sm:text-[17px] border border-[#c4c7c7]/60 focus:border-black focus:bg-white transition-colors focus:outline-none rounded-lg font-medium"
                  placeholder="Describe your intent in plain language..."
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="px-8 py-3.5 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-colors text-xs font-sans uppercase tracking-widest font-semibold flex items-center justify-center gap-2 rounded-lg shrink-0"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Refining...</span>
                  </>
                ) : (
                  <>
                    <span>Discover</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 3. EXTRACTED INTENT CHIPS */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c6f26a] ring-4 ring-[#c6f26a]/20 animate-pulse"></span>
              <span className="text-[11px] font-sans uppercase tracking-wider text-[#1b1c18] font-bold">
                Active Preferences
              </span>
            </div>
            <span className="font-body text-xs text-[#444748]">
              Filtered based on your natural language criteria.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {intentChips.map((chip) => (
              <div
                key={chip.id}
                className="group flex items-center gap-2 bg-[#eae8e2] border border-[#c4c7c7]/50 px-3.5 py-1.5 rounded-full text-[#1b1c18] font-mono text-xs"
              >
                <span className="material-symbols-outlined text-[14px] text-[#4b6700] font-bold">check</span>
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={() => removeChip(chip.id)}
                  className="text-[#444748] hover:text-rose-600 ml-1 transition-colors leading-none"
                  aria-label={`Remove ${chip.label}`}
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add Constraint Button */}
            <button
              type="button"
              onClick={handleAddConstraint}
              className="flex items-center gap-1.5 bg-white hover:bg-[#eae8e2] border border-dashed border-[#747878] px-3.5 py-1.5 rounded-full text-[#1b1c18] font-mono text-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add constraint</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4. MAIN DISCOVERY ARCHITECTURE: FILTER SIDEBAR + BESPOKE GRID */}
      <section className="w-full px-6 lg:px-8 pb-24 bg-[#fbf9f3]">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="w-full py-24 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#f0eee8] flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[32px] text-[#4b6700] animate-spin">
                  progress_activity
                </span>
              </div>
              <span className="text-[11px] font-sans tracking-widest text-[#444748] uppercase font-bold mb-2">
                SEARCHING LIVE CATALOG
              </span>
              <h3 className="font-sans text-2xl font-semibold text-[#1b1c18] max-w-md">
                Matching products against your criteria...
              </h3>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* A. EXPANDABLE FILTER SIDEBAR (Fixed 280px) */}
              <aside className="w-full lg:w-[280px] shrink-0 flex flex-col gap-6 bg-white p-6 rounded-xl border border-[#c4c7c7]/60 shadow-sm">
                {/* Sidebar Meta & Reset */}
                <div className="flex items-center justify-between pb-4 border-b border-[#f0eee8]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                    <span className="text-[11px] font-sans uppercase tracking-wider font-bold">FILTERS</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="font-mono text-xs text-[#444748] hover:text-black underline"
                  >
                    Reset all
                  </button>
                </div>

                {/* Group 1: Category */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-[#1b1c18] font-sans text-sm font-semibold">
                    <span>Category</span>
                    <span className="font-mono text-xs text-[#444748]">4</span>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 font-body text-xs">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters.allPacks}
                          onChange={(e) => setFilters({ ...filters, allPacks: e.target.checked })}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="group-hover:text-black font-medium">All Packs</span>
                      </span>
                      <span className="text-[#444748] font-mono text-[11px]">6</span>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters.rolltop}
                          onChange={(e) => setFilters({ ...filters, rolltop: e.target.checked })}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="group-hover:text-black">Roll-top Commuters</span>
                      </span>
                      <span className="text-[#444748] font-mono text-[11px]">3</span>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters.slings}
                          onChange={(e) => setFilters({ ...filters, slings: e.target.checked })}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="group-hover:text-black">Daily Slings</span>
                      </span>
                      <span className="text-[#444748] font-mono text-[11px]">2</span>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters.modular}
                          onChange={(e) => setFilters({ ...filters, modular: e.target.checked })}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="group-hover:text-black">Modular Backpacks</span>
                      </span>
                      <span className="text-[#444748] font-mono text-[11px]">1</span>
                    </label>
                  </div>
                </div>

                {/* Group 2: Price Bracket */}
                <div className="flex flex-col gap-3 pt-4 border-t border-[#f0eee8]">
                  <div className="flex items-center justify-between text-[#1b1c18] font-sans text-sm font-semibold">
                    <span>Price Bracket</span>
                    <span className="font-mono text-xs text-[#4b6700] font-semibold">INR (₹)</span>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 font-body text-xs">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters.under2000}
                          onChange={(e) => setFilters({ ...filters, under2000: e.target.checked })}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="group-hover:text-black">Under ₹2,000</span>
                      </span>
                      <span className="text-[#444748] font-mono text-[11px]">1</span>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters.midRange}
                          onChange={(e) => setFilters({ ...filters, midRange: e.target.checked })}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-black font-semibold">₹2,000 – ₹2,500</span>
                      </span>
                      <span className="bg-[#c6f26a] text-black px-1.5 py-0.5 rounded text-[10px] font-bold">
                        MATCH
                      </span>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group opacity-60">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters.above2500}
                          onChange={(e) => setFilters({ ...filters, above2500: e.target.checked })}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="group-hover:text-black">₹2,500+ (Out of budget)</span>
                      </span>
                      <span className="text-[#444748] font-mono text-[11px]">0</span>
                    </label>
                  </div>
                </div>

                {/* Group 3: Availability & Dispatch */}
                <div className="flex flex-col gap-3 pt-4 border-t border-[#f0eee8]">
                  <div className="flex items-center justify-between text-[#1b1c18] font-sans text-sm font-semibold">
                    <span>Availability</span>
                    <span className="font-mono text-xs text-[#444748]">Logistics</span>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 font-body text-xs">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters.inStock}
                          onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="group-hover:text-black font-medium">In Stock (Ships &lt; 24h)</span>
                      </span>
                      <span className="text-[#444748] font-mono text-[11px]">5</span>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters.madeToOrder}
                          onChange={(e) => setFilters({ ...filters, madeToOrder: e.target.checked })}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="group-hover:text-black">Made to Order (3-5 days)</span>
                      </span>
                      <span className="text-[#444748] font-mono text-[11px]">1</span>
                    </label>
                  </div>
                </div>

                {/* Sidebar Guarantee Card */}
                <div className="bg-[#f0eee8] p-4 rounded-lg text-xs text-[#444748] mt-2 border border-[#c4c7c7]/30">
                  <div className="flex items-center gap-2 text-[#1b1c18] font-semibold mb-1">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>ShelfSense Guarantee</span>
                  </div>
                  All bags are lab-tested against Indian monsoon downpours and ergonomic spinal load thresholds.
                </div>
              </aside>

              {/* B. MAIN PRODUCT DISCOVERY GRID */}
              <div className="flex-1 min-w-0 flex flex-col gap-6">
                {/* Top Bar: Counter, Sorting, Layout Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#c4c7c7]/50 shadow-sm">
                  <div className="flex items-baseline gap-3">
                    <span className="font-sans text-xl uppercase tracking-tight text-[#1b1c18] font-bold">
                      Curated Products
                    </span>
                    <span className="font-mono text-xs text-[#444748]">(6)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-sans text-[#444748] whitespace-nowrap font-bold">SORT BY:</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-[#f0eee8] text-[#1b1c18] font-mono text-xs py-1.5 px-3 rounded-lg border-none focus:ring-0 cursor-pointer"
                      >
                        <option value="relevance">Most Relevant</option>
                        <option value="price-asc">Price: Low to High</option>
                        <option value="weight">Weight: Lightest First</option>
                        <option value="dispatch">Dispatch Speed</option>
                      </select>
                    </div>
                    {/* View Toggle */}
                    <div className="hidden sm:flex items-center bg-[#f0eee8] p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setLayoutView('grid')}
                        className={`p-1 rounded ${layoutView === 'grid' ? 'bg-white shadow-sm text-black' : 'text-[#444748] hover:text-black'}`}
                        title="Editorial Grid"
                      >
                        <span className="material-symbols-outlined text-[18px]">grid_view</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLayoutView('list')}
                        className={`p-1 rounded ${layoutView === 'list' ? 'bg-white shadow-sm text-black' : 'text-[#444748] hover:text-black'}`}
                        title="Condensed Index"
                      >
                        <span className="material-symbols-outlined text-[18px]">view_agenda</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* PRODUCT LIST */}
                <div className="flex flex-col gap-6">
                  {/* CARD 1: FEATURED HERO PRODUCT CARD (50/50 2-column split) */}
                  <article className="bg-white rounded-xl overflow-hidden border border-[#c4c7c7]/60 shadow-sm hover:shadow-md transition-shadow group flex flex-col lg:flex-row items-stretch">
                    {/* Left 50% Image Container */}
                    <div className="lg:w-1/2 relative bg-[#e4e2dd] min-h-[380px] lg:min-h-[440px] overflow-hidden flex items-center justify-center border-b lg:border-b-0 lg:border-r border-[#c4c7c7]/40">
                      <img
                        alt="AeroShield Waterproof 24L Commuter Bag"
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                        src={SEARCH_IMAGES.hero}
                      />
                      {/* Top Match Badge */}
                      <div className="absolute top-4 left-4 bg-[#c6f26a] text-black px-3 py-1.5 rounded-full text-[10px] font-sans font-bold tracking-widest shadow-sm">
                        TOP MATCH
                      </div>
                      {/* Wishlist Trigger */}
                      <button
                        type="button"
                        aria-label="Save to Wishlist"
                        onClick={() => toggleWishlist('prod_001')}
                        className={`absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm ${
                          wishlist['prod_001'] ? 'text-rose-600' : 'text-[#1b1c18]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {wishlist['prod_001'] ? 'favorite' : 'favorite_border'}
                        </span>
                      </button>
                    </div>

                    {/* Right 50% Technical Specs, Typography & Actions */}
                    <div className="lg:w-1/2 p-6 sm:p-8 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="font-mono text-xs uppercase tracking-widest text-[#444748]">
                            SKU #SS-0982
                          </span>
                          <span className="font-serif italic text-sm text-[#4b6700] font-medium">
                            Monsoon Rated
                          </span>
                        </div>
                        <h3 className="font-sans text-2xl sm:text-3xl font-bold text-[#1b1c18] group-hover:text-[#4b6700] transition-colors mb-3 leading-tight">
                          AeroShield Waterproof 24L Commuter Bag
                        </h3>
                        <p className="font-body text-sm text-[#444748] mb-6 leading-relaxed">
                          Ultralight ripstop waterproof shell with welded seams, ergonomic airmesh back panel, and dedicated 16" laptop sleeve under ₹2,500.
                        </p>

                        {/* Technical Specs Matrix */}
                        <div className="bg-[#f0eee8] p-4 rounded-lg flex flex-col gap-2 mb-6 font-mono text-xs text-[#1b1c18] border border-[#c4c7c7]/30">
                          <div className="flex justify-between border-b border-[#c4c7c7]/30 pb-2">
                            <span className="text-[#444748]">Net Weight</span>
                            <span className="font-semibold">780g (Featherweight)</span>
                          </div>
                          <div className="flex justify-between border-b border-[#c4c7c7]/30 pb-2">
                            <span className="text-[#444748]">Material</span>
                            <span>420D Ballistic Cordura Shell</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#444748]">Hardware</span>
                            <span>YKK Aquaguard Zippers</span>
                          </div>
                        </div>
                      </div>

                      {/* Price and CTA */}
                      <div className="pt-4 border-t border-[#f0eee8]">
                        <div className="flex items-baseline justify-between mb-4">
                          <div>
                            <span className="font-sans text-3xl text-[#1b1c18] font-bold">₹2,499</span>
                          </div>
                          <span className="text-[#4b6700] font-mono text-xs flex items-center gap-1.5 font-medium">
                            <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                            Ships in 24h
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            addToCart({
                              id: 'prod_001',
                              title: 'AeroShield Waterproof 24L Commuter Bag',
                              price_paise: 249900,
                              stock: 8,
                            });
                            showToast('AeroShield Waterproof 24L added to Bag');
                          }}
                          className="w-full py-3.5 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-colors text-xs font-sans uppercase tracking-widest font-semibold flex items-center justify-center gap-2 rounded-lg"
                        >
                          <span>Add to Bag</span>
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </article>

                  {/* LOWER TWO CARDS: Clean 2-column equal-width grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    {/* CARD 2: NORDIC MINIMALIST ROLL-TOP */}
                    <article className="bg-white rounded-xl overflow-hidden border border-[#c4c7c7]/60 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between">
                      <div className="flex flex-col">
                        {/* Uniform Image Wrapper */}
                        <div className="relative overflow-hidden bg-[#e4e2dd] aspect-[4/3] w-full">
                          <img
                            alt="Nordic Minimalist Roll-top 22L"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                            src={SEARCH_IMAGES.rolltop}
                          />
                          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-[#1b1c18] px-3 py-1 rounded-full text-[10px] font-sans font-semibold tracking-wider">
                            LIGHTWEIGHT PICK
                          </div>
                          <button
                            type="button"
                            aria-label="Save to Wishlist"
                            onClick={() => toggleWishlist('prod_002')}
                            className={`absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm ${
                              wishlist['prod_002'] ? 'text-rose-600' : 'text-[#1b1c18]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {wishlist['prod_002'] ? 'favorite' : 'favorite_border'}
                            </span>
                          </button>
                        </div>

                        {/* Product Info */}
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs uppercase tracking-widest text-[#444748]">
                              22L VOLUME
                            </span>
                            <span className="font-sans text-[11px] text-[#4b6700] font-bold uppercase tracking-wider">POPULAR</span>
                          </div>
                          <h3 className="font-sans text-xl font-bold text-[#1b1c18] mb-2 group-hover:text-[#4b6700] transition-colors">
                            Nordic Minimalist Roll-top 22L
                          </h3>
                          <p className="font-body text-xs text-[#444748] line-clamp-2 leading-relaxed mb-4">
                            Deep charcoal matte canvas with anodized aluminum G-hook clasp, zero exterior bulk, tailored for campus sprints.
                          </p>
                          <div className="font-mono text-xs text-[#444748] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4b6700]"></span>
                            <span>In Stock · 2-Day Delivery</span>
                          </div>
                        </div>
                      </div>

                      {/* Price & Bottom Action */}
                      <div className="p-6 pt-0">
                        <div className="flex items-center justify-between pt-4 border-t border-[#f0eee8]">
                          <span className="font-sans text-2xl font-bold text-[#1b1c18]">₹2,299</span>
                          <button
                            type="button"
                            onClick={() => {
                              addToCart({
                                id: 'prod_002',
                                title: 'Nordic Minimalist Roll-top 22L',
                                price_paise: 229900,
                                stock: 14,
                              });
                              showToast('Nordic Minimalist Roll-top added to Bag');
                            }}
                            className="px-5 py-2.5 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-colors text-xs font-sans uppercase tracking-wider rounded-lg font-semibold"
                          >
                            Add to Bag →
                          </button>
                        </div>
                      </div>
                    </article>

                    {/* CARD 3: AEROSLING TECH COURIER */}
                    <article className="bg-white rounded-xl overflow-hidden border border-[#c4c7c7]/60 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between">
                      <div className="flex flex-col">
                        {/* Uniform Image Wrapper */}
                        <div className="relative overflow-hidden bg-[#e4e2dd] aspect-[4/3] w-full">
                          <img
                            alt="AeroSling Ergonomic Tech Courier 14L"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                            src={SEARCH_IMAGES.courier}
                          />
                          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-[#1b1c18] px-3 py-1 rounded-full text-[10px] font-sans font-semibold tracking-wider">
                            COMPACT ALTERNATIVE
                          </div>
                          <button
                            type="button"
                            aria-label="Save to Wishlist"
                            onClick={() => toggleWishlist('prod_003')}
                            className={`absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm ${
                              wishlist['prod_003'] ? 'text-rose-600' : 'text-[#1b1c18]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {wishlist['prod_003'] ? 'favorite' : 'favorite_border'}
                            </span>
                          </button>
                        </div>

                        {/* Product Info */}
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs uppercase tracking-widest text-[#444748]">
                              14L VOLUME
                            </span>
                            <span className="font-sans text-[11px] text-[#4b6700] font-bold uppercase tracking-wider">RECOMMENDED</span>
                          </div>
                          <h3 className="font-sans text-xl font-bold text-[#1b1c18] mb-2 group-hover:text-[#4b6700] transition-colors">
                            AeroSling Ergonomic Tech Courier 14L
                          </h3>
                          <p className="font-body text-xs text-[#444748] line-clamp-2 leading-relaxed mb-4">
                            Crossbody weatherproof messenger engineered for agile commutes with dedicated padded tablet &amp; notebook sleeve.
                          </p>
                          <div className="font-mono text-xs text-[#444748] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4b6700]"></span>
                            <span>In Stock · Ships today</span>
                          </div>
                        </div>
                      </div>

                      {/* Price & Bottom Action */}
                      <div className="p-6 pt-0">
                        <div className="flex items-center justify-between pt-4 border-t border-[#f0eee8]">
                          <span className="font-sans text-2xl font-bold text-[#1b1c18]">₹1,850</span>
                          <button
                            type="button"
                            onClick={() => {
                              addToCart({
                                id: 'prod_003',
                                title: 'AeroSling Ergonomic Tech Courier 14L',
                                price_paise: 185000,
                                stock: 5,
                              });
                              showToast('AeroSling Tech Courier added to Bag');
                            }}
                            className="px-5 py-2.5 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-colors text-xs font-sans uppercase tracking-wider rounded-lg font-semibold"
                          >
                            Add to Bag →
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>

                  {/* Intent Deepening Prompt Banner */}
                  <div className="w-full bg-[#f0eee8] p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#c4c7c7]/40">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-[#c4c7c7]/50">
                        <span className="material-symbols-outlined text-[#4b6700] text-[22px]">auto_awesome</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-sans block text-[#1b1c18] uppercase font-bold">
                          WANT TO EXPAND THIS QUERY?
                        </span>
                        <span className="font-body text-xs text-[#444748]">
                          Try asking: “Include side hydration pockets” or “Must fit a 17-inch workstation”
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeepenPrompt}
                      className="px-5 py-2.5 bg-white text-[#1b1c18] hover:bg-[#eae8e2] transition-colors text-xs font-sans uppercase rounded-lg border border-[#747878] shrink-0 font-semibold"
                    >
                      Refine Intent
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
