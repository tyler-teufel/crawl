import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/sections/Hero'
import { HowItWorks } from '@/components/sections/HowItWorks'
import { Features } from '@/components/sections/Features'
import { Cities } from '@/components/sections/Cities'
import { DownloadCTA } from '@/components/sections/DownloadCTA'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Cities />
        <DownloadCTA />
      </main>
      <Footer />
    </>
  )
}
