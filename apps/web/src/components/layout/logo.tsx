import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon"
  className?: string
}

/**
 * `intrinsic` MUST match the actual PNG pixel dimensions so Next.js's dev
 * aspect-ratio detector doesn't warn. `displayHeight` is what renders on
 * screen; width auto-scales from the intrinsic ratio via CSS.
 *
 * PNGs on disk:
 *   full  logo-*.png       → 461 × 80   (ratio ≈ 5.76)
 *   icon  small-logo-*.png → 145 × 80   (ratio ≈ 1.81)
 */
const SIZES = {
  full: { intrinsicWidth: 461, intrinsicHeight: 80, displayHeight: 28 },
  icon: { intrinsicWidth: 145, intrinsicHeight: 80, displayHeight: 24 },
} as const

const SRCS = {
  full: { light: "/logo-black.png", dark: "/logo-white.png" },
  icon: { light: "/small-logo-black.png", dark: "/small-logo-white.png" },
} as const

export function Logo({ variant = "full", className }: LogoProps) {
  const { intrinsicWidth, intrinsicHeight, displayHeight } = SIZES[variant]
  const { light, dark } = SRCS[variant]

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      {/*
       * Pin height to the desired pixel size and let width auto-scale.
       * Tailwind Preflight sets `max-width: 100%` on every img, which
       * effectively modifies width without height — that tripped the
       * Next.js "image has width or height modified, but not the other"
       * warning. Explicitly declaring BOTH in style satisfies the
       * detector (Next.js wants you to acknowledge the CSS override)
       * and keeps visual size deterministic.
       */}
      <Image
        src={light}
        alt="FXFlow"
        width={intrinsicWidth}
        height={intrinsicHeight}
        priority
        className="dark:hidden"
        style={{ width: "auto", height: `${displayHeight}px` }}
      />
      <Image
        src={dark}
        alt="FXFlow"
        width={intrinsicWidth}
        height={intrinsicHeight}
        priority
        className="hidden dark:block"
        style={{ width: "auto", height: `${displayHeight}px` }}
      />
    </span>
  )
}
