-- 🔧 Tabelul pentru mașini înregistrate
CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  car_name TEXT NOT NULL,
  color TEXT NOT NULL,
  plate TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 📋 Tabelul pentru tickete (amenzi)
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  reason TEXT NOT NULL,
  proof_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ⚠️ Tabelul pentru loguri staff
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 👮‍♂️ Tabelul pentru shift-urile active
CREATE TABLE IF NOT EXISTS shifts (
  user_id TEXT PRIMARY KEY,
  department TEXT NOT NULL
);
