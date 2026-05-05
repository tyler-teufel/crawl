'use client'

import { motion } from 'framer-motion'

export function PhoneMockup() {
  // Circle with r=16, circumference ≈ 100.5
  const circ = 100.5
  const score94Offset = circ * (1 - 0.94) // ~6
  const score88Offset = circ * (1 - 0.88) // ~12

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow */}
      <div className="absolute w-[320px] h-[620px] rounded-[48px] bg-crawl-purple/10 blur-[60px] animate-glow" />

      {/* Phone frame */}
      <motion.div
        className="relative w-[280px] h-[580px] rounded-[44px] border-2 border-crawl-surface bg-crawl-bg overflow-hidden shadow-2xl"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Status bar notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl z-10" />

        {/* Screen */}
        <div className="absolute inset-0 bg-crawl-bg flex flex-col px-4 pt-10 pb-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 mt-2">
            <span className="text-white font-bold text-xl tracking-tight">crawl</span>
            <div className="bg-crawl-purple/20 border border-crawl-purple/40 rounded-full px-3 py-1">
              <span className="text-crawl-purple-light text-xs font-medium">Austin</span>
            </div>
          </div>

          {/* Search bar */}
          <div className="bg-crawl-surface rounded-full px-4 py-2.5 mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <span className="text-crawl-text-muted text-xs">Search venues...</span>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 mb-4 overflow-hidden">
            <div className="bg-crawl-purple/20 border border-crawl-purple/50 rounded-full px-3 py-1 flex-shrink-0">
              <span className="text-crawl-purple-light text-xs font-medium">Trending</span>
            </div>
            <div className="bg-crawl-surface rounded-full px-3 py-1 flex-shrink-0">
              <span className="text-crawl-text-muted text-xs">Live Music</span>
            </div>
            <div className="bg-crawl-surface rounded-full px-3 py-1 flex-shrink-0">
              <span className="text-crawl-text-muted text-xs">Rooftop</span>
            </div>
          </div>

          {/* Venue card 1 — Midnight Cowboy */}
          <div className="bg-crawl-card rounded-2xl p-4 mb-3 border border-crawl-surface">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 pr-2">
                <p className="text-white font-semibold text-sm leading-tight">Midnight Cowboy</p>
                <p className="text-crawl-text-muted text-xs mt-0.5">Speakeasy · 0.2 mi</p>
              </div>
              {/* Hotspot score ring */}
              <div className="relative w-11 h-11 flex-shrink-0">
                <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#16162a" strokeWidth="3" />
                  <circle
                    cx="20" cy="20" r="16" fill="none"
                    stroke="#7f13ec" strokeWidth="3"
                    strokeDasharray={circ}
                    strokeDashoffset={score94Offset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">94</span>
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <span className="bg-crawl-purple/20 text-crawl-purple-light text-xs px-2 py-0.5 rounded-full font-medium">TRENDING</span>
              <span className="bg-crawl-surface text-crawl-text-muted text-xs px-2 py-0.5 rounded-full">Craft Cocktails</span>
            </div>
          </div>

          {/* Venue card 2 — Hotel Vegas */}
          <div className="bg-crawl-card rounded-2xl p-4 border border-crawl-surface">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 pr-2">
                <p className="text-white font-semibold text-sm leading-tight">Hotel Vegas</p>
                <p className="text-crawl-text-muted text-xs mt-0.5">Live Music · 0.5 mi</p>
              </div>
              <div className="relative w-11 h-11 flex-shrink-0">
                <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#16162a" strokeWidth="3" />
                  <circle
                    cx="20" cy="20" r="16" fill="none"
                    stroke="#7f13ec" strokeWidth="3"
                    strokeDasharray={circ}
                    strokeDashoffset={score88Offset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">88</span>
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <span className="bg-crawl-green/15 text-crawl-green text-xs px-2 py-0.5 rounded-full font-medium">OPEN</span>
              <span className="bg-crawl-surface text-crawl-text-muted text-xs px-2 py-0.5 rounded-full">Outdoor Stage</span>
            </div>
          </div>

          {/* Bottom votes bar */}
          <div className="mt-auto bg-crawl-surface rounded-2xl p-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#7f13ec" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <div>
              <p className="text-white text-xs font-semibold">3 votes remaining</p>
              <p className="text-crawl-text-muted text-xs">Resets at midnight</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
