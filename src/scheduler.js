// Scheduler: revisa cada minuto si hay recordatorios pendientes y los envía
import { getPendingNotifications, markAsNotified } from './db.js'

const POLL_INTERVAL_MS = 60 * 1000 // 1 minuto

export function startScheduler(bot) {
  console.log('Scheduler iniciado: revisando recordatorios cada 60 segundos')

  setInterval(async () => {
    try {
      const pending = await getPendingNotifications()

      for (const reminder of pending) {
        try {
          await bot.sendMessage(
            reminder.chat_id,
            `🔔 Recordatorio: *${reminder.description}*`,
            { parse_mode: 'Markdown' }
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
