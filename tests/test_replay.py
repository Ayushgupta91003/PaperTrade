import json
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

import app


class ReplayTests(TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        db = patch.object(app, "DB", Path(temp.name) / "test.sqlite3")
        db.start()
        self.addCleanup(db.stop)
        self.client = self.enterContext(TestClient(app.app))

    def start(self, **request):
        response = self.client.post("/api/replays", json=request)
        self.assertEqual(response.status_code, 201, response.text)
        self.path = "/api/replays/" + response.json()["id"]
        return response.json()

    def action(self, kind, quantity=0, status=200):
        response = self.client.post(self.path + "/actions", json={"kind": kind, "quantity": quantity})
        self.assertEqual(response.status_code, status, response.text)
        return response.json()

    def test_challenge_buy_sell_and_restore(self):
        initial = self.start(challenge=True)
        self.assertEqual(initial["date"], "2025-01-10")
        self.assertEqual(initial["candles"][-1]["date"], initial["date"])
        self.assertNotIn("benchmark_shares", initial)
        self.assertEqual(self.action("buy", 10)["cash"], 10_000_000)
        bought = self.action("next")
        self.assertEqual((bought["date"], bought["shares"], bought["cash"]), ("2025-01-13", 10, 8_770_000))
        self.assertEqual(bought["trades"][0]["price"], 123_000)
        self.assertEqual(bought["benchmark"], 10_079_785)
        self.assertEqual(self.client.get(self.path).json(), bought)
        self.action("sell", 10)
        sold = self.action("next")
        self.assertEqual((sold["shares"], sold["cash"]), (0, 10_014_100))
        for _ in range(8):
            last = self.action("next")
        self.assertEqual(last["date"], "2025-01-24")
        self.action("next", status=409)

    def test_validation_cancel_and_price_gap(self):
        self.start(start="2025-01-16")
        self.action("sell", 1, status=422)
        self.action("buy", 100, status=422)
        self.action("buy", 1)
        self.action("buy", 1, status=409)
        self.assertIsNone(self.action("cancel")["pending"])
        self.action("buy", 78)
        result = self.action("next")
        self.assertEqual(result["trades"][-1]["status"], "rejected")
        self.assertEqual(result["cash"], 10_000_000)
        self.assertEqual(self.client.get(f"/api/replays/{uuid4()}").status_code, 404)

    def test_stock_specific_prices_and_session_isolation(self):
        setup = self.client.get("/api/setup").json()
        self.assertEqual(len(setup["stocks"]), 10)
        reliance = self.start(challenge=True)
        reliance_path = self.path
        for stock in setup["stocks"]:
            state = self.start(challenge=True, symbol=stock["symbol"])
            self.assertEqual(state["symbol"], stock["symbol"])
            self.assertEqual(state["candles"][-1]["date"], "2025-01-10")
            self.action("buy", 1)
            filled = self.action("next")
            self.assertEqual(filled["trades"][0]["price"], app.price(stock["symbol"], state["index"] + 1, "open"))
            self.assertEqual(filled["shares"], 1)
        self.assertEqual(self.client.get(reliance_path).json(), reliance)

    def test_legacy_reliance_session(self):
        state = {
            "index": 7, "start": 7, "end": 17, "challenge": True,
            "cash": 10_000_000, "shares": 0, "pending": None, "trades": [],
            "benchmark_cash": 37_000, "benchmark_shares": 81,
        }
        session_id = str(uuid4())
        with closing(app.connect()) as connection:
            connection.execute("INSERT INTO sessions VALUES (?, ?)", (session_id, json.dumps(state)))
        self.path = "/api/replays/" + session_id
        restored = self.client.get(self.path).json()
        self.assertEqual((restored["symbol"], restored["date"], restored["end_date"]),
                         ("RELIANCE", "2025-01-10", "2025-01-24"))
        self.assertEqual(self.action("next")["date"], "2025-01-13")

    def test_full_history_bounds(self):
        stocks = self.client.get("/api/setup").json()["stocks"]
        self.assertEqual(stocks[0]["dates"][0], "1996-01-01")
        for stock in stocks:
            dates = stock["dates"]
            self.assertGreater(len(dates), 5_000)
            self.assertEqual(dates, sorted(set(dates)))
            first = self.start(symbol=stock["symbol"], start=dates[0])
            self.assertEqual([row["date"] for row in first["candles"]], dates[:1])
            last = self.start(symbol=stock["symbol"], start=dates[-1])
            self.assertEqual(self.action("next")["date"], last["end_date"])
            self.action("next", status=409)

    def test_frontend_assets(self):
        for path in ("/", "/style.css", "/app.js"):
            self.assertEqual(self.client.get(path).status_code, 200)


if __name__ == "__main__":
    main()
