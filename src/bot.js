// Módulo del bot: maneja todos los comandos y mensajes de Telegram
import TelegramBot from 'node-telegram-bot-api'
import { parseReminder, formatDate } from './parser.js'
import { saveReminder, listReminders, deleteReminder } from './db.js'

// Estado temporal por chat para el flujo de confirmación
// { chatId: { description, date } }
const pendingConfirmations = new Map()

export function createBot(token) {
  const bot = new TelegramBot(token, { polling: true })

  // /start - bienvenida
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(
      chatId,
      `¡Hola! Soy tu bot de recordatorios. 🗓\n\n` +
      `Escribime un evento en lenguaje natural, por ejemplo:\n` +
      `  • "mañana turno médico a las 10"\n` +
      `  • "el viernes reunión con el cliente a las 15hs"\n` +
      `  • "en 3 días pagar el alquiler"\n\n` +
      `Comandos disponibles:\n` +
      `/list — ver recordatorios pendientes\n` +
      `/delete ID — eliminar un recordatorio`
    )
  })

  // /list - listar recordatorios pendientes
  bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id
    try {
      const reminders = await listReminders(chatId)

      if (reminders.length === 0) {
        return bot.sendMessage(chatId, 'No tenés recordatorios pendientes.')
      }

      const lines = reminders.map((r) => {
        const fecha = formatDate(new Date(r.reminder_at))
        return `• [#${r.id}] ${r.description} — ${fecha}`
      })

      bot.sendMessage(chatId, `Tus recordatorios pendientes:\n\n${lines.join('\n')}`)
    } catch (err) {
      console.error('Error en /list:', err.message)
      bot.sendMessage(chatId, 'Hubo un error al obtener tus recordatorios. Intentá de nuevo.')
    }
  })

  // /delete ID - eliminar recordatorio
  bot.onText(/\/delete (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const id = parseInt(match[1], 10)

    try {
      await deleteReminder(id, chatId)
      bot.sendMessage(chatId, `Recordatorio #${id} eliminado.`)
    } catch (err) {
      console.error('Error en /delete:', err.message)
      bot.sendMessage(chatId, `No encontré el recordatorio #${id} o no te pertenece.`)
    }
  })

  // Mensajes de texto libre: flujo de creación de recordatorio
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id
    const text = msg.text?.trim()

    // Ignorar comandos
    if (!text || text.startsWith('/')) return

    // Flujo de confirmación: el usuario respondió "sí" o "no"
    if (pendingConfirmations.has(chatId)) {
      const pending = pendingConfirmations.get(chatId)
      const lower = text.toLowerCase()

      if (['si', 'sí', 's', 'yes', 'ok', 'dale', 'correcto'].some(w => lower.includes(w))) {
        pendingConfirmations.delete(chatId)
        try {
          const saved = await saveReminder({
            chatId,
            description: pending.description,
            reminderAt: pending.date.toISOString(),
          })
          bot.sendMessage(chatId, `Guardado con ID #${saved.id}. Te aviso el día indicado.`)
        } catch (err) {
          console.error('Error guardando recordatorio:', err.message)
          bot.sendMessage(chatId, 'Hubo un error al guardar. Intentá de nuevo.')
        }
      } else if (['no', 'n', 'cancelar', 'cancel'].some(w => lower.includes(w))) {
        pendingConfirmations.delete(chatId)
        bot.sendMessage(chatId, 'Cancelado. Podés volver a escribirme el recordatorio cuando quieras.')
      } else {
        bot.sendMessage(chatId, 'Respondé "sí" para confirmar o "no" para cancelar.')
      }
      return
    }

    // Parsear el mensaje como un nuevo recordatorio
    const parsed = parseReminder(text)

    if (!parsed) {
      bot.sendMessage(
        chatId,
        'No pude entender la fecha. Intentá algo como:\n"mañana reunión a las 10" o "el viernes a las 15hs turno"'
      )
      return
    }

    const { date, description } = parsed
    const fechaFormateada = formatDate(date)

    // Guardar en estado temporal y pedir confirmación
    pendingConfirmations.set(chatId, { description, date })

    bot.sendMessage(
      chatId,
      `*${description}* — ${fechaFormateada}\n\n¿Es correcto? (sí / no)`,
      { parse_mode: 'Markdown' }
    )
  })

  return bot
}
