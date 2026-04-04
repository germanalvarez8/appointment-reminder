// Módulo de parseo: usa Claude para interpretar eventos y recordatorios en español
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()
const TIMEZONE = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires'

function nowInArgentina() {
  return new Date().toLocaleString('es-AR', {
    timeZone: TIMEZONE,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Devuelve { description, eventAt: Date, reminderAt: Date } o null
export async function parseReminder(text) {
  const prompt = `La fecha y hora actual en Argentina es: ${nowInArgentina()}

El usuario escribió: "${text}"

Extraé la información y respondé SOLO con JSON válido, sin explicaciones ni markdown:
{
  "description": "descripción breve del evento (qué hay que hacer, sin datos de contacto ni links)",
  "context": "información adicional: teléfono, URL, número de caso, notas — o null si no hay",
  "eventAt": "fecha/hora del evento en ISO 8601 con offset -03:00",
  "reminderAt": "fecha/hora para enviar el aviso en ISO 8601 con offset -03:00",
  "recurrenceDays": null
}

Reglas:
- "description": solo el qué, sin detalles técnicos. Ej: "Llamar a Banco Galicia", "Turno médico"
- "context": todo lo extra útil. Ej: "0800-333-1254", "https://...", "Caso #4421", null
- "eventAt": cuándo ocurre el evento (la primera ocurrencia si es recurrente)
- "reminderAt": cuándo avisar. Si el usuario dice "X tiempo antes", restá ese tiempo de eventAt. Si no especifica, igual a eventAt
- "recurrenceDays": días entre repeticiones. null si no es recurrente. Ejemplos:
    "todos los días" / "diariamente" → 1
    "todas las semanas" / "todos los lunes" / "cada semana" → 7
    "cada dos semanas" / "quincenal" → 14
    "todos los meses" / "mensualmente" → 30
- Zona horaria Argentina, offset -03:00 (no usar Z ni otro offset)
- Si no se especifica hora del evento, usar 09:00-03:00
- "el miércoles próximo", "este miércoles" = el miércoles más cercano hacia adelante
- Si no podés interpretar el mensaje, respondé exactamente: null`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].text.trim()
    // Remover bloques de código markdown si Claude los incluyó (ej: ```json ... ```)
    const content = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    console.log('[parser] Respuesta de Claude:', content)
    if (content === 'null') return null

    const parsed = JSON.parse(content)
    if (!parsed?.eventAt || !parsed?.reminderAt) return null

    return {
      description: parsed.description || text.trim(),
      context: parsed.context || null,
      eventAt: new Date(parsed.eventAt),
      reminderAt: new Date(parsed.reminderAt),
      recurrenceDays: parsed.recurrenceDays || null,
    }
  } catch (err) {
    console.error('[parser] Error al interpretar mensaje:', err.message)
    return null
  }
}

// Dado un mensaje del usuario y la lista de recordatorios actuales, devuelve los IDs a marcar como completados
export async function parseCompletedIds(text, reminders) {
  if (reminders.length === 0) return []

  const list = reminders.map(r => `#${r.id}: ${r.description}`).join('\n')

  const prompt = `El usuario quiere marcar recordatorios como completados.

Recordatorios disponibles:
${list}

El usuario escribió: "${text}"

Respondé SOLO con un array JSON de los IDs numéricos a marcar como listos, sin explicaciones ni markdown.
Ejemplos válidos: [1] o [1, 4, 7] o []
Si no podés determinar cuáles marcar, respondé: []`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].text.trim()
    const content = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    console.log('[parser] IDs completados de Claude:', content)
    const ids = JSON.parse(content)
    if (!Array.isArray(ids)) return []
    return ids.filter(id => typeof id === 'number')
  } catch (err) {
    console.error('[parser] Error al interpretar IDs completados:', err.message)
    return []
  }
}

function getPartsInTz(date) {
  const parts = {}
  for (const { type, value } of new Intl.DateTimeFormat('es-AR', {
    timeZone: TIMEZONE,
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)) {
    parts[type] = value
  }
  return parts
}

// Formatea una fecha en zona horaria Argentina (ej: "mañana 02/04 a las 14:00hs")
export function formatDate(date) {
  const now = new Date()
  const toDay = (d) => new Date(d).toLocaleDateString('es-AR', { timeZone: TIMEZONE })

  const isToday = toDay(date) === toDay(now)
  const isTomorrow = toDay(date) === toDay(new Date(now.getTime() + 86400000))

  const { day, month, hour, minute } = getPartsInTz(date)
  const timeStr = `${hour}:${minute}hs`
  const dateStr = `${day}/${month}`

  if (isToday) return `hoy ${dateStr} a las ${timeStr}`
  if (isTomorrow) return `mañana ${dateStr} a las ${timeStr}`
  return `${dateStr} a las ${timeStr}`
}
