'use client'

import { motion } from 'framer-motion'
import { AppStoreButton } from '@/components/ui/AppStoreButton'

export function DownloadCTA() {
  return (
    <section className="py-28 px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-crawl-purple/5 to-transparent" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-crawl-purple/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          {/* App icon */}
          <div className="w-20 h-20 rounded-[22px] bg-crawl-purple flex items-center justify-center mx-auto mb-8 shadow-[0_0_60px_rgba(127,19,236,0.4)]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 leading-tight">
            The night is better
            <br />
            <span className="bg-gradient-to-r from-crawl-purple to-crawl-purple-light bg-clip-text text-transparent">
              with Crawl.
            </span>
          </h2>

          <p className="text-crawl-text-muted text-lg lg:text-xl mb-10 max-w-lg mx-auto leading-relaxed">
            Free to download. Free to vote. Know where to go before everyone else does.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <AppStoreButton size="lg" />
            <span className="text-crawl-text-muted text-sm">Android coming soon</span>
          </div>

          {/* Tagline */}
          <p className="mt-12 text-crawl-surface text-sm font-medium tracking-widest uppercase">
            Where is everyone going tonight?
          </p>
        </motion.div>
      </div>
    </section>
  )
}
