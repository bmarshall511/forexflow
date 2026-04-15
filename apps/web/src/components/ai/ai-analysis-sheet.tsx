"use client"

import { useState, useEffect } from "react"
import type {
  AiClaudeModel,
  AiAnalysisDepth,
  AiAnalysisData,
  OpenTradeData,
  PendingOrderData,
  ClosedTradeData,
} from "@fxflow/types"
import { AI_MODEL_OPTIONS } from "@fxflow/types"
import { isStuckAnalysis } from "@fxflow/shared"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import {
  Sparkles,
  History,
  Target,
  AlertTriangle,
  Settings,
  RefreshCw,
  Zap,
  Square,
} from "lucide-react"
import { AnalysisModelSelector } from "./analysis-model-selector"
import { AnalysisTabContent } from "./analysis-tab-content"
import { AnalysisHistory } from "./analysis-history"
import { ActionsPanel } from "./actions-panel"
import { TradeConditionsPanel } from "./trade-conditions-panel"
import { useAnalysisActions, convertToConditionSuggestions } from "./use-analysis-actions"
import { useAiAnalysis } from "@/hooks/use-ai-analysis"
import { useAiSettings } from "@/hooks/use-ai-settings"
import { useTradeConditions } from "@/hooks/use-trade-conditions"
import { usePositions } from "@/hooks/use-positions"
import { ModifySltpDialog } from "@/components/positions/modify-sltp-dialog"
import { CloseTradeDialog } from "@/components/positions/close-trade-dialog"

type TradeUnion = OpenTradeData | PendingOrderData | ClosedTradeData

interface AiAnalysisSheetProps {
  trade: TradeUnion | null
  tradeStatus: "open" | "pending" | "closed"
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiAnalysisSheet({ trade, tradeStatus, open, onOpenChange }: AiAnalysisSheetProps) {
  const tradeId = trade?.id ?? null
  const { pricesByInstrument } = usePositions()
  const liveTick = trade ? (pricesByInstrument.get(trade.instrument) ?? null) : null
  const { settings: aiSettings, refetch: refetchSettings } = useAiSettings()
  const [selectedModel, setSelectedModel] = useState<AiClaudeModel>("claude-sonnet-4-6")
  const [selectedDepth, setSelectedDepth] = useState<AiAnalysisDepth>("standard")
  const [viewedAnalysis, setViewedAnalysis] = useState<AiAnalysisData | null>(null)
  const [activeTab, setActiveTab] = useState("analysis")
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null)

  // Sync defaults from saved settings
  useEffect(() => {
    if (!aiSettings) return
    setSelectedModel(aiSettings.autoAnalysis.defaultModel)
    setSelectedDepth(aiSettings.autoAnalysis.defaultDepth)
  }, [aiSettings?.autoAnalysis.defaultModel, aiSettings?.autoAnalysis.defaultDepth]) // eslint-disable-line react-hooks/exhaustive-deps

  const estimatedSec = AI_MODEL_OPTIONS.find((m) => m.id === selectedModel)?.estimatedDurationSec
  const {
    history,
    progress,
    activeAnalysis,
    interruptedAnalysis,
    dismissInterruption,
    isLoading,
    isTransitioning,
    isTriggeringAnalysis,
    triggerAnalysis,
    cancelAnalysis,
  } = useAiAnalysis(tradeId)
  const conditionHooks = useTradeConditions(tradeId)

  // The analysis to display: viewed from history OR the latest terminal /
  // in-flight analysis. `partial` must be in the allow-list so truncated
  // analyses surface their parsed sections + TruncationBanner instead of
  // falling through to the empty state.
  const displayAnalysis =
    viewedAnalysis ??
    history.find(
      (a) =>
        a.status === "completed" ||
        a.status === "partial" ||
        a.status === "failed" ||
        a.status === "pending" ||
        a.status === "running",
    ) ??
    null

  const actionHooks = useAnalysisActions(trade, tradeStatus, displayAnalysis)
  const isAutoDisabled = !!aiSettings?.autoAnalysis.autoDisabledReason
  const stuck = displayAnalysis
    ? isStuckAnalysis(displayAnalysis.createdAt, displayAnalysis.status as "pending" | "running") &&
      !progress
    : false

