export function Footer() {
  return (
    <footer className="border-t border-crawl-surface bg-crawl-bg">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-crawl-purple flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span className="text-crawl-text-muted text-sm">
            &copy; {new Date().getFullYear()} Crawl
          </span>
        </div>

        {/* Links */}
        <nav className="flex items-center gap-6" aria-label="Footer">
          <a href="#" className="text-crawl-text-muted text-sm hover:text-white transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="text-crawl-text-muted text-sm hover:text-white transition-colors">
            Terms of Service
          </a>
          <a href="mailto:hello@crawlapp.co" className="text-crawl-text-muted text-sm hover:text-white transition-colors">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  )
}
