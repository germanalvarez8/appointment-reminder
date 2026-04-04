// Módulo del bot: maneja todos los comandos y mensajes de Telegram
import TelegramBot from 'node-telegram-bot-api'
import { parseReminder, parseCompletedIds, formatDate } from './parser.js'
import { saveReminder, listReminders, deleteReminder, markAsCompleted, createNextOccurrence, snoozeReminder } from './db.js'

// Estado temporal por chat para el flujo de confirmación
// { chatId: { description, context, eventAt, reminderAt, recurrenceDays } }
const pendingConfirmations = new Map()

function isCompletionMessage(text) {
  return /\b(listo[s]?|lista[s]?|hecho[s]?|hecha[s]?|complet[aoóe]|termin[aoóe]|ya (lo )?hice|ya (lo )?hizo|done|marcá|marca)\b/i.test(text)
}

function recurrenceLabel(days) {
  if (!days) return null
  if (days === 1) return 'todos los días'
  if (days === 7) return 'todas las semanas'
  if (days === 14) return 'cada dos semanas'
  if (days === 30) return 'todos los meses'
  return `cada ${days} días`
}

const CONFIRM_KEYBOARD = {
  inline_keyboard: [[
    { text: '✅ Confirmar', callback_data: 'confirm_yes' },
    { text: '❌ Cancelar', callback_data: 'confirm_no' },
  ]],
}

