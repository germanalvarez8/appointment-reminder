// Módulo de parseo: interpreta texto en español y extrae fecha/hora
import * as chrono from 'chrono-node'

const TIMEZONE = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires'

// Devuelve { date: Date, description: string } o null si no se pudo parsear
export function parseReminder(text) {
  // chrono-node en español con zona horaria Argentina (UTC-3)
  const referenceDate = new Date()
  const results = chrono.es.parse(text, referenceDate, { forwardDate: true })

  if (!results || results.length === 0) return null

  const result = results[0]
  const date = result.start.date()

  // Si no se especificó hora, default a las 9:00am
  if (!result.start.isCertain('hour')) {
    date.setHours(9, 0, 0, 0)
  }

  // La descripción es el texto sin la parte de la fecha
  const description = text
    .replace(result.text, '')
    .replace(/^\s*[-–,]\s*/, '')
    .trim()
    || text.trim()

  return { date, description }
}

// Formatea una fecha para mostrar al usuario (ej: "mañana 15/04 a las 10:00hs")
export function formatDate(date) {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const timeStr = `${hours}:${minutes}hs`
  const dateStr = `${day}/${month}`

  // Etiqueta relativa para mayor claridad
  const isToday = date.toDateString() === now.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  let label = ''
  if (isToday) label = 'hoy'
  else if (isTomorrow) label = 'mañana'

  return label ? `${label} ${dateStr} a las ${timeStr}` : `${dateStr} a las ${timeStr}`
}
