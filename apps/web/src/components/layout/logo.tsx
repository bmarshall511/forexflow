import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon"
  className?: string
}

const SIZES = {
  full: { width: 120, height: 28 },
  icon: { width: 32, height: 24 },
} as const

const SRCS = {
  full: { light: "/logo-black.png", dark: "/logo-white.png" },
  icon: { light: "/small-logo-black.png", dark: "/small-logo-white.png" },
} as const

export function Logo({ variant = "full", className }: LogoProps) {
  const { width, height } = SIZES[variant]
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
        width={width}
        height={height}
        priority
        className="dark:hidden"
        style={{ width: "auto", height: `${height}px` }}
      />
      <Image
        src={dark}
        alt="FXFlow"
        width={width}
        height={height}
        priority
        className="hidden dark:block"
        style={{ width: "auto", height: `${height}px` }}
      />
    </span>
  )
}
