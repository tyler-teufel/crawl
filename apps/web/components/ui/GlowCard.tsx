import { ReactNode } from 'react'

interface GlowCardProps {
  children: ReactNode
  className?: string
}

export function GlowCard({ children, className = '' }: GlowCardProps) {
  return (
    <div
      className={`relative rounded-2xl bg-crawl-card border border-crawl-surface p-8 transition-all duration-300 hover:border-crawl-purple/40 hover:shadow-[0_0_40px_rgba(127,19,236,0.12)] ${className}`}
    >
      {children}
    </div>
  )
}
