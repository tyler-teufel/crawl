'use client'

import { useEffect, useState } from 'react'
import { AppStoreButton } from '@/components/ui/AppStoreButton'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-crawl-bg/80 backdrop-blur-xl border-b border-crawl-surface'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group" aria-label="Crawl home">
          <div className="w-8 h-8 rounded-xl bg-crawl-purple flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span className="text-white font-bold text-lg tracking-tight group-hover:text-crawl-purple-light transition-colors">
            crawl
          </span>
        </a>

        {/* CTA */}
        <AppStoreButton size="sm" />
      </div>
    </header>
  )
}