export function createBot(token) {
  const bot = new TelegramBot(token, { polling: true })

  // /start - bienvenida
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(
      chatId,
      `¡Hola! Soy tu bot de recordatorios.\n\n` +
      `Escribime el evento y cuándo querés que te avise, por ejemplo:\n` +
      `  • "El miércoles a las 15 debo responder al grupo de OPS, recuerdame una hora antes"\n` +
      `  • "Llamar a Banco Galicia — 0800-333-1254, mañana a las 10"\n` +
      `  • "Todos los lunes a las 9 revisar métricas"\n\n` +
      `Para marcar como listo:\n` +
      `  • "Listo el #3" o "Listos los puntos 1, 4 y 7"\n\n` +
      `Comandos:\n` +
      `/list — recordatorios pendientes\n` +
      `/done ID... — marcar como listos\n` +
      `/delete ID — eliminar`
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
        const status = r.notified ? '🔔' : '⏳'
        const aviso = formatDate(new Date(r.reminder_at))
        const evento = r.event_at ? `\n  Evento: ${formatDate(new Date(r.event_at))}` : ''
        const ctx = r.context ? `\n  📎 ${r.context}` : ''
        const recurrence = r.recurrence_days ? `\n  Repite: ${recurrenceLabel(r.recurrence_days)}` : ''
        return `${status} [#${r.id}] ${r.description}\n  Aviso: ${aviso}${evento}${ctx}${recurrence}`
      })

      bot.sendMessage(chatId, `Tus recordatorios pendientes:\n\n${lines.join('\n\n')}`)
    } catch (err) {
      console.error('Error en /list:', err.message)
      bot.sendMessage(chatId, 'Hubo un error al obtener tus recordatorios. Intentá de nuevo.')
    }
  })

  // /done ID ID... - marcar como listos por ID
  bot.onText(/\/done (.+)/, async (msg, match) => {
    const chatId = msg.chat.id
    const ids = match[1].split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n > 0)

    if (ids.length === 0) {
      return bot.sendMessage(chatId, 'Indicá los IDs a marcar. Ej: /done 3 o /done 1 4 7')
    }

    try {
      const updated = await markAsCompleted(ids, chatId)
      for (const r of updated) {
        if (r.recurrence_days) await createNextOccurrence(r)
      }
      bot.sendMessage(chatId, `Marcados como listos: ${updated.map(r => `#${r.id}`).join(', ')}`)
    } catch (err) {
      console.error('Error en /done:', err.message)
      bot.sendMessage(chatId, 'Hubo un error al marcar los recordatorios.')
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

  // Botones inline: confirmación, ✅ Listo, ⏰ Snooze
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id
    const messageId = query.message.message_id
    const data = query.data

    try {
      if (data === 'confirm_yes') {
        const pending = pendingConfirmations.get(chatId)
        if (!pending) {
          return bot.answerCallbackQuery(query.id, { text: 'Esta confirmación ya expiró.' })
        }
        pendingConfirmations.delete(chatId)

        const saved = await saveReminder({
          chatId,
          description: pending.description,
          context: pending.context,
          eventAt: pending.eventAt.toISOString(),
          reminderAt: pending.reminderAt.toISOString(),
          recurrenceDays: pending.recurrenceDays,
        })
        const recurMsg = saved.recurrence_days ? ` Se repite ${recurrenceLabel(saved.recurrence_days)}.` : ''
        await bot.answerCallbackQuery(query.id, { text: `Guardado #${saved.id}` })
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId })
        bot.sendMessage(chatId, `Guardado con ID #${saved.id}.${recurMsg} Te aviso en el momento indicado.`)

      } else if (data === 'confirm_no') {
        pendingConfirmations.delete(chatId)
        await bot.answerCallbackQuery(query.id, { text: 'Cancelado' })
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId })

      } else if (data.startsWith('done_')) {
        const id = parseInt(data.split('_')[1], 10)
        const updated = await markAsCompleted([id], chatId)

        let toastText = '✅ Marcado como listo'
        for (const r of updated) {
          if (r.recurrence_days) {
            const next = await createNextOccurrence(r)
            toastText = `✅ Listo. Próximo aviso: ${formatDate(new Date(next.reminder_at))}`
          }
        }

        await bot.answerCallbackQuery(query.id, { text: toastText })
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId })

      } else if (data.startsWith('snooze_')) {
        const parts = data.split('_')
        const minutes = parseInt(parts[1], 10)
        const id = parseInt(parts[2], 10)

        await snoozeReminder(id, chatId, minutes)

        const label = minutes < 60 ? `${minutes} min` : minutes === 60 ? '1 hora' : 'mañana'
        await bot.answerCallbackQuery(query.id, { text: `⏰ Pospuesto ${label}` })
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId })
      }
    } catch (err) {
      console.error('Error en callback_query:', err.message)
      await bot.answerCallbackQuery(query.id, { text: 'Hubo un error. Intentá de nuevo.' })
    }
  })

  // Mensajes de texto libre
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id
    const text = msg.text?.trim()

    if (!text || text.startsWith('/')) return

    // Flujo de confirmación activo por texto (fallback si el usuario escribe en lugar de tocar el botón)
    if (pendingConfirmations.has(chatId)) {
      const lower = text.toLowerCase()
      if (['si', 'sí', 's', 'yes', 'ok', 'dale', 'correcto'].some(w => lower.includes(w))) {
        // Simular tap en confirmar
        const pending = pendingConfirmations.get(chatId)
        pendingConfirmations.delete(chatId)
        try {
          const saved = await saveReminder({
            chatId,
            description: pending.description,
            context: pending.context,
            eventAt: pending.eventAt.toISOString(),
            reminderAt: pending.reminderAt.toISOString(),
            recurrenceDays: pending.recurrenceDays,
          })
          const recurMsg = saved.recurrence_days ? ` Se repite ${recurrenceLabel(saved.recurrence_days)}.` : ''
          bot.sendMessage(chatId, `Guardado con ID #${saved.id}.${recurMsg} Te aviso en el momento indicado.`)
        } catch (err) {
          console.error('Error guardando recordatorio:', err.message)
          bot.sendMessage(chatId, 'Hubo un error al guardar. Intentá de nuevo.')
        }
      } else if (['no', 'n', 'cancelar', 'cancel'].some(w => lower.includes(w))) {
        pendingConfirmations.delete(chatId)
        bot.sendMessage(chatId, 'Cancelado.')
      } else {
        bot.sendMessage(chatId, 'Usá los botones para confirmar o cancelar.')
      }
      return
    }

    // Detectar si el mensaje indica que algo fue completado
    if (isCompletionMessage(text)) {
      try {
        const reminders = await listReminders(chatId)
        if (reminders.length === 0) {
          return bot.sendMessage(chatId, 'No tenés recordatorios pendientes para marcar.')
        }

        const ids = await parseCompletedIds(text, reminders)
        if (ids.length === 0) {
          return bot.sendMessage(chatId, 'No pude identificar qué recordatorios marcar. Usá /list para ver los IDs y luego /done ID.')
        }

        const updated = await markAsCompleted(ids, chatId)
        for (const r of updated) {
          if (r.recurrence_days) await createNextOccurrence(r)
        }
        bot.sendMessage(chatId, `Marcados como listos:\n${updated.map(r => `#${r.id} ${r.description}`).join('\n')}`)
      } catch (err) {
        console.error('Error marcando completados:', err.message)
        bot.sendMessage(chatId, 'Hubo un error al marcar los recordatorios.')
      }
      return
    }

    // Parsear como nuevo recordatorio
    const parsed = await parseReminder(text)

    if (!parsed) {
      bot.sendMessage(chatId, 'No pude interpretar el mensaje. Intentá algo como:\n"El miércoles a las 15 debo responder al grupo de OPS, recuerdame una hora antes"')
      return
    }

    const { description, context, eventAt, reminderAt, recurrenceDays } = parsed
    const sameTime = Math.abs(eventAt - reminderAt) < 60000
    const contextLine = context ? `\n📎 ${context}` : ''
    const recurrLine = recurrenceDays ? `\nRepite: ${recurrenceLabel(recurrenceDays)}` : ''

    const confirmMsg = sameTime
      ? `*${description}*${contextLine}\nEvento: ${formatDate(eventAt)}${recurrLine}`
      : `*${description}*${contextLine}\nEvento: ${formatDate(eventAt)}\nAviso: ${formatDate(reminderAt)}${recurrLine}`

    pendingConfirmations.set(chatId, { description, context, eventAt, reminderAt, recurrenceDays })
    bot.sendMessage(chatId, confirmMsg, { parse_mode: 'Markdown', reply_markup: CONFIRM_KEYBOARD })
  })

  return bot
}
