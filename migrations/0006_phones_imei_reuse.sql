-- Phone Fantasy — allow the same IMEI to be entered again after that phone
-- has been sold (e.g. bought back, or a fresh restock of a returned unit).
-- SQLite can't drop an inline UNIQUE constraint with ALTER TABLE, so the
-- table is rebuilt without it; a partial unique index then enforces the
-- real rule: "no two currently-UNSOLD rows may share an IMEI".

CREATE TABLE phones_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_model TEXT NOT NULL,
  imei TEXT NOT NULL,
  buy_price REAL NOT NULL,
  buy_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  status TEXT NOT NULL DEFAULT 'unsold',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  ram_rom TEXT,
  bought_from TEXT,
  phone_number TEXT,
  nid TEXT
);

INSERT INTO phones_new
  (id, name_model, imei, buy_price, buy_date, status, created_at, ram_rom, bought_from, phone_number, nid)
SELECT
  id, name_model, imei, buy_price, buy_date, status, created_at, ram_rom, bought_from, phone_number, nid
FROM phones;

DROP TABLE phones;
ALTER TABLE phones_new RENAME TO phones;

CREATE UNIQUE INDEX IF NOT EXISTS idx_phones_imei_unsold ON phones(imei) WHERE status = 'unsold';
CREATE INDEX IF NOT EXISTS idx_phones_status ON phones(status);
CREATE INDEX IF NOT EXISTS idx_phones_imei ON phones(imei);
