# PaperTrade

PaperTrade is an end-of-day replay simulator for practising stock decisions with virtual cash.

## Run on Windows

From the project folder in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000 in Edge. Python 3.12 works. The app serves its frontend and local CSV without Node or a market-data service. The browser remembers the active replay. Start a new replay to reset your portfolio.

## Presentation

1. **Product and data** — Explain why seeing future prices changes how learners make decisions. Start the 10-session challenge and show the replay date and chart.
2. **Trading engine** — Queue a buy for 10 shares. Click Next session and show the fill, cash and position. Explain how the next open avoids filling after the user has already seen the close.
3. **UI and evaluation** — Step through the challenge, point to the trade marker and compare the final portfolio with buy and hold. Show the phase agents and shared acceptance checks.

## Dataset and chart

The ten stock files contain 69,752 daily sessions from Jugaad Data, with the earliest histories starting in 1996. Every stock runs through 17 November 2026. See [per-stock coverage and verification](docs/DATA.md).

Search by name or symbol, choose a date in the calendar, then start a replay. A weekend or a gap selects the next available session. The latest session can be reached by advancing from the prior one. Restart the server after upgrading the data. Saved replays tied to the previous data files start fresh on reload.

Switch between candles and line. Drag or use the history slider to pan. Scroll over the chart or use the zoom buttons. Select Horizontal line and click a price level to mark supply or demand. Select Vertical line and click a session to mark its date. Undo line removes the latest mark. Drawings are saved in the browser for that replay.

Prices are unadjusted. Portfolio calculations do not account for corporate actions such as splits and demergers, so a long replay across those events can show misleading P&L.

For a reproducible Copilot build, use the same data folder and follow [the Copilot guide](docs/COPILOT.md). Check data redistribution permissions before publishing the CSVs.

## Run automated checks

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```