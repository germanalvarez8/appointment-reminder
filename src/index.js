// Punto de entrada: carga env, inicializa bot y scheduler
import 'dotenv/config'
import { createBot } from './bot.js'
import { startScheduler } from './scheduler.js'

const { TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Falta TELEGRAM_BOT_TOKEN en .env')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en .env')
  process.exit(1)
}

const bot = createBot(TELEGRAM_BOT_TOKEN)
startScheduler(bot)

console.log('Bot iniciado y escuchando mensajes...')

// Manejo de errores no capturados para que el proceso no muera silenciosamente
process.on('unhandledRejection', (err) => {
  console.error('Error no manejado:', err)
})
