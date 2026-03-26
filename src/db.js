// Módulo de base de datos: todas las operaciones con Supabase
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// Guarda un nuevo recordatorio en la base de datos
export async function saveReminder({ chatId, description, reminderAt }) {
  const { data, error } = await supabase
    .from('reminders')
    .insert([{ chat_id: chatId, description, reminder_at: reminderAt, notified: false }])
    .select()
    .single()

  if (error) throw error
  return data
}

// Devuelve todos los recordatorios pendientes (no notificados) de un chat
export async function listReminders(chatId) {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('chat_id', chatId)
    .eq('notified', false)
    .order('reminder_at', { ascending: true })

  if (error) throw error
  return data
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

// Devuelve recordatorios que ya vencieron y no fueron notificados (para el scheduler)
export async function getPendingNotifications() {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('notified', false)
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
