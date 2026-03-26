# Appointment Reminder Bot

Bot de Telegram para recordatorios personales en español, con Supabase como base de datos.

## Requisitos previos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- Cuenta en Telegram

---

## 1. Crear el bot en Telegram

1. Abrí Telegram y buscá **@BotFather**
2. Mandá `/newbot` y seguí las instrucciones
3. Al final te da un token como `123456:ABC-DEF...`. Copialo, es tu `TELEGRAM_BOT_TOKEN`
4. Para obtener tu `TELEGRAM_CHAT_ID`: buscá **@userinfobot** en Telegram y mandá cualquier mensaje. Te responde con tu ID numérico.

---

## 2. Configurar Supabase

1. Creá un proyecto nuevo en [supabase.com](https://supabase.com)
2. Andá a **SQL Editor** y ejecutá el contenido de `supabase/schema.sql`
3. Andá a **Settings > API** y copiá:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`

---

## 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editá `.env` con tus valores:

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
TIMEZONE=America/Argentina/Buenos_Aires
```

---

## 4. Instalar dependencias y correr

```bash
npm install
npm start
```

Para desarrollo con recarga automática:
```bash
npm run dev
```

---

## 5. Uso del bot

Escribile al bot en lenguaje natural:

- `mañana turno médico a las 10`
- `el viernes reunión con el cliente a las 15hs`
- `en 3 días pagar el alquiler`

El bot confirma la fecha interpretada y pregunta si es correcto antes de guardar.

**Comandos:**
- `/start` — instrucciones
- `/list` — ver recordatorios pendientes
- `/delete 5` — eliminar el recordatorio con ID 5

---

## 6. Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create appointment-reminder --private --source=. --push
```

O si preferís hacerlo desde la web de GitHub: creá el repo vacío y luego:

```bash
git remote add origin https://github.com/TU_USUARIO/appointment-reminder.git
git push -u origin main
```

---

## Notas técnicas

- El scheduler corre cada 60 segundos y envía los recordatorios cuya hora ya pasó
- La zona horaria usada es `America/Argentina/Buenos_Aires` (UTC-3)
- Si no se especifica hora al crear un recordatorio, se usa las 9:00am por defecto
- Los recordatorios se guardan en UTC en Supabase; la conversión la hace `chrono-node` al parsear
