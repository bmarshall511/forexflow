import { getTodayAiCost, getMonthlyAiCost } from "@fxflow/db"

/**
 * Tracks AI Trader API costs against daily/monthly budgets.
 * Caches costs for 60s to avoid hammering the DB on every check.
 */
export class CostTracker {
  private cachedDailyCost: number | null = null
  private cachedMonthlyCost: number | null = null
  private lastFetchedAt = 0
  private readonly CACHE_TTL_MS = 60_000

  /** Refresh cached costs from DB. */
  async refresh(): Promise<void> {
    const [daily, monthly] = await Promise.all([getTodayAiCost(), getMonthlyAiCost()])
    this.cachedDailyCost = daily
    this.cachedMonthlyCost = monthly
    this.lastFetchedAt = Date.now()
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.lastFetchedAt > this.CACHE_TTL_MS) {
      await this.refresh()
    }
  }

  /** Get today's total AI Trader cost in USD. */
  async getDailyCost(): Promise<number> {
    await this.ensureFresh()
    return this.cachedDailyCost ?? 0
  }

  /** Get this month's total AI Trader cost in USD. */
  async getMonthlyCost(): Promise<number> {
    await this.ensureFresh()
    return this.cachedMonthlyCost ?? 0
  }

  /** Check if a proposed cost would exceed the daily budget. */
  async wouldExceedDailyBudget(proposedCost: number, dailyBudgetUsd: number): Promise<boolean> {
    const current = await this.getDailyCost()
    return current + proposedCost > dailyBudgetUsd
  }

  /** Check if a proposed cost would exceed the monthly budget. */
  async wouldExceedMonthlyBudget(proposedCost: number, monthlyBudgetUsd: number): Promise<boolean> {
    const current = await this.getMonthlyCost()
    return current + proposedCost > monthlyBudgetUsd
  }

  /** Record a cost (invalidates cache so next check refetches). */
  invalidateCache(): void {
    this.lastFetchedAt = 0
  }
}
