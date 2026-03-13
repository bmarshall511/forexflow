import type { TradingMode } from "@fxflow/types"

const REST_URLS: Record<TradingMode, string> = {
  practice: "https://api-fxpractice.oanda.com",
  live: "https://api-fxtrade.oanda.com",
}

const STREAM_URLS: Record<TradingMode, string> = {
  practice: "https://stream-fxpractice.oanda.com",
  live: "https://stream-fxtrade.oanda.com",
}

export function getRestUrl(mode: TradingMode): string {
  return REST_URLS[mode]
}

export function getStreamUrl(mode: TradingMode): string {
  return STREAM_URLS[mode]
}

interface OandaRequestOptions {
  mode: TradingMode
  token: string
  path: string
  signal?: AbortSignal
}

/** Make an authenticated GET request to the OANDA REST API. */
export async function oandaGet<T>(options: OandaRequestOptions): Promise<T> {
  const { mode, token, path, signal } = options
  const url = `${getRestUrl(mode)}${path}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OANDA ${response.status}: ${body}`)
  }

  return response.json() as Promise<T>
}

interface OandaWriteOptions extends OandaRequestOptions {
  body?: unknown
}

/** Make an authenticated PUT request to the OANDA REST API. */
export async function oandaPut<T>(options: OandaWriteOptions): Promise<T> {
  const { mode, token, path, signal, body } = options
  const url = `${getRestUrl(mode)}${path}`

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OANDA ${response.status}: ${text}`)
  }

  return response.json() as Promise<T>
}

/** Make an authenticated POST request to the OANDA REST API. */
export async function oandaPost<T>(options: OandaWriteOptions): Promise<T> {
  const { mode, token, path, signal, body } = options
  const url = `${getRestUrl(mode)}${path}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OANDA ${response.status}: ${text}`)
  }

  return response.json() as Promise<T>
}

// ─── Response types ─────────────────────────────────────────────────────────

export interface OandaAccountSummary {
  account: {
    id: string
    alias?: string
    currency: string
    balance: string
    NAV: string
    unrealizedPL: string
    pl: string
    financing: string
    commission: string
    marginUsed: string
    marginAvailable: string
    marginCallPercent: string
    marginCloseoutPercent: string
    openTradeCount: number
    openPositionCount: number
    pendingOrderCount: number
    positionValue: string
    withdrawalLimit: string
    hedgingEnabled: boolean
    lastOrderFillTimestamp?: string
    createdTime: string
  }
}

// ─── Transaction API types ──────────────────────────────────────────────────

export interface OandaTransactionPagesResponse {
  from: string
  to: string
  pageSize: number
  count: number
  pages: string[]
}

export interface OandaOrderFillTransaction {
  id: string
  type: "ORDER_FILL"
  time: string
  pl: string
  financing: string
  commission: string
  accountBalance: string
  instrument: string
  units: string
}

export interface OandaDailyFinancingTransaction {
  id: string
  type: "DAILY_FINANCING"
  time: string
  financing: string
  accountBalance: string
}

export interface OandaTransactionPageResponse {
  transactions: Array<OandaOrderFillTransaction | OandaDailyFinancingTransaction | { type: string }>
}

// ─── Orders API types ───────────────────────────────────────────────────────

export interface OandaStopLossDetails {
  price?: string
  distance?: string
  timeInForce?: string
}

export interface OandaTakeProfitDetails {
  price?: string
  timeInForce?: string
}

export interface OandaTrailingStopLossDetails {
  distance?: string
  timeInForce?: string
}

export interface OandaOrder {
  id: string
  type: string
  instrument: string
  units: string
  price?: string
  timeInForce: string
  gtdTime?: string
  state: string
  createTime: string
  stopLossOnFill?: OandaStopLossDetails
  takeProfitOnFill?: OandaTakeProfitDetails
  trailingStopLossOnFill?: OandaTrailingStopLossDetails
}

export interface OandaOrdersResponse {
  orders: OandaOrder[]
  lastTransactionID: string
}

// ─── Trades API types ───────────────────────────────────────────────────────

export interface OandaLinkedOrder {
  id: string
  price?: string
  distance?: string
  state: string
}

export interface OandaTrade {
  id: string
  instrument: string
  price: string // Opening price (NOT "openPrice")
  openTime: string
  state: string
  initialUnits: string
  currentUnits: string
  realizedPL: string
  unrealizedPL: string
  financing: string
  marginUsed?: string
  averageClosePrice?: string
  closeTime?: string
  closingTransactionIDs?: string[]
  stopLossOrder?: OandaLinkedOrder
  takeProfitOrder?: OandaLinkedOrder
  trailingStopLossOrder?: OandaLinkedOrder
}

export interface OandaTradesResponse {
  trades: OandaTrade[]
  lastTransactionID: string
}

// ─── Extended ORDER_FILL transaction with trade details ─────────────────────

export interface OandaOrderFillTransactionDetailed extends OandaOrderFillTransaction {
  reason?: string
  tradeOpened?: { tradeID: string; units: string; price?: string }
  tradesClosed?: Array<{
    tradeID: string
    units: string
    realizedPL: string
    financing: string
    price?: string
  }>
  tradesReduced?: Array<{
    tradeID: string
    units: string
    realizedPL: string
    financing: string
    price?: string
  }>
}

// ─── Transaction stream types ───────────────────────────────────────────────

export interface OandaTransactionStreamHeartbeat {
  type: "HEARTBEAT"
  lastTransactionID: string
  time: string
}

export interface OandaTransactionStreamEvent {
  type: string
  id?: string
  time?: string
  pl?: string
  financing?: string
  commission?: string
  accountBalance?: string
}

export interface OandaPriceMessage {
  type: "PRICE"
  instrument: string
  tradeable: boolean
  status: string
  time: string
}

export interface OandaHeartbeatMessage {
  type: "HEARTBEAT"
  time: string
}

export type OandaStreamMessage = OandaPriceMessage | OandaHeartbeatMessage

// ─── Order Creation Response ────────────────────────────────────────────────

export interface OandaCreateOrderResponse {
  orderCreateTransaction?: {
    id: string
    type: string
    instrument: string
    units: string
    price?: string
    timeInForce: string
  }
  orderFillTransaction?: {
    id: string
    type: string
    instrument: string
    units: string
    price: string
    tradeOpened?: { tradeID: string; units: string; price: string }
  }
  orderCancelTransaction?: {
    id: string
    type: string
    reason: string
  }
  relatedTransactionIDs: string[]
  lastTransactionID: string
}

export interface OandaCloseTradeResponse {
  orderFillTransaction?: {
    id: string
    type: string
    time: string
    instrument: string
    units: string
    price: string
    tradesClosed?: Array<{
      tradeID: string
      units: string
      realizedPL: string
      financing?: string
      price?: string
    }>
    tradesReduced?: Array<{
      tradeID: string
      units: string
      realizedPL: string
      financing?: string
      price?: string
    }>
  }
  relatedTransactionIDs: string[]
  lastTransactionID: string
}
