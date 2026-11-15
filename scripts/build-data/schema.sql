-- dict.db のスキーマ（docs/requirements.md §5.1）。
-- 生成スクリプトとテストの両方がこのファイルを読む。

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE municipalities (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kana TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ward','city'))
);

CREATE TABLE stations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kana TEXT NOT NULL,
  municipality_code TEXT NOT NULL REFERENCES municipalities(code),
  lines TEXT
);
CREATE INDEX idx_stations_name ON stations(name);
CREATE INDEX idx_stations_kana ON stations(kana);

CREATE TABLE towns (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kana TEXT NOT NULL,
  municipality_code TEXT NOT NULL REFERENCES municipalities(code)
);
CREATE INDEX idx_towns_name ON towns(name);
CREATE INDEX idx_towns_kana ON towns(kana);
