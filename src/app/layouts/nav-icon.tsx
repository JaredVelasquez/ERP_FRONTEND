import type { AppModule } from '@/modules/access'

const paths: Record<AppModule | 'scan' | 'family', string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  products: 'M4 8l8-4 8 4-8 4-8-4zm0 4l8 4 8-4M4 16l8 4 8-4',
  inventory: 'M4 7h16M4 12h16M4 17h16',
  prices: 'M12 3v18M16 7H9.5a2.5 2.5 0 0 0 0 5H14a2.5 2.5 0 0 1 0 5H7',
  accounting: 'M6 3h9l3 3v15H6zM15 3v4h4M8 13h8M8 17h5',
  imports: 'M12 4v10m0 0l-4-4m4 4l4-4M5 19h14',
  documents: 'M7 3h7l4 4v14H7zM14 3v5h5M9 13h6M9 17h6',
  platform: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3.5 19a4.5 4.5 0 0 1 9 0M13 19a3.5 3.5 0 0 1 7 0',
  scan: 'M5 7V5h2M17 5h2v2M5 17v2h2M19 17v2h-2M7 12h10',
  family: 'M8 7h8M8 12h8M8 17h5',
}

export function NavIcon({ name }: { name: AppModule | 'scan' | 'family' }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
