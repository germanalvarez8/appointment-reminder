// Scheduler: revisa cada minuto si hay recordatorios pendientes y los envía
import { getPendingNotifications, markAsNotified, listReminders, getActiveChatIds } from './db.js'
import { formatDate } from './parser.js'

const POLL_INTERVAL_MS = 60 * 1000 // 1 minuto
const TIMEZONE = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires'

// Rastrea a qué chats ya se les envió el resumen hoy (se resetea al reiniciar, lo cual es aceptable)
const sentDailySummaries = new Set() // keys: `${chatId}_${YYYY-MM-DD}`

function nowInArt() {
  const parts = {}
  for (const { type, value } of new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())) {
    parts[type] = value
  }
  return parts
}

function todayDateStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE }) // YYYY-MM-DD
}

function formatTimeOnly(date) {
  const parts = {}
  for (const { type, value } of new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)) {
    parts[type] = value
  }
  return `${parts.hour}:${parts.minute}hs`
}

async function sendDailySummary(bot) {
  const chatIds = await getActiveChatIds()
  const today = todayDateStr()

  for (const chatId of chatIds) {
    const key = `${chatId}_${today}`
    if (sentDailySummaries.has(key)) continue

    sentDailySummaries.add(key)

    try {
      const all = await listReminders(chatId)
      if (all.length === 0) continue

      // Separar recordatorios de hoy vs vencidos
      const todayItems = all.filter(r => {
        const ref = r.event_at || r.reminder_at
        return new Date(ref).toLocaleDateString('en-CA', { timeZone: TIMEZONE }) === today
      })
      const overdueItems = all.filter(r => {
        const ref = r.event_at || r.reminder_at
        return new Date(ref).toLocaleDateString('en-CA', { timeZone: TIMEZONE }) < today
      })

      if (todayItems.length === 0 && overdueItems.length === 0) continue

      // Nombre del día en español
      const dayName = new Date().toLocaleDateString('es-AR', {
        timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long',
      })

      let msg = `☀️ *Resumen del día — ${dayName}*`

      if (todayItems.length > 0) {
        msg += '\n\n📅 *Hoy:*'
        for (const r of todayItems) {
          const time = formatTimeOnly(new Date(r.event_at || r.reminder_at))
          const ctx = r.context ? ` — ${r.context}` : ''
          msg += `\n• ${time} — ${r.description}${ctx}`
        }
      }

      if (overdueItems.length > 0) {
        msg += '\n\n⚠️ *Pendientes anteriores:*'
        for (const r of overdueItems) {
          const fecha = formatDate(new Date(r.event_at || r.reminder_at))
          const ctx = r.context ? ` — ${r.context}` : ''
          msg += `\n• [#${r.id}] ${r.description}${ctx} _(${fecha})_`
        }
      }

      await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' })
    } catch (err) {
      console.error(`Error enviando resumen diario a chat ${chatId}:`, err.message)
    }
  }
}

export function startScheduler(bot) {
  console.log('Scheduler iniciado: revisando recordatorios cada 60 segundos')

  setInterval(async () => {
    try {
      // Resumen diario a las 8:00am ART
      const { hour, minute } = nowInArt()
      if (hour === '08' && minute === '00') {
        await sendDailySummary(bot)
      }

      // Notificaciones pendientes
      const pending = await getPendingNotifications()

      for (const reminder of pending) {
        try {
          const eventoStr = reminder.event_at
            ? `\nEvento: ${formatDate(new Date(reminder.event_at))}`
            : ''
          const contextStr = reminder.context ? `\n📎 ${reminder.context}` : ''
          const recurrenceStr = reminder.recurrence_days
            ? `\n_Se repite cada ${reminder.recurrence_days} días_`
            : ''

          await bot.sendMessage(
            reminder.chat_id,
            `🔔 *${reminder.description}*${contextStr}${eventoStr}${recurrenceStr}`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ Listo', callback_data: `done_${reminder.id}` },
                  { text: '⏰ 5 min', callback_data: `snooze_5_${reminder.id}` },
                  { text: '⏰ 1 hora', callback_data: `snooze_60_${reminder.id}` },
                  { text: '⏰ Mañana', callback_data: `snooze_1440_${reminder.id}` },
                ]],
              },
            }
          )
          await markAsNotified(reminder.id)
          console.log(`Recordatorio #${reminder.id} enviado a chat ${reminder.chat_id}`)
        } catch (sendError) {
          console.error(`Error enviando recordatorio #${reminder.id}:`, sendError.message)
        }
      }
    } catch (err) {
      console.error('Error en scheduler al consultar Supabase:', err.message)
    }
  }, POLL_INTERVAL_MS)
}
