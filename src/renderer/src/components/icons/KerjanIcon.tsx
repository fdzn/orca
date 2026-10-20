import { Ticket } from 'lucide-react'

// Why: Kerjan ships only a raster logo, so use a monochrome glyph that matches the other provider icons.
export function KerjanIcon({ className }: { className?: string }): React.JSX.Element {
  return <Ticket aria-hidden className={className} />
}
