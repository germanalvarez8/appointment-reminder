-- Tabla principal de recordatorios
CREATE TABLE IF NOT EXISTS reminders (
  id          BIGSERIAL PRIMARY KEY,
  chat_id     BIGINT        NOT NULL,           -- ID del chat de Telegram
  description TEXT          NOT NULL,           -- Texto del recordatorio
  reminder_at TIMESTAMPTZ   NOT NULL,           -- Fecha y hora del recordatorio (con zona horaria)
  notified    BOOLEAN       NOT NULL DEFAULT FALSE, -- Si ya fue enviado
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índice para que el scheduler consulte rápido
CREATE INDEX IF NOT EXISTS idx_reminders_pending
  ON reminders (notified, reminder_at)
  WHERE notified = FALSE;
