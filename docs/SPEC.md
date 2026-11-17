# PaperTrade specification

## Scope

Daily delivery-style replay for ten NSE EQ stocks, using the supplied maximum-history CSV for each symbol. Each replay uses one stock. Python 3.12, FastAPI, Uvicorn, SQLite, static HTML/CSS/vanilla JS and canvas. Localhost only. No live feed, Node, intraday, short selling, brokerage fees, taxes or dividend accounting.

## Behavior

- Use a calendar date picker bounded by the selected stock's first and penultimate sessions. An in-range non-session date moves to the next session. Start each replay with ₹1,00,000, zero holdings and a new session ID. Preset starts on January 10 and finishes after 10 advances on January 24.
- One pending whole-share buy or sell per session. Cancel before advancing. Reject insufficient holdings or a buy estimated above cash using the displayed close.
- Next reveals only the next CSV row. Fill at that row's open. Reject a buy if the opening cost exceeds cash. Store orders and rejections in history. Advance and settle atomically. Store money in integer paise.
- Portfolio = cash + shares × displayed close. Total P&L = portfolio minus starting cash. Buy-and-hold starts with the same cash and buys as many whole shares as possible at the first revealed open, retaining unused cash. Compare both at current close.
- Persist sessions in SQLite. Keep active session ID in browser storage so refresh resumes. Return only chart rows through current session. End disables new orders and advances.

## Interface

Light teal dashboard. Top bar, stock search by symbol or company name, stock and replay date selectors and challenge button, four cards for value/cash/shares/P&L, daily candlestick and close-line chart modes with B/S markers, adjustable 10–320-session window, drag or slider history navigation, and mouse-wheel or button zoom, next-session button, order ticket with cancel and benchmark, trade history, source footer. Use INR formatting and a responsive single-column mobile layout.

Inspect visible sessions for open, high, low, close and simple doji, hammer-shape, bullish engulfing and bearish engulfing labels. Chart navigation only moves over revealed sessions and never changes portfolio state. Provide Pan, Horizontal line, Vertical line and Undo line. Horizontal lines anchor to prices, vertical lines to session dates. Persist drawings per replay in browser storage.

## Contract and acceptance

- GET /api/setup gives stock symbols, names and available dates per stock. POST /api/replays accepts symbol (default RELIANCE) plus start (ISO date) or challenge=true. GET /api/replays/{id} restores state. POST /api/replays/{id}/actions accepts kind (buy/sell/cancel/next) and integer quantity for trades.
- Creation reveals no chart data after chosen date. Buy 10, advance, verify 10 shares, exact fill and cash deduction. Sell 10, advance and verify zero shares. Test cancel, oversell, insufficient cash at open, opaque missing session ID, refresh, stock-specific fills, session isolation, chart mode, date picker, pan, zoom, drawings and history navigation, and challenge boundary.
- Run locally in Edge with identical CSV. Match behavior and dashboard structure across implementations. Compare exact prices/cash using the common datasets; compare visual appearance to the reference prototype if supplied.

## Reference demo values for RELIANCE

- Challenge opens at the January 10 close of Rs 1,241.90.
- Buy 10 and advance to January 13. The fill is Rs 1,230.00 per share, cash is Rs 87,700.00 and the portfolio is Rs 100,098.50 at the close.
- Sell 10 and advance to January 14. The fill is Rs 1,244.10 per share and cash is Rs 100,141.00.
- Start January 16 and queue 78 shares. The estimated cost fits at the close, but the January 17 open rejects the order.