  const handleTrigger = async () => {
    const id = await triggerAnalysis({ model: selectedModel, depth: selectedDepth })
    if (id) {
      setAnalysisStartedAt(Date.now())
      setViewedAnalysis(null)
      setActiveTab("analysis")
    } else {
      toast.error("Failed to start analysis. Is the daemon running and Claude API key configured?")
    }
  }

  const handleReEnable = async () => {
    try {
      await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "re-enable-auto" }),
      })
      refetchSettings()
      toast.success("Auto-analysis re-enabled")
    } catch {
      toast.error("Failed to re-enable auto-analysis")
    }
  }

  // Clear startedAt when analysis finishes + refetch conditions
  useEffect(() => {
    if (!progress) {
      setAnalysisStartedAt(null)
      conditionHooks.refetch()
    }
  }, [progress]) // eslint-disable-line react-hooks/exhaustive-deps

  const pair = trade?.instrument.replace("_", "/") ?? "—"
  const allActions = displayAnalysis?.sections?.immediateActions ?? []
  const conditionActionTypes = new Set(["add_condition", "adjust_tp_partial"])
  const actionableActions = allActions.filter((a) => !conditionActionTypes.has(a.type))
  const convertedConditionSuggestions = convertToConditionSuggestions(allActions, trade)
  const mergedConditionSuggestions = [
    ...(displayAnalysis?.sections?.conditionSuggestions ?? []),
    ...convertedConditionSuggestions,
  ]

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-2xl">
          <SheetHeader className="space-y-3 border-b px-6 pb-4 pt-6">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="text-primary size-4" />
                AI Analysis
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">
                  {tradeStatus}
                </Badge>
                <span className="font-mono text-sm font-medium">{pair}</span>
              </div>
            </div>
            <SheetDescription className="sr-only">
              AI-powered trade analysis for {pair}
            </SheetDescription>

            {isAutoDisabled && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-red-600">
                    Auto-analysis disabled due to repeated failures
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
                    {aiSettings?.autoAnalysis.autoDisabledReason}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 text-[10px]"
                      onClick={() => void handleReEnable()}
                    >
                      <RefreshCw className="size-3" />
                      Re-enable
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 gap-1 text-[10px]" asChild>
                      <a href="/settings/ai">
                        <Settings className="size-3" />
                        Settings
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {tradeStatus !== "closed" && (
              <div className="flex flex-wrap items-center gap-2">
                <AnalysisModelSelector
                  model={selectedModel}
                  depth={selectedDepth}
                  onModelChange={setSelectedModel}
                  onDepthChange={setSelectedDepth}
                  disabled={isTriggeringAnalysis || !!progress}
                />
                {progress && activeAnalysis ? (
                  // Persistent Stop button: visible from the sheet header whenever
                  // an analysis is running, so it stays reachable even when the
                  // user has scrolled the progress area off-screen.
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 min-h-9 gap-1.5 text-xs"
                    onClick={() => void cancelAnalysis(activeAnalysis.id)}
                    aria-label="Stop analysis"
                  >
                    <Square className="size-3 fill-current" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="min-h-9 gap-1.5 text-xs"
                    onClick={() => void handleTrigger()}
                    disabled={isTriggeringAnalysis || !!progress || !tradeId}
                    aria-label="Analyze trade with AI"
                    aria-busy={!!progress}
                  >
                    <Sparkles className="size-3" />
                    {isTriggeringAnalysis ? "Starting…" : "Analyze"}
                  </Button>
                )}
              </div>
            )}
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="bg-muted/50 mx-6 mt-3 grid h-8 w-auto shrink-0 grid-cols-4">
              <TabsTrigger value="analysis" className="gap-1 text-xs">
                <Sparkles className="size-3" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-1 text-xs">
                <Zap className="size-3" />
                Actions
                {actionableActions.length > 0 && tradeStatus !== "closed" && (
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[9px]">
                    {actionableActions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="conditions" className="gap-1 text-xs">
                <Target className="size-3" />
                Conditions
                {conditionHooks.conditions.filter(
                  (c) =>
                    c.status === "active" || c.status === "executing" || c.status === "waiting",
                ).length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[9px]">
                    {
                      conditionHooks.conditions.filter(
                        (c) =>
                          c.status === "active" ||
                          c.status === "executing" ||
                          c.status === "waiting",
                      ).length
                    }
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1 text-xs">
                <History className="size-3" />
                History
                {history.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[9px]">
                    {history.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="mt-0 min-h-0 flex-1">
              <ScrollArea className="h-full">
                <AnalysisTabContent
                  displayAnalysis={displayAnalysis}
                  progress={progress}
                  isLoading={isLoading}
                  isTransitioning={isTransitioning}
                  activeAnalysis={activeAnalysis}
                  interruptedAnalysis={interruptedAnalysis}
                  onDismissInterruption={dismissInterruption}
                  trade={trade}
                  tradeStatus={tradeStatus}
                  liveTick={liveTick}
                  isTriggeringAnalysis={isTriggeringAnalysis}
                  stuck={stuck}
                  estimatedSec={estimatedSec}
                  analysisStartedAt={analysisStartedAt}
                  history={history}
                  viewedAnalysis={viewedAnalysis}
                  onTrigger={() => void handleTrigger()}
                  onCancel={(id) => void cancelAnalysis(id)}
                  onClearViewed={() => setViewedAnalysis(null)}
                />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="actions" className="mt-0 min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  <ActionsPanel
                    sections={displayAnalysis?.sections ?? null}
                    tradeStatus={tradeStatus}
                    onApplyAction={actionHooks.handleApplyAction}
                    appliedActionIds={actionHooks.appliedActionIds}
                    appliedActions={actionHooks.appliedActions}
                    onUndoAction={(id) => void actionHooks.handleUndoAction(id)}
                    autoApplyMinConfidence={
                      aiSettings?.autoAnalysis.practiceAutoApplyEnabled ||
                      aiSettings?.autoAnalysis.liveAutoApplyEnabled
                        ? (aiSettings.autoAnalysis.autoApplyMinConfidence ?? "high")
                        : null
                    }
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="conditions" className="mt-0 min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  <TradeConditionsPanel
                    conditions={conditionHooks.conditions}
                    tradeStatus={tradeStatus}
                    hooks={conditionHooks}
                    conditionSuggestions={
                      mergedConditionSuggestions.length > 0 ? mergedConditionSuggestions : undefined
                    }
                    analysisId={displayAnalysis?.id}
                    trade={
                      trade && tradeStatus === "open" && "currentUnits" in trade
                        ? {
                            id: trade.id,
                            status: tradeStatus,
                            direction: trade.direction,
                            entryPrice: trade.entryPrice,
                            instrument: trade.instrument,
                            currentUnits: trade.currentUnits,
                          }
                        : undefined
                    }
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="mt-0 min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  <AnalysisHistory
                    history={history}
                    selectedId={viewedAnalysis?.id ?? null}
                    onSelect={(analysis) => {
                      setViewedAnalysis(analysis)
                      setActiveTab("analysis")
                    }}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {trade && (tradeStatus === "open" || tradeStatus === "pending") && (
        <ModifySltpDialog
          trade={trade as OpenTradeData}
          open={actionHooks.modifySltpOpen}
          onOpenChange={actionHooks.setModifySltpOpen}
          onConfirm={(sl, tp) => void actionHooks.handleModifySltpConfirm(sl, tp)}
          isLoading={actionHooks.actionLoading}
          initialSl={actionHooks.modifySltpTarget?.sl}
          initialTp={actionHooks.modifySltpTarget?.tp}
        />
      )}

      {trade && tradeStatus === "open" && "sourceTradeId" in trade && (
        <CloseTradeDialog
          trade={trade as OpenTradeData}
          open={actionHooks.closeTradeOpen}
          onOpenChange={actionHooks.setCloseTradeOpen}
          onConfirm={(units, reason) => void actionHooks.handleCloseTradeConfirm(units, reason)}
          isLoading={actionHooks.actionLoading}
        />
      )}
    </>
  )
}
