# JData coverage and verification

PaperTrade uses local, normalized NSE EQ files from Jugaad Data 0.37.1. The history request covered 1994 through 18 November 2026. The first returned valid session differs by stock. The latest finalized session returned was 17 November 2026 for all ten.

| Stock | First session | Rows |
|---|---|---:|
| RELIANCE | 1996-01-01 | 7,681 |
| SBIN | 1996-01-01 | 7,680 |
| TCS | 2004-08-25 | 5,516 |
| INFY | 1996-01-01 | 7,639 |
| HDFCBANK | 1996-01-01 | 7,653 |
| ICICIBANK | 1997-09-24 | 7,250 |
| ITC | 1996-01-01 | 7,664 |
| LT | 2004-06-23 | 5,561 |
| AXISBANK | 1998-12-03 | 6,957 |
| BHARTIARTL | 2002-02-18 | 6,151 |

Dates were converted to India time, then validated and sorted. Older records for INFOSYSTCH, UTIBANK, and BHARTI were mapped to INFY, AXISBANK, and BHARTIARTL respectively. Suspect months and gaps were re-queried directly through the JData NSE client for EQ only. Inconsistent 1996 candles, such as an opening price outside the published high–low range, were omitted. Raw trades and prices are unadjusted for corporate actions.

The expanded dataset matched all 1,440 previously bundled stock-days. The official NSE cross-check covered 44 sessions per stock from December 2024 through January 2025, plus the 17 November 2026 session for all ten. These 450 official checks matched trading date and exact OHLC and volume. The remaining history was validated structurally.

Copy the bundled data/ folder for the company laptop. The app does not download anything at runtime. For a smaller fresh export, use JData's stock command, save each export as SYMBOL.csv in one folder, and run `python scripts/import_jdata.py raw`. The importer expects all ten symbols and the January 2025 challenge window. Full-history exports require the alias and gap reconciliation above before import. Restart the app after replacements. Saved replays tied to replaced datasets reset on reload.

- Jugaad Data source: https://github.com/jugaad-py/jugaad-data
- Official NSE daily reports: https://www.nseindia.com/all-reports/
- Latest comparison report: https://archives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_20261117_F_0000.csv.zip
