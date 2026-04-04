// Módulo de base de datos: todas las operaciones con Supabase
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// Guarda un nuevo recordatorio en la base de datos
export async function saveReminder({ chatId, description, context, eventAt, reminderAt, recurrenceDays }) {
  const { data, error } = await supabase
    .from('reminders')
    .insert([{
      chat_id: chatId,
      description,
      context: context || null,
      event_at: eventAt,
      reminder_at: reminderAt,
      recurrence_days: recurrenceDays || null,
      notified: false,
      completed: false,
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// Devuelve todos los recordatorios no completados de un chat (incluyendo los ya notificados)
export async function listReminders(chatId) {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('chat_id', chatId)
    .eq('completed', false)
    .order('reminder_at', { ascending: true })

  if (error) throw error
  return data
}

// Devuelve todos los chat_ids con recordatorios pendientes (para el resumen diario)
export async function getActiveChatIds() {
  const { data, error } = await supabase
    .from('reminders')
    .select('chat_id')
    .eq('completed', false)

  if (error) throw error
  return [...new Set(data.map(r => r.chat_id))]
}

// Elimina un recordatorio por ID, verificando que pertenezca al chat
export async function deleteReminder(id, chatId) {
  const { data, error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('chat_id', chatId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Marca uno o varios recordatorios como completados, verificando pertenencia al chat
export async function markAsCompleted(ids, chatId) {
  const { data, error } = await supabase
    .from('reminders')
    .update({ completed: true })
    .in('id', ids)
    .eq('chat_id', chatId)
    .select()

  if (error) throw error
  return data
}

// Crea la próxima ocurrencia de un recordatorio recurrente
export async function createNextOccurrence(reminder) {
  const offsetMs = reminder.recurrence_days * 24 * 60 * 60 * 1000
  const nextReminderAt = new Date(new Date(reminder.reminder_at).getTime() + offsetMs).toISOString()
  const nextEventAt = reminder.event_at
    ? new Date(new Date(reminder.event_at).getTime() + offsetMs).toISOString()
    : null

  const { data, error } = await supabase
    .from('reminders')
    .insert([{
      chat_id: reminder.chat_id,
      description: reminder.description,
      context: reminder.context || null,
      event_at: nextEventAt,
      reminder_at: nextReminderAt,
      recurrence_days: reminder.recurrence_days,
      notified: false,
      completed: false,
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

// Pospone un recordatorio: actualiza reminder_at y lo desmarca como notificado
export async function snoozeReminder(id, chatId, minutes) {
  const newReminderAt = new Date(Date.now() + minutes * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('reminders')
    .update({ reminder_at: newReminderAt, notified: false })
    .eq('id', id)
    .eq('chat_id', chatId)

  if (error) throw error
}

// Devuelve recordatorios que ya vencieron y no fueron notificados (para el scheduler)
export async function getPendingNotifications() {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('notified', false)
    .eq('completed', false)
    .lte('reminder_at', now)

  if (error) throw error
  return data
}

// Marca un recordatorio como notificado
export async function markAsNotified(id) {
  const { error } = await supabase
    .from('reminders')
    .update({ notified: true })
    .eq('id', id)

  if (error) throw error
}
