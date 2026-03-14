import { CheckCircle2 } from "lucide-react"

export function OnboardingDone() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="bg-primary/10 mb-4 flex size-16 items-center justify-center rounded-full">
        <CheckCircle2 className="text-primary size-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">You&apos;re All Set</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Your workspace is ready. Head to the dashboard to start trading, or visit Settings to
        fine-tune your configuration.
      </p>
    </div>
  )
}
