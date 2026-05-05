'use client'

import { motion } from 'framer-motion'

const comingSoon = ['Chicago', 'Nashville', 'New York', 'Los Angeles', 'Miami']

export function Cities() {
  return (
    <section className="py-28 px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-crawl-purple-light text-sm font-semibold uppercase tracking-widest mb-6">
            Coverage
          </p>

          {/* Live city */}
          <div className="inline-flex items-center gap-3 bg-crawl-card border border-crawl-surface rounded-2xl px-8 py-5 mb-8">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crawl-green opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-crawl-green" />
            </span>
            <span className="text-white font-bold text-2xl">Austin, TX</span>
            <span className="bg-crawl-green/15 text-crawl-green text-xs font-semibold px-2.5 py-1 rounded-full">
              Live now
            </span>
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Starting in Austin.
            <br />
            <span className="text-crawl-text-muted font-normal">Coming to your city soon.</span>
          </h2>

          <p className="text-crawl-text-muted text-lg mb-12 max-w-xl mx-auto leading-relaxed">
            Crawl is launching first in Austin, TX — home to one of the best bar scenes in the country. Expansion coming fast.
          </p>
        </motion.div>

        {/* Coming soon cities */}
        <motion.div
          className="flex flex-wrap justify-center gap-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {comingSoon.map((city, i) => (
            <motion.span
              key={city}
              className="bg-crawl-surface border border-crawl-surface text-crawl-text-muted text-sm px-4 py-2 rounded-full"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 + i * 0.07 }}
            >
              {city}
            </motion.span>
          ))}
          <motion.span
            className="bg-crawl-surface border border-crawl-surface text-crawl-text-muted text-sm px-4 py-2 rounded-full"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 + comingSoon.length * 0.07 }}
          >
            + more
          </motion.span>
        </motion.div>
      </div>
    </section>
  )
}
