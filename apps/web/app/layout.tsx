import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Crawl — Find out where to go tonight',
  description:
    'Real-time crowd voting surfaces the hottest bars in your city. No stale reviews. No guessing. See where people are actually going right now.',
  metadataBase: new URL('https://crawlapp.co'),
  openGraph: {
    title: 'Crawl — Find out where to go tonight',
    description:
      'Real-time crowd voting surfaces the hottest bars in your city. No stale reviews. No guessing.',
    siteName: 'Crawl',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crawl — Find out where to go tonight',
    description:
      'Real-time crowd voting surfaces the hottest bars in your city.',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-crawl-bg text-white font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
