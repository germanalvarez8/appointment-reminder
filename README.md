# Barbara — Bot de recordatorios personales

Bot de Telegram para recordatorios personales en español. Interpreta lenguaje natural con Claude (Anthropic), guarda los datos en Supabase y envía notificaciones a través de Telegram.

## Funcionalidades

### Crear recordatorios
Escribís en lenguaje natural y el bot interpreta fecha, hora y aviso:

- `"El miércoles a las 15 debo responder al grupo de OPS, recuerdame una hora antes"`
- `"Mañana turno médico a las 10, avisame 30 minutos antes"`
- `"Llamar a Banco Galicia — 0800-333-1254, mañana a las 10"`

El bot muestra lo que interpretó y pedís confirmación con botones antes de guardar.

### Recordatorios recurrentes
Detecta automáticamente cuando algo se repite:

- `"Todos los lunes a las 9 revisar métricas"` → se repite cada 7 días
- `"El 1 de cada mes pagar el alquiler"` → se repite cada 30 días
- `"Todos los días a las 8 tomar medicación"` → se repite cada 1 día

Al marcar como listo un recordatorio recurrente, se crea automáticamente la próxima ocurrencia.

### Múltiples recordatorios en un mensaje
Un solo mensaje puede contener varios eventos:

- `"El martes me corto el pelo a las 10 y a las 19 debo entregar el reporte"`

El bot los detecta todos y los confirma juntos.

### Contexto adicional
Podés incluir información extra (teléfono, link, número de caso) y el bot la separa de la descripción:

- Descripción: `Llamar a Banco Galicia`
- Contexto: `0800-333-1254`

### Notificaciones con acciones
Cuando llega un aviso, podés responder con botones:

- **✅ Listo** — marca como completado (y crea la próxima ocurrencia si es recurrente)
- **⏰ 5 min / 1 hora / Mañana** — pospone el recordatorio

### Marcar como completado
Por texto o por comando:

- `"Listo el #3"`
- `"Listos los puntos 1, 4 y 7"`
- `/done 3` o `/done 1 4 7`

Claude interpreta a qué recordatorios te referís aunque no uses el ID exacto.

### Resumen diario
Todos los días a las 8:00am (hora Argentina) el bot envía un resumen con los recordatorios del día y los pendientes de días anteriores.

---

## Comandos disponibles

| Comando | Descripción |
|---|---|
| `/start` | Instrucciones y ejemplos de uso |
| `/list` | Ver todos los recordatorios pendientes |
| `/done 3` | Marcar el recordatorio #3 como listo |
| `/done 1 4 7` | Marcar varios como listos de una vez |
| `/delete 3` | Eliminar el recordatorio #3 |

---

## Requisitos previos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- API key de [Anthropic](https://console.anthropic.com) (Claude)
- Bot de Telegram creado vía @BotFather

---

## Instalación

### 1. Crear el bot en Telegram

1. Abrí Telegram y buscá **@BotFather**
2. Mandá `/newbot` y seguí las instrucciones
3. Copiá el token que te da → `TELEGRAM_BOT_TOKEN`
4. Para obtener tu chat ID: escribile a **@userinfobot** → `ALLOWED_CHAT_IDS`

### 2. Configurar Supabase

1. Creá un proyecto nuevo en [supabase.com](https://supabase.com)
2. Andá a **SQL Editor** y ejecutá el contenido de `supabase/schema.sql`
3. Andá a **Settings > API** y copiá:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`

### 3. Variables de entorno

```bash
cp .env.example .env
```

Editá `.env` con tus valores:

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
ALLOWED_CHAT_IDS=123456789
TIMEZONE=America/Argentina/Buenos_Aires
```

`ALLOWED_CHAT_IDS` acepta múltiples IDs separados por coma. Si se deja vacío, cualquier usuario puede interactuar con el bot.

### 4. Instalar y correr

```bash
npm install
npm start
```

Para desarrollo con recarga automática:
```bash
npm run dev
```

---

## Deploy en producción (EC2 + pm2)

```bash
# Instalar pm2 globalmente
npm install -g pm2

# Iniciar el bot
pm2 start src/index.js --name barbara

# Que sobreviva reinicios del servidor
pm2 save
pm2 startup

# Ver logs
pm2 logs barbara
```

Para actualizar después de un cambio:
```bash
git pull
npm install
pm2 restart barbara
```

---

## Agregar usuarios

1. El nuevo usuario le escribe a **@userinfobot** en Telegram para obtener su chat ID
2. Agregás ese ID a `ALLOWED_CHAT_IDS` en el `.env` del servidor (separado por coma)
3. `pm2 restart barbara`

---

## Notas técnicas

- El scheduler consulta Supabase cada 60 segundos para enviar notificaciones pendientes
- Las fechas se guardan en UTC en Supabase; la conversión a zona horaria Argentina la hace Claude al interpretar los mensajes
- Si no se especifica hora en un recordatorio, se usa las 9:00am por defecto
- El resumen diario usa memoria en proceso para evitar duplicados; si el servidor se reinicia durante las 8am, puede enviarse dos veces
- Los recordatorios recurrentes se crean como nuevas filas al marcar como listo, no como reglas que se expanden automáticamente
