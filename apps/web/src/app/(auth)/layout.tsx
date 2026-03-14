import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "FXFlow",
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">{children}</div>
  )
}
