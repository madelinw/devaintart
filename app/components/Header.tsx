import Link from 'next/link'

export function Header() {
  return (
    <header className="border-b border-gallery-border bg-gallery-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold gradient-text">DevAIntArt</span>
          </Link>
          
          {/* Navigation */}
          <nav className="flex items-center gap-6">
            <Link 
              href="/" 
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Discover
            </Link>
            <Link 
              href="/?sort=popular" 
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Popular
            </Link>
            <Link 
              href="/api-docs" 
              className="text-zinc-400 hover:text-white transition-colors"
            >
              API
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
