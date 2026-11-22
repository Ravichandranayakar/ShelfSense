import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { startHybridVoiceSession } from '../utils/voiceTranscriber';
import { getProductImage } from '../App';
import { getApiUrl } from '../services/api';

const inr = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function cleanAiText(text) {
  if (!text) return '';
  // Strip emojis
  let s = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
  // Remove markdown bold / italic asterisks
  s = s.replace(/\*{1,3}/g, '');
  // Remove trailing or awkward ellipses
  s = s.replace(/\.\.\.+/g, '');
  // Clean whitespace
  return s.replace(/\s+/g, ' ').trim();
}

// Curated inspiration prompts across all diverse catalog categories (Shoes, Electronics, Bags, Apparel, Stationery, Accessories)
const INSPIRATION_PROMPTS = [
  { id: '1', label: 'All-weather running shoes under ₹3,000', query: 'All-weather running shoes under ₹3,000', category: 'shoes', icon: 'directions_run' },
  { id: '2', label: '65W GaN fast charger with USB-C', query: '65W GaN fast charger with dual port', category: 'electronics', icon: 'bolt' },
  { id: '3', label: 'Waterproof 14-inch laptop backpack under ₹2,500', query: 'Water-resistant laptop backpack 14 inch under ₹2,500', category: 'bags', icon: 'backpack' },
  { id: '4', label: 'Rechargeable dimmable LED desk lamp', query: 'Rechargeable desk lamp dimmable for study', category: 'electronics', icon: 'lightbulb' },
  { id: '5', label: 'Noise-canceling ANC earbuds for daily commute', query: 'Noise-canceling earbuds with long battery life', category: 'electronics', icon: 'headphones' },
  { id: '6', label: 'Insulated steel bottle 750ml', query: 'Insulated stainless steel bottle 750ml cold', category: 'accessories', icon: 'water_drop' },
  { id: '7', label: 'Lightweight packable rain jacket for monsoon', query: 'Lightweight rain jacket with hood waterproof', category: 'apparel', icon: 'rainy' },
  { id: '8', label: 'Solid bamboo desk organizer with phone stand', query: 'Desk organizer bamboo with phone stand', category: 'stationery', icon: 'drawers' },
];

