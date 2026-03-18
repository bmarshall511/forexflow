"use client"

import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react"
import type {
  ReplayControls as ReplayControlsType,
  ReplaySpeed,
  ReplayTimeframe,
} from "@/hooks/use-trade-replay"

const SPEEDS: ReplaySpeed[] = [1, 2, 5, 10]
const TIMEFRAMES: ReplayTimeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4"]

function formatElapsed(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor(seconds / 60)
  if (days > 0) return `Day ${days + 1}`
  if (hrs > 0) return `${hrs}h ${mins % 60}m in`
  return `${mins}m in`
}

interface ReplayControlsProps {
  controls: ReplayControlsType
  currentIndex: number
  totalCandles: number
  isPlaying: boolean
  speed: ReplaySpeed
  currentTime: string | null
  timeframe: ReplayTimeframe | null
  entryTime?: number
  exitTime?: number | null
  currentCandleTime?: number | null
}

export function ReplayControls({
  controls,
  currentIndex,
  totalCandles,
  isPlaying,
  speed,
  currentTime,
  timeframe,
  entryTime,
  exitTime: _exitTime,
  currentCandleTime,
}: ReplayControlsProps) {
  const maxIndex = Math.max(0, totalCandles - 1)

  const elapsedSeconds =
    entryTime != null && currentCandleTime != null && currentCandleTime >= entryTime
      ? currentCandleTime - entryTime
      : null

  return (
    <div className="flex flex-col gap-2">
      {/* Progress slider */}
      <input
        type="range"
        min={0}
        max={maxIndex}
        value={currentIndex}
        onChange={(e) => controls.seekTo(Number(e.target.value))}
        className="bg-muted accent-primary h-2 w-full cursor-pointer appearance-none rounded-full"
        aria-label="Replay progress"
      />

      {/* Timeframe selector */}
      <div className="flex items-center gap-0.5" role="group" aria-label="Timeframe">
        {TIMEFRAMES.map((tf) => (
          <Button
            key={tf}
            variant={timeframe === tf ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-1.5 font-mono text-[10px]"
            onClick={() => controls.setTimeframe(tf)}
            aria-label={`Switch to ${tf} timeframe`}
            aria-pressed={timeframe === tf}
          >
            {tf}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {/* Transport buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={controls.reset}
            aria-label="Reset to start"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={controls.stepBack}
            disabled={currentIndex === 0}
            aria-label="Step back one candle"
          >
            <SkipBack className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={isPlaying ? controls.pause : controls.play}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={controls.stepForward}
            disabled={currentIndex >= maxIndex}
            aria-label="Step forward one candle"
          >
            <SkipForward className="size-3.5" />
          </Button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-0.5" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <Button
              key={s}
              variant={speed === s ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-1.5 font-mono text-[10px]"
              onClick={() => controls.setSpeed(s)}
              aria-label={`Set speed to ${s}x`}
              aria-pressed={speed === s}
            >
              {s}x
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Elapsed time indicator */}
        {elapsedSeconds != null && elapsedSeconds > 0 && (
          <span
            className="text-muted-foreground font-mono text-[10px] tabular-nums"
            aria-label={`${formatElapsed(elapsedSeconds)} since entry`}
          >
            {formatElapsed(elapsedSeconds)}
          </span>
        )}

        {/* Time + counter */}
        <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
          {currentTime ?? "---"}
        </span>
        <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
          {currentIndex + 1}/{totalCandles}
        </span>
      </div>
    </div>
  )
}
