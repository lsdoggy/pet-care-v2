import type { ReactNode, SVGProps } from 'react'

/**
 * Design Sprint 0: inline SVG icon set for the design system.
 * No binary assets, no icon libraries — 24px stroke icons (currentColor).
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function PawIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7" cy="8" r="1.6" />
      <circle cx="12" cy="6" r="1.6" />
      <circle cx="17" cy="8" r="1.6" />
      <path d="M12 11c-2.5 0-4.5 2.2-4.5 4.3 0 1.6 1.2 2.4 2.6 2 .8-.2 1.2-.3 1.9-.3s1.1.1 1.9.3c1.4.4 2.6-.4 2.6-2C16.5 13.2 14.5 11 12 11Z" />
    </Svg>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V20h12v-9.5" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  )
}

export function BoxIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8.5 12 5l8 3.5v7L12 19l-8-3.5v-7Z" />
      <path d="M4 8.5 12 12l8-3.5M12 12v7" />
    </Svg>
  )
}

export function CartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
      <path d="M4 5h2l2.2 9.2a1 1 0 0 0 1 .8h7.4a1 1 0 0 0 1-.7L20 8H7" />
    </Svg>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2m0 12.6v2.2M3.5 12h2.2m12.6 0h2.2M6 6l1.6 1.6m8.8 8.8L18 18M6 18l1.6-1.6m8.8-8.8L18 6" />
    </Svg>
  )
}

/* ---------- Design Sprint 2: Dashboard icon set ---------- */

export function CalendarPlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4m8-4v4" />
      <path d="M12 12.5v5m-2.5-2.5h5" />
    </Svg>
  )
}

export function StethoscopeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3.5v5a4 4 0 0 0 8 0v-5" />
      <path d="M10 16.5a5 5 0 0 0 10 0v-2" />
      <circle cx="20" cy="12" r="2.2" />
      <path d="M6 3.5h2m6 0h2" opacity="0" />
    </Svg>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 2.8 20h18.4L12 4Z" />
      <path d="M12 10.5v4.5" />
      <circle cx="12" cy="17.6" r="0.4" fill="currentColor" strokeWidth={1.2} />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </Svg>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11.5a8 8 0 1 1-2.3-5.7" />
      <path d="M20 3.5V7h-3.5" />
    </Svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5.5 15.5 12 9 18.5" />
    </Svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

/** Species glyph for placeholder avatars — keyed by backend PetSpecies enum. */
const SPECIES_GLYPHS: Record<string, string> = {
  DOG: '🐶',
  CAT: '🐱',
  BIRD: '🐦',
  HAMSTER: '🐹',
  RABBIT: '🐰',
  TURTLE: '🐢',
  FISH: '🐟',
  OTHER: '🐾',
}

export function speciesGlyph(species: string): string {
  return SPECIES_GLYPHS[species] ?? '🐾'
}