export default function SearchResultsView({
  initialQuery = '',
  searchResult = null,
  allProducts = [],
  productImages = {},
  onSearch,
  isLoading = false,
  addToCart,
  toggleWishlist,
  wishlist = {},
  showToast,
  onOpenDemandRequest,
  onBackToHome,
  onOpenVoice,
}) {
  const [queryInput, setQueryInput] = useState(initialQuery || '');

  useEffect(() => {
    setQueryInput(initialQuery || '');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [initialQuery]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [priceBracket, setPriceBracket] = useState('all'); // 'all' | 'under1000' | '1000-2500' | 'above2500'
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sortBy, setSortBy] = useState('relevance'); // 'relevance' | 'price-asc' | 'price-desc' | 'stock'
  const [layoutView, setLayoutView] = useState('grid');
  const [removedChips, setRemovedChips] = useState([]);
  const [constraintModalOpen, setConstraintModalOpen] = useState(false);
  const [customConstraint, setCustomConstraint] = useState('');

  // Demand signal submission state (for 0-result gap & sourcing modal)
  const [demandQuery, setDemandQuery] = useState('');
  const [demandCategory, setDemandCategory] = useState('shoes');
  const [demandBudget, setDemandBudget] = useState('2500');
  const [demandSubmitting, setDemandSubmitting] = useState(false);
  const [demandSuccess, setDemandSuccess] = useState(false);
  const [isSourcingModalOpen, setIsSourcingModalOpen] = useState(false);
  const [sourcingTicketId, setSourcingTicketId] = useState('');
  const [sourcingSubmittedData, setSourcingSubmittedData] = useState(null);

  const [isTtsPlaying, setIsTtsPlaying] = useState(false);

  // Dual-Engine (Hybrid) Speech Recognition inside Intent Search Bar
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
        setQueryInput(text.trim());
        onSearch?.(text.trim());
      }
    } else {
      setIsVoiceListening(false);
      setIsSpeaking(false);
    }
  }, [onSearch]);

  const toggleVoiceInput = useCallback(async () => {
    if (isVoiceListening) {
      await stopVoiceListening();
      return;
    }

    try {
      setIsVoiceListening(true);
      setIsSpeaking(false);

      const session = await startHybridVoiceSession({
        language: 'en-IN',
        onTranscript: (liveWords) => {
          setQueryInput(liveWords);
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
            showToast?.('Microphone sound is silent (0%). Check that your mic is unmuted in Windows Sound Settings.');
          }
        },
      });

      voiceSessionRef.current = session;
    } catch (err) {
      setIsVoiceListening(false);
      setIsSpeaking(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showToast?.('Microphone access blocked. Click the lock/settings icon in your browser URL bar to Allow.');
      } else {
        showToast?.('Could not access microphone: ' + (err.message || 'Check audio devices'));
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

  const toggleSpeechPlayback = () => {
    if (!('speechSynthesis' in window)) {
      showToast?.('Speech synthesis is not supported in this browser.');
      return;
    }

    if (isTtsPlaying) {
      window.speechSynthesis.cancel();
      setIsTtsPlaying(false);
      return;
    }

    const textToSpeak = cleanAiText(searchResult?.reply || '');
    if (!textToSpeak) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-IN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsTtsPlaying(true);
    utterance.onend = () => setIsTtsPlaying(false);
    utterance.onerror = () => setIsTtsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  // Sync query input when initialQuery changes from outside
  useEffect(() => {
    if (initialQuery !== undefined) {
      setQueryInput(initialQuery);
    }
  }, [initialQuery]);

  // Determine if we are in "Before Search" (empty/landing) or "After Search" (results)
  const isLandingState = !searchResult && !queryInput.trim();

  // Dynamic Intent Chips derived from backend filters and query
  const intentChips = useMemo(() => {
    if (!searchResult) return [];
    const chips = [];
    const filters = searchResult.filters || {};

    if (filters.category && !removedChips.includes('category')) {
      chips.push({ id: 'category', label: `Category: ${filters.category.charAt(0).toUpperCase() + filters.category.slice(1)}` });
    }
    if (filters.max_price_paise && !removedChips.includes('price')) {
      chips.push({ id: 'price', label: `Max Budget: ${inr(filters.max_price_paise)}` });
    }
    if (filters.required_attributes) {
      if (filters.required_attributes.water_resistant && !removedChips.includes('water')) {
        chips.push({ id: 'water', label: 'Water-resistant (IPX4+)' });
      }
      if (filters.required_attributes.laptop_size_inches && !removedChips.includes('laptop')) {
        chips.push({ id: 'laptop', label: `${filters.required_attributes.laptop_size_inches}" Laptop Sleeve` });
      }
      if (filters.required_attributes.color && !removedChips.includes('color')) {
        chips.push({ id: 'color', label: `Color: ${filters.required_attributes.color}` });
      }
    }
    if (filters.query && !removedChips.includes('keyword')) {
      chips.push({ id: 'keyword', label: `Target: "${filters.query}"` });
    }
    return chips;
  }, [searchResult, removedChips]);

  const removeChip = (id) => {
    setRemovedChips((prev) => [...prev, id]);
    showToast('Filter constraint relaxed');
  };

  const handleOpenConstraintModal = () => {
    setCustomConstraint('');
    setConstraintModalOpen(true);
  };

  const handleApplyConstraint = (presetText) => {
    const textToApply = (presetText || customConstraint).trim();
    if (!textToApply) return;
    const refined = queryInput.trim() ? `${queryInput.trim()}, ${textToApply}` : textToApply;
    setQueryInput(refined);
    setConstraintModalOpen(false);
    setCustomConstraint('');
    showToast(`Added constraint: "${textToApply}"`);
    if (onSearch) {
      onSearch(refined);
    }
  };

  const handleSubmitSearch = (e) => {
    e?.preventDefault();
    if (!queryInput.trim() || isLoading) return;
    setRemovedChips([]);
    setDemandSuccess(false);
    if (onSearch) {
      onSearch(queryInput.trim());
    }
  };

  const handlePromptClick = (prompt) => {
    setQueryInput(prompt.query);
    setRemovedChips([]);
    setDemandSuccess(false);
    if (onSearch) {
      onSearch(prompt.query);
    }
  };

  const resetAllFilters = () => {
    setActiveCategory('all');
    setPriceBracket('all');
    setInStockOnly(true);
    setSortBy('relevance');
    setRemovedChips([]);
    showToast('Filters reset to default');
  };

  // Filter and sort the products returned from search
  const rawProducts = searchResult?.products || [];

  // Available categories in the search results
  const resultCategories = useMemo(() => {
    const cats = [...new Set(rawProducts.map((p) => p.category))].filter(Boolean);
    return ['all', ...cats];
  }, [rawProducts]);

  const displayedProducts = useMemo(() => {
    let list = [...rawProducts];

    // Category filter
    if (activeCategory !== 'all') {
      list = list.filter((p) => p.category.toLowerCase() === activeCategory.toLowerCase());
    }

    // Price bracket filter
    if (priceBracket === 'under1000') {
      list = list.filter((p) => p.price_paise < 100000);
    } else if (priceBracket === '1000-2500') {
      list = list.filter((p) => p.price_paise >= 100000 && p.price_paise <= 250000);
    } else if (priceBracket === 'above2500') {
      list = list.filter((p) => p.price_paise > 250000);
    }

    // Stock filter
    if (inStockOnly) {
      list = list.filter((p) => p.stock > 0);
    }

    // Sorting
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price_paise - b.price_paise);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price_paise - a.price_paise);
    } else if (sortBy === 'stock') {
      list.sort((a, b) => b.stock - a.stock);
    }

    return list;
  }, [rawProducts, activeCategory, priceBracket, inStockOnly, sortBy]);

  // Featured multi-category catalog items for initial landing state (one from each distinct category)
  const landingShowcaseProducts = useMemo(() => {
    if (!allProducts || allProducts.length === 0) return [];
    const chosenCategories = new Set();
    const showcase = [];
    // Prioritize diverse categories: shoes, electronics, apparel, accessories, stationery, bags
    const priorityIds = ['prod_006', 'prod_013', 'prod_009', 'prod_011', 'prod_018', 'prod_001'];
    for (const pid of priorityIds) {
      const p = allProducts.find((item) => item.id === pid);
      if (p) showcase.push(p);
    }
    // Fill remaining if needed
    for (const p of allProducts) {
      if (showcase.length >= 6) break;
      if (!chosenCategories.has(p.category) && !showcase.some((item) => item.id === p.id)) {
        chosenCategories.add(p.category);
        showcase.push(p);
      }
    }
    return showcase;
  }, [allProducts]);

  // Open the custom sourcing popup pre-filled with the shopper's current intent
  const handleOpenSourcingModal = () => {
    const rawQ = queryInput.trim();
    setDemandQuery(rawQ);
    if (searchResult?.filters?.max_price_paise) {
      setDemandBudget(String(Math.round(searchResult.filters.max_price_paise / 100)));
    } else {
      setDemandBudget('2500');
    }
    if (searchResult?.filters?.category) {
      setDemandCategory(searchResult.filters.category);
    }
    setDemandSuccess(false);
    setIsSourcingModalOpen(true);
  };

  // Handle direct demand radar gap submission
  const handleDemandSubmit = async (e) => {
    e?.preventDefault();
    const query = demandQuery.trim() || queryInput.trim();
    if (!query || demandSubmitting) return;
    setDemandSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/demand/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          category: demandCategory || null,
          max_budget_paise: demandBudget ? Number(demandBudget) * 100 : null,
        }),
      });
      if (!res.ok) throw new Error('Submission failed');
      const ticket = Math.floor(100000 + Math.random() * 900000);
      setSourcingTicketId(String(ticket));
      setSourcingSubmittedData({
        query,
        category: demandCategory,
        budget: demandBudget,
      });
      setDemandSuccess(true);
      showToast(`Custom sourcing request #RADAR-${ticket} logged!`);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setDemandSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-[#fbf9f3] text-[#1b1c18] min-h-screen">
      {/* 1. TOP EDITORIAL TICKER & NAVIGATION */}
      <section className="w-full bg-[#eae8e2] text-[#1b1c18] border-b border-[#e4e2dd] px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px] font-sans font-bold uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="flex items-center gap-1.5 text-[#1b1c18] hover:text-[#4b6700] transition-colors py-0.5 px-2 rounded bg-white/70 border border-[#c4c7c7]/50"
            >
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              <span>Back to Store</span>
            </button>
            <span className="text-[#c4c7c7]">/</span>
            <span className="w-2 h-2 rounded-full bg-[#4b6700] animate-pulse"></span>
            <span className="font-semibold tracking-wider text-[#1b1c18]">
              {isLandingState ? 'AI Intent Discovery Studio' : `Results for: “${queryInput}”`}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[#444748]">
            <span className="font-mono text-xs font-semibold text-[#1b1c18]">
              {isLandingState
                ? '25 VERIFIED PRODUCTS ACROSS 6 CATEGORIES'
                : `${displayedProducts.length} PRODUCTS MATCHED IN LIVE INVENTORY`}
            </span>
            <button
              type="button"
              onClick={handleOpenSourcingModal}
              className="hidden sm:flex items-center gap-1.5 text-[11px] font-sans font-bold uppercase tracking-wider text-[#4b6700] hover:text-black transition-colors py-0.5 px-2.5 rounded bg-white/70 border border-[#c4c7c7]/50"
            >
              <span className="material-symbols-outlined text-[14px]">edit_note</span>
              <span>Custom Sourcing</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. NATURAL INTENT INPUT BAR */}
      <section className="w-full px-6 lg:px-8 pt-8 pb-8 bg-[#fbf9f3]">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <div className="bg-white p-5 sm:p-6 shadow-sm rounded-xl border border-[#c4c7c7]/50">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="intent-search-box" className="text-[11px] font-sans uppercase text-[#444748] tracking-widest font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#4b6700]">search</span>
                <span>Natural Language Intent Search</span>
              </label>
              <span className="font-mono text-[10px] text-[#444748] uppercase tracking-wider">
                Live Inventory · Instant Dispatch
              </span>
            </div>
            <form onSubmit={handleSubmitSearch} className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              <div className="relative flex-1 flex items-center">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#444748] text-[22px]">
                  neurology
                </span>
                <input
                  id="intent-search-box"
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  className={`w-full pl-12 pr-20 py-3.5 font-sans text-[15px] sm:text-[16px] border transition-colors focus:outline-none rounded-lg font-medium ${
                    isVoiceListening
                      ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-400/40 text-rose-950 placeholder:text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.12)]'
                      : 'bg-[#f5f3ed] text-[#1b1c18] border-[#c4c7c7]/60 focus:border-black focus:bg-white'
                  }`}
                  placeholder={isVoiceListening ? "Listening... speak now" : "Describe what you need in plain English (e.g. 'running shoes for rain under ₹3,000', '65W charger', 'minimal desk lamp')..."}
                />
                {/* Clear Input Button */}
                {queryInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQueryInput('');
                      document.getElementById('intent-search-box')?.focus();
                    }}
                    title="Clear search query"
                    className="absolute right-12 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#444748] hover:text-black hover:bg-[#eae8e2] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                ) : null}
                {/* Streaming Microphone Button (Whisper graphic_eq icon moves when speaking) */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  title={isVoiceListening ? "Stop listening & search" : "Speak to search"}
                  className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isVoiceListening
                      ? `bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-sm ring-2 ring-rose-300 ${isSpeaking ? 'animate-pulse scale-105' : ''}`
                      : 'text-[#444748] hover:text-black hover:bg-[#eae8e2]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isVoiceListening ? 'graphic_eq' : 'mic'}
                  </span>
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoading || !queryInput.trim()}
                className="px-8 py-3.5 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-colors text-xs font-sans uppercase tracking-widest font-semibold flex items-center justify-center gap-2 rounded-lg shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Decoding Intent...</span>
                  </>
                ) : (
                  <>
                    <span>Discover Intent</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STATE A: BEFORE AI SEARCH (LANDING & INSPIRATION STATE)       */}
          {/* ───────────────────────────────────────────────────────────── */}
          {isLandingState && (
            <div className="flex flex-col gap-10 pt-2 animate-in fade-in duration-300">
              {/* Quick Inspiration Prompt Starters */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-sans uppercase tracking-wider text-[#1b1c18] font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[#4b6700]">explore</span>
                    <span>One-Click Intent Starters (Across All Categories)</span>
                  </span>
                  <span className="font-mono text-xs text-[#444748]">Click any prompt to search instantly</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {INSPIRATION_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.id}
                      type="button"
                      onClick={() => handlePromptClick(prompt)}
                      className="p-3.5 bg-white hover:bg-[#f0eee8] border border-[#c4c7c7]/50 rounded-xl text-left transition-all hover:border-black hover:shadow-sm group flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="material-symbols-outlined text-[18px] text-[#4b6700] group-hover:scale-110 transition-transform">
                          {prompt.icon}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#f0eee8] text-[#444748] font-bold">
                          {prompt.category}
                        </span>
                      </div>
                      <p className="font-sans text-xs font-semibold text-[#1b1c18] group-hover:text-[#4b6700] leading-snug">
                        "{prompt.label}"
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Multi-Category Catalog Spotlight (Shows that catalog includes Shoes, Electronics, etc.) */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#e4e2dd]">
                  <div>
                    <h3 className="font-sans text-lg font-bold text-[#1b1c18] uppercase tracking-tight">
                      Explore Full Catalog Scope
                    </h3>
                    <p className="font-body text-xs text-[#444748]">
                      Our catalog spans Shoes, Electronics, Apparel, Everyday Carry, Stationery, and Travel Gear.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#4b6700] font-semibold">100% In-Stock</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {landingShowcaseProducts.map((prod) => {
                    const img = productImages[prod.id] || getProductImage(prod);
                    return (
                      <div
                        key={prod.id}
                        className="bg-white rounded-xl overflow-hidden border border-[#c4c7c7]/60 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
                      >
                        <div className="flex flex-col">
                          <div className="relative aspect-[4/3] bg-[#e4e2dd] overflow-hidden">
                            {img ? (
                              <img
                                src={img}
                                alt={prod.title}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80';
                                }}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#444748]/50">
                                <span className="material-symbols-outlined text-4xl">inventory_2</span>
                              </div>
                            )}
                            <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm text-[#c6f26a] px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-wider font-bold">
                              {prod.category}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleWishlist(prod.id)}
                              className={`absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm ${wishlist[prod.id] ? 'text-rose-600' : 'text-[#1b1c18]'
                                }`}
                            >
                              <span
                                className={`material-symbols-outlined text-[16px] ${wishlist[prod.id] ? 'material-symbols-filled text-rose-600' : ''
                                  }`}
                                style={wishlist[prod.id] ? { fontVariationSettings: "'FILL' 1" } : undefined}
                              >
                                {wishlist[prod.id] ? 'favorite' : 'favorite_border'}
                              </span>
                            </button>
                          </div>
                          <div className="p-5">
                            <span className="font-mono text-[10px] uppercase text-[#444748] tracking-widest block mb-1">
                              {prod.sku}
                            </span>
                            <h4 className="font-sans text-base font-bold text-[#1b1c18] group-hover:text-[#4b6700] transition-colors leading-snug mb-2 line-clamp-2 min-h-[2.5rem]">
                              {prod.title}
                            </h4>
                            <p className="font-body text-xs text-[#444748] line-clamp-2 leading-relaxed mb-3">
                              {prod.description}
                            </p>
                          </div>
                        </div>
                        <div className="p-5 pt-0">
                          <div className="flex items-center justify-between pt-3 border-t border-[#f0eee8]">
                            <span className="font-sans text-lg font-bold text-[#1b1c18]">
                              {inr(prod.price_paise)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                addToCart(prod);
                                showToast(`Added ${prod.title} to cart`);
                              }}
                              className="px-4 py-2 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-colors text-xs font-sans uppercase tracking-wider rounded-lg font-semibold flex items-center gap-1.5"
                            >
                              <span>Add to Cart</span>
                              <span className="material-symbols-outlined text-[14px]">add</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* How Intent Commerce Works (3 Cards) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-[#e4e2dd]">
                <div className="bg-[#f0eee8] p-5 rounded-xl border border-[#c4c7c7]/40 flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-wider text-[#1b1c18]">
                    <span className="material-symbols-outlined text-[#4b6700] text-[18px]">record_voice_over</span>
                    <span>1. Speak Naturally</span>
                  </div>
                  <p className="font-body text-xs text-[#444748] leading-relaxed">
                    Describe what you need, your daily use case, or price limits in simple everyday language.
                  </p>
                </div>
                <div className="bg-[#f0eee8] p-5 rounded-xl border border-[#c4c7c7]/40 flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-wider text-[#1b1c18]">
                    <span className="material-symbols-outlined text-[#4b6700] text-[18px]">tune</span>
                    <span>2. Smart Matching</span>
                  </div>
                  <p className="font-body text-xs text-[#444748] leading-relaxed">
                    Our AI automatically filters by price, size, materials, and features in real time.
                  </p>
                </div>
                <div className="bg-[#f0eee8] p-5 rounded-xl border border-[#c4c7c7]/40 flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-wider text-[#1b1c18]">
                    <span className="material-symbols-outlined text-[#4b6700] text-[18px]">verified</span>
                    <span>3. Real Stock Guaranteed</span>
                  </div>
                  <p className="font-body text-xs text-[#444748] leading-relaxed">
                    Every product shown is verified in our physical warehouse and ready for fast delivery.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* STATE B: AFTER AI SEARCH (ACTIVE INTENT RESULTS VIEW)         */}
          {/* ───────────────────────────────────────────────────────────── */}
          {!isLandingState && (
            <>
              {/* Clean AI Search Intent Highlight (Minimal & Elegant) */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-[#c4c7c7]/50 shadow-sm">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1b1c18] text-[#c6f26a] font-sans text-[11px] font-bold tracking-wider uppercase shadow-sm">
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    <span>AI Intent Verified</span>
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#1b1c18]">
                    {searchResult?.filters?.query ? `Target: “${cleanAiText(searchResult.filters.query)}”` : (queryInput ? `“${cleanAiText(queryInput)}”` : 'Live Inventory Query')}
                  </span>
                </div>
                {searchResult?.reply && (
                  <div className="flex items-center gap-2 text-xs font-body text-[#444748] min-w-0">
                    <span className="material-symbols-outlined text-[16px] text-[#4b6700] flex-shrink-0">psychology</span>
                    <span className="italic leading-relaxed break-words">
                      “{cleanAiText(searchResult.reply)}”
                    </span>
                    <button
                      type="button"
                      onClick={toggleSpeechPlayback}
                      title={isTtsPlaying ? "Stop speaking" : "Listen to AI voice answer"}
                      className={`p-1.5 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isTtsPlaying
                        ? 'bg-[#c6f26a] text-black shadow-sm ring-2 ring-[#c6f26a]/40 animate-pulse'
                        : 'text-[#444748] hover:text-black hover:bg-[#eae8e2]'
                        }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isTtsPlaying ? 'volume_off' : 'volume_up'}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Intent Chips Bar */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c6f26a] ring-4 ring-[#c6f26a]/20 animate-pulse"></span>
                  <span className="text-[11px] font-sans uppercase tracking-wider text-[#1b1c18] font-bold">
                    Active Intent Constraints
                  </span>
                </div>
                <span className="font-body text-xs text-[#444748]">
                  {displayedProducts.length > 0 ? `${displayedProducts.length} items match verified inventory` : '0 items match current filters'}
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

                <button
                  type="button"
                  onClick={handleOpenConstraintModal}
                  className="flex items-center gap-1.5 bg-white hover:bg-[#eae8e2] border border-dashed border-[#747878] px-3.5 py-1.5 rounded-full text-[#1b1c18] font-mono text-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  <span>Add constraint</span>
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 3. MAIN RESULTS DISCOVERY: SIDEBAR + DYNAMIC PRODUCT GRID */}
      {!isLandingState && (
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
                {/* A. EXPANDABLE FILTER SIDEBAR (280px) */}
                <aside className="w-full lg:w-[280px] shrink-0 flex flex-col gap-6 bg-white p-6 rounded-xl border border-[#c4c7c7]/60 shadow-sm">
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

                  {/* Category Filter */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[#1b1c18] font-sans text-sm font-semibold">
                      <span>Category</span>
                      <span className="font-mono text-xs text-[#444748]">{resultCategories.length - 1}</span>
                    </div>
                    <div className="flex flex-col gap-2 pt-1 font-body text-xs">
                      {resultCategories.map((cat) => {
                        const count = cat === 'all'
                          ? rawProducts.length
                          : rawProducts.filter((p) => p.category.toLowerCase() === cat.toLowerCase()).length;
                        return (
                          <label key={cat} className="flex items-center justify-between cursor-pointer group">
                            <span className="flex items-center gap-2.5">
                              <input
                                type="radio"
                                name="categoryFilter"
                                checked={activeCategory === cat}
                                onChange={() => setActiveCategory(cat)}
                                className="text-black focus:ring-0 w-4 h-4 cursor-pointer"
                              />
                              <span className={`capitalize ${activeCategory === cat ? 'font-bold text-black' : 'group-hover:text-black'}`}>
                                {cat === 'all' ? 'All Matched Categories' : cat}
                              </span>
                            </span>
                            <span className="text-[#444748] font-mono text-[11px]">{count}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Price Bracket Filter */}
                  <div className="flex flex-col gap-3 pt-4 border-t border-[#f0eee8]">
                    <div className="flex items-center justify-between text-[#1b1c18] font-sans text-sm font-semibold">
                      <span>Price Bracket</span>
                      <span className="font-mono text-xs text-[#4b6700] font-semibold">INR (₹)</span>
                    </div>
                    <div className="flex flex-col gap-2 pt-1 font-body text-xs">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="priceBracket"
                            checked={priceBracket === 'all'}
                            onChange={() => setPriceBracket('all')}
                            className="text-black focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <span className={priceBracket === 'all' ? 'font-bold text-black' : 'group-hover:text-black'}>Any Price</span>
                        </span>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="priceBracket"
                            checked={priceBracket === 'under1000'}
                            onChange={() => setPriceBracket('under1000')}
                            className="text-black focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <span className={priceBracket === 'under1000' ? 'font-bold text-black' : 'group-hover:text-black'}>Under ₹1,000</span>
                        </span>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="priceBracket"
                            checked={priceBracket === '1000-2500'}
                            onChange={() => setPriceBracket('1000-2500')}
                            className="text-black focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <span className={priceBracket === '1000-2500' ? 'font-bold text-black' : 'group-hover:text-black'}>₹1,000 – ₹2,500</span>
                        </span>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="priceBracket"
                            checked={priceBracket === 'above2500'}
                            onChange={() => setPriceBracket('above2500')}
                            className="text-black focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <span className={priceBracket === 'above2500' ? 'font-bold text-black' : 'group-hover:text-black'}>Above ₹2,500</span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Stock Availability */}
                  <div className="flex flex-col gap-3 pt-4 border-t border-[#f0eee8]">
                    <div className="flex items-center justify-between text-[#1b1c18] font-sans text-sm font-semibold">
                      <span>Availability</span>
                      <span className="font-mono text-xs text-[#444748]">Dispatch</span>
                    </div>
                    <label className="flex items-center justify-between cursor-pointer group font-body text-xs">
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={inStockOnly}
                          onChange={(e) => setInStockOnly(e.target.checked)}
                          className="rounded border-[#747878] text-black focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="group-hover:text-black font-medium">In Stock Only</span>
                      </span>
                    </label>
                  </div>

                  {/* Guarantee Card */}
                  <div className="bg-[#f0eee8] p-4 rounded-lg text-xs text-[#444748] mt-2 border border-[#c4c7c7]/30">
                    <div className="flex items-center gap-2 text-[#1b1c18] font-semibold mb-1">
                      <span className="material-symbols-outlined text-[16px] text-[#4b6700]">verified</span>
                      <span>Verified Stock Guarantee</span>
                    </div>
                    All items are verified against our live warehouse inventory with guaranteed availability.
                  </div>
                </aside>

                {/* B. DYNAMIC PRODUCT RESULTS GRID */}
                <div className="flex-1 min-w-0 flex flex-col gap-6">
                  {/* Top Bar: Counter, Sorting, Layout Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#c4c7c7]/50 shadow-sm">
                    <div className="flex items-baseline gap-3">
                      <span className="font-sans text-xl uppercase tracking-tight text-[#1b1c18] font-bold">
                        Curated Products
                      </span>
                      <span className="font-mono text-xs text-[#444748]">({displayedProducts.length})</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-sans text-[#444748] whitespace-nowrap font-bold">SORT BY:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="bg-[#f0eee8] text-[#1b1c18] font-mono text-xs py-1.5 px-3 rounded-lg border-none focus:ring-0 cursor-pointer"
                        >
                          <option value="relevance">Most Relevant</option>
                          <option value="price-asc">Price: Low to High</option>
                          <option value="price-desc">Price: High to Low</option>
                          <option value="stock">Stock Quantity</option>
                        </select>
                      </div>
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
                          title="List View"
                        >
                          <span className="material-symbols-outlined text-[18px]">view_agenda</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ───────────────────────────────────────────────────────── */}
                  {/* CASE 1: MATCHED PRODUCTS FOUND (REAL INVENTORY RENDER)    */}
                  {/* ───────────────────────────────────────────────────────── */}
                  {displayedProducts.length > 0 ? (
                    <div className="flex flex-col gap-6">
                      {/* CARD 1: HERO TOP MATCH CARD (50/50 Split) */}
                      {(() => {
                        const hero = displayedProducts[0];
                        const heroImg = productImages[hero.id] || getProductImage(hero);
                        const attrs = hero.attributes || {};
                        return (
                          <article className="bg-white rounded-xl overflow-hidden border border-[#c4c7c7]/60 shadow-sm hover:shadow-md transition-shadow group flex flex-col lg:flex-row items-stretch">
                            <div className="lg:w-1/2 relative bg-[#e4e2dd] min-h-[360px] lg:min-h-[420px] overflow-hidden flex items-center justify-center border-b lg:border-b-0 lg:border-r border-[#c4c7c7]/40">
                              {heroImg ? (
                                <img
                                  alt={hero.title}
                                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                                  src={heroImg}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[#444748]/50">
                                  <span className="material-symbols-outlined text-6xl">inventory_2</span>
                                </div>
                              )}
                              <div className="absolute top-4 left-4 bg-[#c6f26a] text-black px-3 py-1.5 rounded-full text-[10px] font-sans font-bold tracking-widest shadow-sm">
                                TOP MATCH
                              </div>
                              <button
                                type="button"
                                aria-label="Save to Wishlist"
                                onClick={() => toggleWishlist(hero.id)}
                                className={`absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm ${wishlist[hero.id] ? 'text-rose-600' : 'text-[#1b1c18]'
                                  }`}
                              >
                                <span
                                  className={`material-symbols-outlined text-[18px] ${wishlist[hero.id] ? 'material-symbols-filled text-rose-600' : ''
                                    }`}
                                  style={wishlist[hero.id] ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                >
                                  {wishlist[hero.id] ? 'favorite' : 'favorite_border'}
                                </span>
                              </button>
                            </div>

                            <div className="lg:w-1/2 p-6 sm:p-8 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between gap-4 mb-2">
                                  <span className="font-mono text-xs uppercase tracking-widest text-[#444748]">
                                    {hero.sku}
                                  </span>
                                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#f0eee8] text-[#4b6700] uppercase font-bold">
                                    {hero.category}
                                  </span>
                                </div>
                                <h3 className="font-sans text-2xl sm:text-3xl font-bold text-[#1b1c18] group-hover:text-[#4b6700] transition-colors mb-3 leading-tight">
                                  {hero.title}
                                </h3>
                                <p className="font-body text-sm text-[#444748] mb-6 leading-relaxed">
                                  {hero.description}
                                </p>

                                {/* Dynamic Technical Specs Matrix */}
                                <div className="bg-[#f0eee8] p-4 rounded-lg flex flex-col gap-2 mb-6 font-mono text-xs text-[#1b1c18] border border-[#c4c7c7]/30">
                                  {Object.entries(attrs).slice(0, 3).map(([key, val]) => (
                                    <div key={key} className="flex justify-between border-b border-[#c4c7c7]/30 pb-2 last:border-b-0 last:pb-0">
                                      <span className="text-[#444748] capitalize">{key.replace(/_/g, ' ')}</span>
                                      <span className="font-semibold">{String(val)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between pt-1">
                                    <span className="text-[#444748]">Warehouse Stock</span>
                                    <span className="font-semibold text-[#4b6700]">{hero.stock} units remaining</span>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-4 border-t border-[#f0eee8]">
                                <div className="flex items-baseline justify-between mb-4">
                                  <span className="font-sans text-3xl text-[#1b1c18] font-bold">
                                    {inr(hero.price_paise)}
                                  </span>
                                  <span className="text-[#4b6700] font-mono text-xs flex items-center gap-1.5 font-medium">
                                    <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                                    Ships in 24h
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    addToCart(hero);
                                    showToast(`Added ${hero.title} to cart`);
                                  }}
                                  className="w-full py-3.5 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-colors text-xs font-sans uppercase tracking-widest font-semibold flex items-center justify-center gap-2 rounded-lg"
                                >
                                  <span>Add to Cart</span>
                                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })()}

                      {/* CARDS 2+: REMAINING MATCHED PRODUCTS */}
                      {displayedProducts.length > 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                          {displayedProducts.slice(1).map((prod) => {
                            const img = productImages[prod.id] || getProductImage(prod);
                            return (
                              <article
                                key={prod.id}
                                className="bg-white rounded-xl overflow-hidden border border-[#c4c7c7]/60 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between"
                              >
                                <div className="flex flex-col">
                                  <div className="relative overflow-hidden bg-[#e4e2dd] aspect-[4/3] w-full">
                                    {img ? (
                                      <img
                                        alt={prod.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                                        src={img}
                                        onError={(e) => {
                                          e.currentTarget.onerror = null;
                                          e.currentTarget.src = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[#444748]/50">
                                        <span className="material-symbols-outlined text-5xl">inventory_2</span>
                                      </div>
                                    )}
                                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm text-[#1b1c18] px-3 py-1 rounded-full text-[10px] font-sans font-semibold tracking-wider uppercase">
                                      {prod.category}
                                    </div>
                                    <button
                                      type="button"
                                      aria-label="Save to Wishlist"
                                      onClick={() => toggleWishlist(prod.id)}
                                      className={`absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm ${wishlist[prod.id] ? 'text-rose-600' : 'text-[#1b1c18]'
                                        }`}
                                    >
                                      <span
                                        className={`material-symbols-outlined text-[18px] ${wishlist[prod.id] ? 'material-symbols-filled text-rose-600' : ''
                                          }`}
                                        style={wishlist[prod.id] ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                      >
                                        {wishlist[prod.id] ? 'favorite' : 'favorite_border'}
                                      </span>
                                    </button>
                                  </div>

                                  <div className="p-6">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-mono text-xs uppercase tracking-widest text-[#444748]">
                                        {prod.sku}
                                      </span>
                                      <span className="font-sans text-[11px] text-[#4b6700] font-bold uppercase tracking-wider">
                                        {prod.stock <= 5 ? `Only ${prod.stock} Left` : 'In Stock'}
                                      </span>
                                    </div>
                                    <h3 className="font-sans text-xl font-bold text-[#1b1c18] mb-2 group-hover:text-[#4b6700] transition-colors leading-tight">
                                      {prod.title}
                                    </h3>
                                    <p className="font-body text-xs text-[#444748] line-clamp-2 leading-relaxed mb-4">
                                      {prod.description}
                                    </p>
                                    <div className="font-mono text-xs text-[#444748] flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#4b6700]"></span>
                                      <span>Verified Warehouse Stock · Quick Delivery</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="p-6 pt-0">
                                  <div className="flex items-center justify-between pt-4 border-t border-[#f0eee8]">
                                    <span className="font-sans text-2xl font-bold text-[#1b1c18]">
                                      {inr(prod.price_paise)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        addToCart(prod);
                                        showToast(`Added ${prod.title} to cart`);
                                      }}
                                      className="px-5 py-2.5 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-colors text-xs font-sans uppercase tracking-wider rounded-lg font-semibold"
                                    >
                                      Add to Cart →
                                    </button>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ───────────────────────────────────────────────────────── */
                    /* CASE 2: CLEAN MINIMAL ZERO-RESULTS + DISCOVERY RECOVERY    */
                    /* ───────────────────────────────────────────────────────── */
                    <div className="flex flex-col gap-8 w-full">
                      {/* Minimal Zero-Results Card */}
                      <div className="bg-white rounded-2xl p-8 sm:p-10 border border-[#e4e2dd] shadow-sm flex flex-col items-center text-center gap-4 max-w-md mx-auto my-2 w-full">
                        <div className="w-12 h-12 rounded-full bg-[#f5f3ed] flex items-center justify-center text-[#747878]">
                          <span className="material-symbols-outlined text-[24px]">search_off</span>
                        </div>

                        <div className="space-y-1">
                          <h3 className="font-sans text-xl font-bold text-[#1b1c18]">
                            No products found
                          </h3>
                          <p className="font-body text-xs sm:text-sm text-[#747878] leading-relaxed">
                            {searchResult?.reply ? searchResult.reply.replace(/\[NO_MATCH\]/g, '').trim() : "We don't currently stock this item in our catalog."}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleOpenSourcingModal}
                          className="mt-1 px-6 py-3 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-all text-xs font-sans uppercase tracking-wider font-bold flex items-center gap-2 rounded-xl shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          <span>Request Custom Sourcing</span>
                        </button>
                      </div>

                      {/* Seamless Discovery Recovery: One-Click Intent Starters */}
                      <div className="flex flex-col gap-3 pt-4 border-t border-[#e4e2dd]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-sans uppercase tracking-wider text-[#1b1c18] font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-[#4b6700]">explore</span>
                            <span>Explore In-Stock Intent Starters</span>
                          </span>
                          <span className="font-mono text-xs text-[#444748]">Click any prompt to search</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {INSPIRATION_PROMPTS.map((prompt) => (
                            <button
                              key={prompt.id}
                              type="button"
                              onClick={() => handlePromptClick(prompt)}
                              className="p-3.5 bg-white hover:bg-[#f0eee8] border border-[#c4c7c7]/50 rounded-xl text-left transition-all hover:border-black hover:shadow-sm group flex flex-col justify-between gap-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="material-symbols-outlined text-[18px] text-[#4b6700] group-hover:scale-110 transition-transform">
                                  {prompt.icon}
                                </span>
                                <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded bg-[#f0eee8] text-[#444748] font-bold">
                                  {prompt.category}
                                </span>
                              </div>
                              <p className="font-sans text-xs font-semibold text-[#1b1c18] group-hover:text-[#4b6700] leading-snug">
                                "{prompt.label}"
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live Verified In-Stock Showcase Grid */}
                      <div className="flex flex-col gap-4 pt-2">
                        <div className="flex items-center justify-between pb-2 border-b border-[#e4e2dd]">
                          <div>
                            <h3 className="font-sans text-base sm:text-lg font-bold text-[#1b1c18] uppercase tracking-tight">
                              Explore Verified In-Stock Catalog
                            </h3>
                            <p className="font-body text-xs text-[#444748]">
                              Curated gear ready for immediate dispatch across all categories.
                            </p>
                          </div>
                          <span className="font-mono text-xs text-[#4b6700] font-semibold">100% In-Stock</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {landingShowcaseProducts.map((prod) => {
                            const img = productImages[prod.id];
                            return (
                              <div
                                key={prod.id}
                                className="bg-white rounded-xl overflow-hidden border border-[#c4c7c7]/50 shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between"
                              >
                                <div>
                                  <div className="relative aspect-[4/3] bg-[#e4e2dd] overflow-hidden">
                                    {img ? (
                                      <img
                                        alt={prod.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                                        src={img}
                                        onError={(e) => {
                                          e.currentTarget.onerror = null;
                                          e.currentTarget.src = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[#444748]/50">
                                        <span className="material-symbols-outlined text-4xl">inventory_2</span>
                                      </div>
                                    )}
                                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-[#1b1c18] px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold uppercase tracking-wider">
                                      {prod.category}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleWishlist(prod.id)}
                                      className={`absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-sm ${wishlist[prod.id] ? 'text-rose-600' : 'text-[#1b1c18]'
                                        }`}
                                    >
                                      <span
                                        className={`material-symbols-outlined text-[16px] ${wishlist[prod.id] ? 'material-symbols-filled text-rose-600' : ''
                                          }`}
                                        style={wishlist[prod.id] ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                      >
                                        {wishlist[prod.id] ? 'favorite' : 'favorite_border'}
                                      </span>
                                    </button>
                                  </div>
                                  <div className="p-5">
                                    <span className="font-mono text-[10px] uppercase text-[#444748] tracking-widest block mb-1">
                                      {prod.sku}
                                    </span>
                                    <h4 className="font-sans text-base font-bold text-[#1b1c18] group-hover:text-[#4b6700] transition-colors leading-snug mb-2 line-clamp-2 min-h-[2.5rem]">
                                      {prod.title}
                                    </h4>
                                    <p className="font-body text-xs text-[#444748] line-clamp-2 leading-relaxed mb-3">
                                      {prod.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="p-5 pt-0">
                                  <div className="flex items-center justify-between pt-3 border-t border-[#f0eee8]">
                                    <span className="font-sans text-lg font-bold text-[#1b1c18]">
                                      {inr(prod.price_paise)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        addToCart(prod);
                                        showToast(`Added ${prod.title} to cart`);
                                      }}
                                      className="px-4 py-2 bg-black text-white hover:bg-[#c6f26a] hover:text-black transition-colors text-xs font-sans uppercase tracking-wider rounded-lg font-semibold flex items-center gap-1.5"
                                    >
                                      <span>Add to Cart</span>
                                      <span className="material-symbols-outlined text-[14px]">add</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Intent Deepening Prompt Banner */}
                  <div className="w-full bg-[#f0eee8] p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#c4c7c7]/40 mt-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-[#c4c7c7]/50">
                        <span className="material-symbols-outlined text-[#4b6700] text-[22px]">auto_awesome</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-sans block text-[#1b1c18] uppercase font-bold">
                          WANT TO EXPAND OR REFINE THIS QUERY?
                        </span>
                        <span className="font-body text-xs text-[#444748]">
                          Try adding functional tags: “under ₹2,000”, “water-resistant”, “rechargeable”, or “lightweight”.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenConstraintModal}
                      className="px-5 py-2.5 bg-white text-[#1b1c18] hover:bg-[#eae8e2] transition-colors text-xs font-sans uppercase rounded-lg border border-[#747878] shrink-0 font-semibold"
                    >
                      Refine Intent
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. IN-APP WEBSITE DESIGN CONSTRAINT MODAL */}
      {constraintModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          {/* Backdrop Click to Close */}
          <div
            className="fixed inset-0"
            onClick={() => setConstraintModalOpen(false)}
          ></div>

          {/* Modal Card */}
          <div className="relative bg-white border border-[#c4c7c7]/70 rounded-2xl p-6 sm:p-8 shadow-2xl max-w-lg w-full z-10 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#4b6700] font-bold px-2.5 py-0.5 rounded-full bg-[#f0eee8] inline-block mb-1.5">
                  SEARCH PREFERENCES
                </span>
                <h3 className="font-sans text-xl font-bold text-[#1b1c18]">
                  Refine Search Filter
                </h3>
                <p className="font-body text-xs text-[#444748] mt-1">
                  Add budget limits, materials, size requirements, or colors to narrow down your results.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConstraintModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#f0eee8] hover:bg-[#eae8e2] text-[#444748] hover:text-black flex items-center justify-center transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApplyConstraint();
              }}
              className="flex flex-col gap-4"
            >
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#444748] text-[20px]">
                  tune
                </span>
                <input
                  type="text"
                  autoFocus
                  value={customConstraint}
                  onChange={(e) => setCustomConstraint(e.target.value)}
                  placeholder="e.g. Under ₹2,000, Water-resistant, USB-C, 15-inch sleeve..."
                  className="w-full pl-11 pr-4 py-3 bg-[#f5f3ed] text-[#1b1c18] font-sans text-sm border border-[#c4c7c7]/70 rounded-xl focus:border-black focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              {/* Quick Suggested Pills */}
              <div>
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#444748] block mb-2">
                  Quick Criteria Shortcuts:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Under ₹2,000',
                    'Water-resistant (IPX4+)',
                    'USB-C Fast Charging',
                    '14-inch Laptop Sleeve',
                    'Lightweight (< 1kg)',
                    'Monsoon Weatherproof',
                    'Solid Aluminum Build',
                    'Rechargeable Battery',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCustomConstraint(preset)}
                      className="px-2.5 py-1 rounded-full bg-[#f0eee8] hover:bg-[#c6f26a] hover:text-black text-[#1b1c18] font-mono text-[11px] border border-[#c4c7c7]/40 transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#f0eee8] mt-2">
                <button
                  type="button"
                  onClick={() => setConstraintModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg border border-[#c4c7c7] text-[#1b1c18] font-sans text-xs font-semibold hover:bg-[#f0eee8] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customConstraint.trim()}
                  className="px-6 py-2.5 rounded-lg bg-black text-white hover:bg-[#c6f26a] hover:text-black font-sans text-xs font-bold tracking-wider uppercase transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Apply Constraint</span>
                  <span className="material-symbols-outlined text-[16px]">check</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. CUSTOM SOURCING REQUEST MODAL (MERCHANT DEMAND RADAR) */}
      {isSourcingModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          {/* Backdrop Click to Close */}
          <div
            className="fixed inset-0"
            onClick={() => setIsSourcingModalOpen(false)}
          ></div>

          {/* Modal Container */}
          <div className="relative bg-[#fbf9f3] border border-[#c4c7c7]/80 rounded-2xl p-6 sm:p-8 shadow-2xl max-w-xl w-full z-10 animate-in zoom-in-95 duration-150 overflow-hidden">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsSourcingModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#f0eee8] hover:bg-[#eae8e2] text-[#444748] hover:text-black flex items-center justify-center transition-colors"
              aria-label="Close dialog"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {!demandSuccess ? (
              /* STATE A: THE SOURCING FORM */
              <div className="flex flex-col">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#c6f26a] text-black font-sans text-xs font-bold tracking-wider uppercase mb-4 self-start">
                  <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                  <span>CUSTOM SOURCING REQUEST</span>
                </div>

                <h2 className="font-sans text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#1b1c18] leading-tight">
                  Can’t find what <br />
                  you’re <span className="serif-italic font-normal lowercase tracking-normal">looking for?</span>
                </h2>

                <p className="font-body text-xs sm:text-sm text-[#444748] mt-2 mb-6 leading-relaxed">
                  Submit your specific requirements and budget constraints. Your request is logged into our Merchant Demand Radar so our partner network can source and stock the exact product you need.
                </p>

                <form onSubmit={handleDemandSubmit} className="space-y-4">
                  <div>
                    <label className="block font-sans text-xs uppercase tracking-wider font-bold text-[#1b1c18] mb-1.5">
                      PRODUCT DESCRIPTION &amp; REQUIREMENTS
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3.5 py-3 bg-white text-[#1b1c18] font-sans text-sm border border-[#c4c7c7]/80 rounded-xl focus:border-black focus:outline-none transition-colors"
                      placeholder="e.g. 15.6-inch waterproof commuter rolltop under ₹2,000"
                      value={demandQuery}
                      onChange={(e) => setDemandQuery(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-sans text-xs uppercase tracking-wider font-bold text-[#1b1c18] mb-1.5">
                        CATEGORY
                      </label>
                      <select
                        className="w-full px-3.5 py-3 bg-white text-[#1b1c18] font-sans text-sm border border-[#c4c7c7]/80 rounded-xl focus:border-black focus:outline-none transition-colors cursor-pointer capitalize"
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
                      <label className="block font-sans text-xs uppercase tracking-wider font-bold text-[#1b1c18] mb-1.5">
                        MAX BUDGET CEILING (₹)
                      </label>
                      <input
                        type="number"
                        min="100"
                        className="w-full px-3.5 py-3 bg-white text-[#1b1c18] font-sans text-sm border border-[#c4c7c7]/80 rounded-xl focus:border-black focus:outline-none transition-colors"
                        placeholder="2500"
                        value={demandBudget}
                        onChange={(e) => setDemandBudget(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="submit"
                      disabled={demandSubmitting || !demandQuery.trim()}
                      className="px-8 py-3.5 rounded-xl bg-[#c6f26a] text-black font-sans text-xs tracking-wider uppercase font-bold hover:bg-[#bbf055] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
                    >
                      <span>{demandSubmitting ? 'Logging to Radar…' : 'Submit Unmet Request'}</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                    <a
                      className="px-5 py-3.5 rounded-xl border border-[#c4c7c7] bg-[#f0eee8] hover:bg-white text-[#1b1c18] font-sans text-xs tracking-wider uppercase font-semibold text-center transition-colors"
                      href="#manifesto"
                      onClick={() => setIsSourcingModalOpen(false)}
                    >
                      Maker Standards Charter
                    </a>
                  </div>
                </form>

                <div className="mt-6 pt-4 border-t border-[#e4e2dd] flex items-center gap-2.5 text-xs font-sans text-[#747878]">
                  <span className="material-symbols-outlined text-[16px] text-[#4b6700]">verified_user</span>
                  <span>Over 1,240 custom requests successfully sourced and manufactured this season.</span>
                </div>
              </div>
            ) : (
              /* STATE B: BEAUTIFUL GREEN RESPONSE STATE */
              <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-700 flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[36px]">task_alt</span>
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">
                    <span>DEMAND SIGNAL LOGGED #RADAR-{sourcingTicketId}</span>
                  </div>
                  <h3 className="font-sans text-2xl font-bold uppercase tracking-tight text-emerald-950">
                    Request Logged to Demand Radar
                  </h3>
                  <p className="font-body text-xs sm:text-sm text-emerald-800 max-w-md leading-relaxed mt-1.5">
                    Your custom sourcing request has been captured in our Merchant Demand Radar. Our partner network reviews live signals to manufacture and procure requested inventory.
                  </p>
                </div>

                {/* Sourcing Summary Card */}
                <div className="w-full bg-white/90 p-4 rounded-xl border border-emerald-200 text-left font-mono text-xs text-[#1b1c18] space-y-2 shadow-sm">
                  <div className="flex justify-between border-b border-emerald-100 pb-1.5">
                    <span className="text-[#747878]">Requirement:</span>
                    <span className="font-semibold text-right max-w-[260px] truncate">{sourcingSubmittedData?.query || demandQuery}</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-100 pb-1.5">
                    <span className="text-[#747878]">Category:</span>
                    <span className="font-semibold capitalize">{sourcingSubmittedData?.category || demandCategory}</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-100 pb-1.5">
                    <span className="text-[#747878]">Budget Ceiling:</span>
                    <span className="font-semibold">₹{sourcingSubmittedData?.budget || demandBudget}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-[#747878]">Procurement SLA:</span>
                    <span className="font-semibold text-emerald-700">Reviewed within 24-48 hours</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSourcingModalOpen(false);
                      setDemandSuccess(false);
                    }}
                    className="px-6 py-3 rounded-xl bg-black text-white hover:bg-[#c6f26a] hover:text-black font-sans text-xs tracking-wider uppercase font-bold transition-all shadow-sm"
                  >
                    Continue Shopping
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDemandSuccess(false);
                      setDemandQuery('');
                    }}
                    className="px-5 py-3 rounded-xl border border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 font-sans text-xs tracking-wider uppercase font-semibold transition-colors"
                  >
                    Submit Another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
