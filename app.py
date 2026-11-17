import csv
import json
import sqlite3
from contextlib import closing
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, StrictInt
from typing import Literal

ROOT = Path(__file__).resolve().parent
DB = ROOT / "papertrade.sqlite3"
STARTING_CASH = 10_000_000  # Paise
CHALLENGE_STEPS = 10

STOCKS = {
    "RELIANCE": "Reliance Industries", "SBIN": "State Bank of India",
    "TCS": "Tata Consultancy Services", "INFY": "Infosys",
    "HDFCBANK": "HDFC Bank", "ICICIBANK": "ICICI Bank",
    "ITC": "ITC", "LT": "Larsen & Toubro",
    "AXISBANK": "Axis Bank", "BHARTIARTL": "Bharti Airtel",
}
CHALLENGE_DATE = "2025-01-10"


def data_file(symbol):
    filename = "reliance.csv" if symbol == "RELIANCE" else f"{symbol}.csv"
    return ROOT / "data" / filename


def read_candles(symbol):
    with data_file(symbol).open(newline="") as source:
        return list(csv.DictReader(source))


MARKET = {symbol: read_candles(symbol) for symbol in STOCKS}
DATASETS = {symbol: sha256(data_file(symbol).read_bytes()).hexdigest() for symbol in STOCKS}
DATES = {symbol: [row["date"] for row in rows] for symbol, rows in MARKET.items()}


def price(symbol, index, field):
    return int(Decimal(MARKET[symbol][index][field]) * 100)


def connect():
    connection = sqlite3.connect(DB, isolation_level=None)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, state TEXT NOT NULL)"
    )
    return connection


app = FastAPI(title="PaperTrade")


class Replay(BaseModel):
    start: str | None = None
    challenge: bool = False
    symbol: str = "RELIANCE"


class Action(BaseModel):
    kind: Literal["next", "buy", "sell", "cancel"]
    quantity: StrictInt = 0


def snapshot(session_id, state):
    index = state["index"]
    symbol = state.get("symbol", "RELIANCE")
    dates = DATES[symbol]
    close = price(symbol, index, "close")
    benchmark = state["benchmark_cash"] + state["benchmark_shares"] * close
    if index == state["start"]:
        benchmark = STARTING_CASH
    return dict(
        {key: value for key, value in state.items() if not key.startswith("benchmark_") and key != "dataset"},
        id=session_id,
        date=dates[index],
        end_date=dates[state["end"]],
        symbol=symbol,
        candles=MARKET[symbol][:index + 1],
        value=state["cash"] + state["shares"] * close,
        benchmark=benchmark,
        starting_cash=STARTING_CASH,
    )


@app.get("/api/setup")
def setup():
    return {
        "stocks": [
            {"symbol": symbol, "name": name, "dates": DATES[symbol][:-1]}
            for symbol, name in STOCKS.items()
        ],
        "challenge_start": CHALLENGE_DATE,
    }


@app.post("/api/replays", status_code=201)
def start_replay(request: Replay):
    symbol = request.symbol
    if symbol not in MARKET:
        raise HTTPException(422, "Choose a listed replay stock.")
    dates = DATES[symbol]
    if request.challenge:
        index = dates.index(CHALLENGE_DATE)
        end = index + CHALLENGE_STEPS
    elif request.start in dates[:-1]:
        index = dates.index(request.start)
        end = len(dates) - 1
    else:
        raise HTTPException(422, "Choose a valid replay start date.")
    benchmark_shares, benchmark_cash = divmod(STARTING_CASH, price(symbol, index + 1, "open"))
    session_id = str(uuid4())
    state = dict(
        index=index, start=index, end=end, challenge=request.challenge, symbol=symbol, cash=STARTING_CASH,
        dataset=DATASETS[symbol], shares=0, pending=None, trades=[], benchmark_cash=benchmark_cash,
        benchmark_shares=benchmark_shares,
    )
    with closing(connect()) as connection:
        connection.execute("INSERT INTO sessions VALUES (?, ?)", (session_id, json.dumps(state)))
    return snapshot(session_id, state)


def load(connection, session_id):
    row = connection.execute("SELECT state FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Replay session not found.")
    state = json.loads(row[0])
    if "symbol" not in state:
        if "2025-01-01" not in DATES["RELIANCE"]:
            raise HTTPException(410, "The price dataset changed. Start a new replay.")
        offset = DATES["RELIANCE"].index("2025-01-01")
        for field in ("index", "start", "end"):
            state[field] += offset
        state["symbol"] = "RELIANCE"
    symbol = state["symbol"]
    if state.get("dataset", DATASETS[symbol]) != DATASETS[symbol]:
        raise HTTPException(410, "The price dataset changed. Start a new replay.")
    state["dataset"] = DATASETS[symbol]
    return state


@app.get("/api/replays/{session_id}")
def get_replay(session_id: UUID):
    with closing(connect()) as connection:
        return snapshot(str(session_id), load(connection, str(session_id)))


def apply_action(state, action):
    symbol = state.get("symbol", "RELIANCE")
    if action.kind == "cancel":
        state["pending"] = None
        return
    if state["index"] == state["end"]:
        raise HTTPException(409, "This replay is complete.")
    if action.kind == "next":
        state["index"] += 1
        order = state["pending"]
        if order:
            fill_price = price(symbol, state["index"], "open")
            quantity = order["quantity"]
            total = fill_price * quantity
            filled = order["side"] == "sell" or total <= state["cash"]
            if filled:
                direction = 1 if order["side"] == "buy" else -1
                state["cash"] -= direction * total
                state["shares"] += direction * quantity
            state["trades"].append(dict(
                order, date=DATES[symbol][state["index"]], price=fill_price,
                status="filled" if filled else "rejected",
                reason="" if filled else "Insufficient cash at the next open",
            ))
            state["pending"] = None
        return
    if state["pending"]:
        raise HTTPException(409, "An order is already queued.")
    if not 1 <= action.quantity <= 100_000:
        raise HTTPException(422, "Enter a whole quantity from 1 to 100,000.")
    if action.kind == "sell" and action.quantity > state["shares"]:
        raise HTTPException(422, "You can only sell shares you hold.")
    if action.kind == "buy" and action.quantity * price(symbol, state["index"], "close") > state["cash"]:
        raise HTTPException(422, "The estimated cost exceeds your virtual cash.")
    state["pending"] = {"side": action.kind, "quantity": action.quantity}


@app.post("/api/replays/{session_id}/actions")
def update_replay(session_id: UUID, action: Action):
    with closing(connect()) as connection:
        connection.execute("BEGIN IMMEDIATE")
        state = load(connection, str(session_id))
        apply_action(state, action)
        connection.execute("UPDATE sessions SET state = ? WHERE id = ?", (json.dumps(state), str(session_id)))
        connection.commit()
    return snapshot(str(session_id), state)


app.mount("/", StaticFiles(directory=ROOT / "web", html=True), name="dashboard")
