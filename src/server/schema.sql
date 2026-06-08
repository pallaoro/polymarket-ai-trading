-- Paper (and, when enabled, live) trade ledger. One row per position.
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL DEFAULT 'paper',        -- paper | live
  market_id TEXT NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  side TEXT NOT NULL,                         -- YES | NO
  entry_price REAL NOT NULL,
  size_usd REAL NOT NULL,
  shares REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',        -- open | closed
  pnl REAL NOT NULL DEFAULT 0,
  exit_price REAL,
  current_price REAL,                         -- last mark-to-market price (open positions)
  ai_confidence REAL,
  reason TEXT NOT NULL DEFAULT '',
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_opened ON trades(opened_at);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);

-- Single-row strategy + safety configuration (id is always 1).
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'paper',
  bankroll REAL NOT NULL DEFAULT 1000,
  kelly_fraction REAL NOT NULL DEFAULT 0.25,
  max_positions INTEGER NOT NULL DEFAULT 10,
  max_position_usd REAL NOT NULL DEFAULT 100,
  max_exposure_usd REAL NOT NULL DEFAULT 600,
  min_volume_usd REAL NOT NULL DEFAULT 10000,
  favorite_threshold REAL NOT NULL DEFAULT 0.75,
  longshot_min REAL NOT NULL DEFAULT 0.05,
  longshot_max REAL NOT NULL DEFAULT 0.2,
  ai_gating INTEGER NOT NULL DEFAULT 1,
  kill_switch INTEGER NOT NULL DEFAULT 0
);
