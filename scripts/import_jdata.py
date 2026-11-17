import argparse
import csv
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

FIELDS = "date open high low close volume".split()
INDIA = timezone(timedelta(hours=5, minutes=30))
SYMBOLS = "RELIANCE SBIN TCS INFY HDFCBANK ICICIBANK ITC LT AXISBANK BHARTIARTL".split()


def trading_date(value):
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        stamp = datetime.fromisoformat(value)
        return (stamp.astimezone(INDIA) if stamp.tzinfo else stamp).date().isoformat()


def normalize(source, symbol):
    rows = {}
    with source.open(newline="", encoding="utf-8-sig") as stream:
        for raw in csv.DictReader(stream):
            row = {key.strip().upper(): value.strip() for key, value in raw.items()}
            if row["SERIES"] != "EQ":
                continue
            if row["SYMBOL"] != symbol:
                raise ValueError(f"{source}: unexpected symbol {row['SYMBOL']}")
            day = trading_date(row["DATE"])
            o, h, l, c = [Decimal(row[key.upper()]) for key in FIELDS[1:5]]
            volume = int(row["VOLUME"])
            if day in rows or not (0 < l <= min(o, c) <= max(o, c) <= h) or volume <= 0:
                raise ValueError(f"{source}: invalid or duplicate row for {day}")
            if any(value * 100 != int(value * 100) for value in (o, h, l, c)):
                raise ValueError(f"{source}: unexpected price precision for {day}")
            rows[day] = (day, o, h, l, c, volume)
    dates = sorted(rows)
    if "2025-01-10" not in rows or len(dates) - dates.index("2025-01-10") <= 10:
        raise ValueError(f"{source}: include January 2025 and all ten challenge sessions")
    return rows


def compare(rows, official):
    count = 0
    with official.open(newline="", encoding="utf-8-sig") as stream:
        for row in csv.DictReader(stream):
            day = row["date"]
            expected = (day, *(Decimal(row[key]) for key in FIELDS[1:5]), int(row["volume"]))
            if rows.get(day) != expected:
                raise ValueError(f"{official.name} {day}: JData {rows.get(day)} differs from NSE {expected}")
            count += 1
    return count


def main():
    parser = argparse.ArgumentParser(description="Normalize ten JData EQ exports for PaperTrade.")
    parser.add_argument("source", type=Path, help="Directory containing SYMBOL.csv exports")
    parser.add_argument("--official", type=Path, help="Directory of official normalized NSE reference CSVs")
    parser.add_argument("--output", type=Path, default=Path("data"))
    args = parser.parse_args()
    exports = {symbol: normalize(args.source / f"{symbol}.csv", symbol) for symbol in SYMBOLS}
    if args.official:
        for symbol, rows in exports.items():
            count = compare(rows, args.official / f"{symbol}.csv")
            print(f"{symbol}: {count} rows matched official NSE dates, OHLC and volume")
    args.output.mkdir(parents=True, exist_ok=True)
    for symbol, rows in exports.items():
        filename = "reliance.csv" if symbol == "RELIANCE" else f"{symbol}.csv"
        with (args.output / filename).open("w", newline="", encoding="utf-8") as stream:
            writer = csv.writer(stream)
            writer.writerow(FIELDS)
            writer.writerows(rows[day] for day in sorted(rows))
        print(f"{symbol}: {len(rows)} sessions, {min(rows)} to {max(rows)}")


if __name__ == "__main__":
    main()
