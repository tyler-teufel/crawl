'use client'

import { motion } from 'framer-motion'
import { GlowCard } from '@/components/ui/GlowCard'

const steps = [
  {
    number: '01',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    ),
    title: 'Explore nearby venues',
    description:
      'Browse bars, clubs, and hidden gems on a live map. Filter by vibe — rooftop, live music, craft cocktails, sports bar, and more.',
  },
  {
    number: '02',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c0 0-8 4.5-8 11a8 8 0 0 0 16 0c0-6.5-8-11-8-11z"/>
        <path d="M12 12v5"/>
        <path d="M9.5 9.5 12 12l2.5-2.5"/>
      </svg>
    ),
    title: 'Cast your 3 daily votes',
    description:
      'Every day you get 3 votes. Use them on your favorites. Scarcity makes every vote count — the leaderboard reflects real enthusiasm.',
  },
  {
    number: '03',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
      </svg>
    ),
    title: "See tonight's hotspots",
    description:
      'Hotspot Scores update in real time as votes pour in. Watch bars climb the leaderboard before you even leave the house.',
  },
]

export function HowItWorks() {
  return (
    <section className="py-28 px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle divider gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent to-crawl-surface" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-crawl-purple-light text-sm font-semibold uppercase tracking-widest mb-3">
            How it works
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">
            Your night, optimized
            <br />
            <span className="bg-gradient-to-r from-crawl-purple to-crawl-purple-light bg-clip-text text-transparent">
              by the crowd
            </span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
            >
              <GlowCard className="h-full">
                {/* Step number */}
                <p className="text-5xl font-black bg-gradient-to-br from-crawl-purple/40 to-crawl-purple-light/20 bg-clip-text text-transparent mb-6 leading-none">
                  {step.number}
                </p>
                {/* Icon */}
                <div className="text-crawl-purple-light mb-4">
                  {step.icon}
                </div>
                <h3 className="text-white font-semibold text-xl mb-3 leading-tight">
                  {step.title}
                </h3>
                <p className="text-crawl-text-muted text-base leading-relaxed">
                  {step.description}
                </p>
              </GlowCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
