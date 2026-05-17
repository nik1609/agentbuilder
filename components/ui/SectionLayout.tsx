import { ReactNode } from 'react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  match?: (p: string) => boolean
}

// Nav prop kept for API compatibility but the global sidebar in layout.tsx
// now handles all navigation — this component is just a transparent wrapper.
export default function SectionLayout({ children }: { nav: NavItem[]; children: ReactNode }) {
  return <>{children}</>
}
