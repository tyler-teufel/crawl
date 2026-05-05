'use client'

import { motion } from 'framer-motion'
import { AppStoreButton } from '@/components/ui/AppStoreButton'
import { PhoneMockup } from '@/components/ui/PhoneMockup'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] },
})

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-crawl-purple/8 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-crawl-purple/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center w-full">
        {/* Copy */}
        <div>
          <motion.div {...fadeUp(0)}>
            <span className="inline-flex items-center gap-2 bg-crawl-purple/15 border border-crawl-purple/30 text-crawl-purple-light text-sm font-medium px-4 py-1.5 rounded-full mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-crawl-purple-light animate-pulse" />
              Now available on iOS
            </span>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6"
            {...fadeUp(0.1)}
          >
            Find out where
            <br />
            to go{' '}
            <span className="bg-gradient-to-r from-crawl-purple to-crawl-purple-light bg-clip-text text-transparent">
              tonight.
            </span>
          </motion.h1>

          <motion.p
            className="text-crawl-text-muted text-lg lg:text-xl leading-relaxed max-w-[480px] mb-10"
            {...fadeUp(0.2)}
          >
            Real-time crowd voting surfaces the hottest bars in your city. No stale reviews, no guessing — see where people are actually going right now.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
            {...fadeUp(0.3)}
          >
            <AppStoreButton size="lg" />
            <span className="text-crawl-text-muted text-sm">Android coming soon</span>
          </motion.div>

          {/* Social proof micro-stat */}
          <motion.div
            className="mt-12 flex items-center gap-6"
            {...fadeUp(0.4)}
          >
            <div className="flex -space-x-2">
              {['#7f13ec', '#a855f7', '#5b0daa', '#9333ea'].map((color, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-crawl-bg"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <p className="text-crawl-text-muted text-sm">
              Launching in <span className="text-white font-semibold">Austin</span> — more cities coming
            </p>
          </motion.div>
        </div>

        {/* Phone mockup */}
        <motion.div
          className="flex justify-center lg:justify-end"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <PhoneMockup />
        </motion.div>
      </div>
    </section>
  )
}
