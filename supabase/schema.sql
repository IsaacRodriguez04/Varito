-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE account_type AS ENUM ('credit', 'debit', 'cash');
CREATE TYPE movement_type AS ENUM ('expense', 'income', 'saving', 'transfer');

-- ============================================================
-- PROFILES
-- ============================================================

CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own profile"
  ON profiles FOR ALL USING (auth.uid() = id);

-- ============================================================
-- ACCOUNTS (tarjetas, débito, efectivo)
-- ============================================================

CREATE TABLE accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  bank         TEXT,
  type         account_type NOT NULL,
  color        TEXT NOT NULL DEFAULT '#6366f1',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  credit_limit NUMERIC(12,2),
  cut_day      SMALLINT CHECK (cut_day BETWEEN 1 AND 31),
  days_to_due  SMALLINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own accounts"
  ON accounts FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '📦',
  color      TEXT NOT NULL DEFAULT '#6366f1',
  is_system  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own categories"
  ON categories FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_categories_user_id ON categories(user_id);

-- ============================================================
-- MOVEMENTS
-- ============================================================

CREATE TABLE movements (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date                   DATE NOT NULL,
  description            TEXT NOT NULL,
  type                   movement_type NOT NULL,
  category_id            UUID NOT NULL REFERENCES categories(id),
  account_id             UUID REFERENCES accounts(id),
  destination_account_id UUID REFERENCES accounts(id),
  amount                 NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  installments           SMALLINT NOT NULL DEFAULT 1
                           CHECK (installments IN (1,3,6,9,12,18,24)),
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own movements"
  ON movements FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_movements_user_id    ON movements(user_id);
CREATE INDEX idx_movements_date       ON movements(user_id, date DESC);
CREATE INDEX idx_movements_account_id ON movements(account_id);

-- ============================================================
-- INSTALLMENTS (cuotas MSI)
-- ============================================================

CREATE TABLE installments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id        UUID NOT NULL REFERENCES movements(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  installment_number SMALLINT NOT NULL,
  due_date           DATE NOT NULL,
  amount             NUMERIC(12,2) NOT NULL,
  is_paid            BOOLEAN NOT NULL DEFAULT false,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own installments"
  ON installments FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_installments_user_id    ON installments(user_id);
CREATE INDEX idx_installments_due_date   ON installments(user_id, due_date);
CREATE INDEX idx_installments_movement   ON installments(movement_id);
CREATE INDEX idx_installments_unpaid     ON installments(user_id, is_paid, due_date)
  WHERE is_paid = false;

-- ============================================================
-- PUSH SUBSCRIPTIONS
-- ============================================================

CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own push subscriptions"
  ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: crear perfil + categorías predefinidas al registrarse
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id UUID := NEW.id;
  user_name  TEXT := COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario');
BEGIN
  INSERT INTO profiles (id, name) VALUES (profile_id, user_name);

  INSERT INTO categories (user_id, name, icon, color, is_system) VALUES
    (profile_id, 'Alimentación',         '🍔', '#f97316', true),
    (profile_id, 'Transporte',           '🚗', '#3b82f6', true),
    (profile_id, 'Entretenimiento',      '🎬', '#a855f7', true),
    (profile_id, 'Salud',                '🏥', '#22c55e', true),
    (profile_id, 'Ropa y calzado',       '👕', '#ec4899', true),
    (profile_id, 'Servicios',            '💡', '#eab308', true),
    (profile_id, 'Educación',            '📚', '#06b6d4', true),
    (profile_id, 'Ahorro',               '🏦', '#14b8a6', true),
    (profile_id, 'Salario',              '💼', '#22c55e', true),
    (profile_id, 'Freelance',            '💻', '#6366f1', true),
    (profile_id, 'Transferencia propia', '🔄', '#94a3b8', true),
    (profile_id, 'Pago a tercero',       '💸', '#f43f5e', true),
    (profile_id, 'Otros',                '📦', '#64748b', true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNCIÓN: eliminar cuotas futuras al borrar un movimiento
-- (CASCADE en ON DELETE ya lo maneja; esta función es para
--  borrado parcial cuando se quieren conservar cuotas pagadas)
-- ============================================================

CREATE OR REPLACE FUNCTION delete_unpaid_installments(p_movement_id UUID, p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM installments
  WHERE movement_id = p_movement_id
    AND user_id     = p_user_id
    AND is_paid     = false;
END;
$$;
