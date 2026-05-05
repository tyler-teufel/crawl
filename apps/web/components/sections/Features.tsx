'use client'

import { motion } from 'framer-motion'
import { GlowCard } from '@/components/ui/GlowCard'

function HotspotRing({ score }: { score: number }) {
  const circ = 2 * Math.PI * 28
  const offset = circ * (1 - score / 100)
  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r="28" fill="none" stroke="#16162a" strokeWidth="5" />
        <circle
          cx="32" cy="32" r="28" fill="none"
          stroke="#7f13ec" strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white text-sm font-bold leading-none">{score}</span>
      </div>
    </div>
  )
}

const features = [
  {
    visual: <HotspotRing score={94} />,
    title: 'Hotspot Score',
    description:
      'A live 0–100 score derived from real crowd votes. Not star ratings, not follower counts — just where people are actually choosing to go tonight.',
  },
  {
    visual: (
      <div className="flex items-center gap-2">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#7f13ec" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span className="text-4xl font-black text-white">3</span>
        <span className="text-crawl-text-muted text-sm font-medium">/day</span>
      </div>
    ),
    title: '3 Votes a Day',
    description:
      'Scarcity makes votes matter. With just 3 votes per day, you\'re intentional — and the leaderboard reflects real enthusiasm, not noise.',
  },
  {
    visual: (
      <div className="flex gap-2 flex-wrap">
        {['Trending', 'Rooftop', 'Live Music', 'Open Now'].map((label) => (
          <span
            key={label}
            className="bg-crawl-purple/20 border border-crawl-purple/40 text-crawl-purple-light text-xs font-medium px-3 py-1 rounded-full"
          >
            {label}
          </span>
        ))}
      </div>
    ),
    title: 'Filter by Vibe',
    description:
      'Trending, Open Now, Live Music, Rooftop, Craft Cocktails, Dog Friendly — 10 filters so you always find your kind of spot.',
  },
  {
    visual: (
      <div className="space-y-1.5 w-full">
        {[
          { name: 'Midnight Cowboy', score: 94 },
          { name: 'Roosevelt Room', score: 90 },
          { name: 'Whiskey Tango', score: 92 },
        ].map((v, i) => (
          <div key={v.name} className="flex items-center gap-3">
            <span className="text-crawl-text-muted text-xs w-4 text-right">#{i + 1}</span>
            <div className="flex-1 bg-crawl-surface rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-crawl-purple to-crawl-purple-light rounded-full"
                style={{ width: `${v.score}%` }}
              />
            </div>
            <span className="text-white text-xs font-semibold">{v.score}</span>
          </div>
        ))}
      </div>
    ),
    title: 'City Rankings',
    description:
      'See the live leaderboard for your city. Watch venues climb and fall throughout the night as votes pour in — know what\'s hot before you arrive.',
  },
]

export function Features() {
  return (
    <section className="py-28 px-6 lg:px-8 bg-crawl-surface/30">
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
            Features
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white">
            Built for the night
          </h2>
        </motion.div>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <GlowCard className="h-full flex flex-col gap-6">
                {/* Visual */}
                <div className="min-h-[64px] flex items-center">
                  {feature.visual}
                </div>
                {/* Text */}
                <div>
                  <h3 className="text-white font-semibold text-xl mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-crawl-text-muted text-base leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
