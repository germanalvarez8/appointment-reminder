-- Tabla principal de recordatorios
CREATE TABLE IF NOT EXISTS reminders (
  id          BIGSERIAL PRIMARY KEY,
  chat_id     BIGINT        NOT NULL,           -- ID del chat de Telegram
  description TEXT          NOT NULL,           -- Texto del recordatorio
  event_at    TIMESTAMPTZ,                      -- Cuándo ocurre el evento (puede ser null para recordatorios sin evento)
  reminder_at TIMESTAMPTZ   NOT NULL,           -- Cuándo enviar el aviso
  notified    BOOLEAN       NOT NULL DEFAULT FALSE, -- Si ya fue enviado
  completed       BOOLEAN       NOT NULL DEFAULT FALSE, -- Si el usuario lo marcó como listo
  recurrence_days INTEGER,                            -- Días entre repeticiones (null = no recurrente)
  context     TEXT,                                   -- Info adicional: teléfono, link, nota
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Si la tabla ya existe, agregar columnas nuevas si no están
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS event_at TIMESTAMPTZ;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recurrence_days INTEGER;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS context TEXT;

-- Índice para que el scheduler consulte rápido
CREATE INDEX IF NOT EXISTS idx_reminders_pending
  ON reminders (notified, reminder_at)
  WHERE notified = FALSE;
