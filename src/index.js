import {
    fishing,
    claimFishing
} from './commands/fishing.js'
import {
    guess,
    handleGuess
} from './commands/guess.js'
import tttCommand from './commands/ttt.js'
import { ping } from './commands/ping.js'
import { dice } from './commands/dice.js'
import { sticker } from './commands/sticker.js'
import { tiktok } from './commands/tiktok.js'
import { mining } from './commands/mining.js'
import { sell } from './commands/sell.js'
import { inventory } from './commands/inventory.js'
import { hunt } from './commands/hunt.js'
import { job } from './commands/job.js'
import { top } from './commands/top.js'
import { sendMoney } from './commands/send.js'
import { coinflip } from './commands/coinflip.js'
import { balance } from './commands/balance.js'
import { register } from './commands/register.js'
import { daily } from './commands/daily.js'
import { menu } from './commands/menu.js'

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
} from '@whiskeysockets/baileys'

import qrcode from 'qrcode-terminal'
	const lastImages = new Map()

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')

    const sock = makeWASocket({
        auth: state
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log('Scan QR ini dengan WhatsApp:')
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'open') {
            console.log('WhatsApp berhasil terhubung!')
        }

        if (connection === 'close') {
            console.log('Koneksi WhatsApp terputus.')

            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

            if (shouldReconnect) {
                console.log('Mencoba reconnect...')
                startBot()
            } else {
                console.log('Bot logout. Silakan login ulang.')
            }
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
            const message = messages[0]

        if (!message.message) return
        if (message.key.fromMe) return

        // Simpan gambar terakhir
        if (message.message?.imageMessage) {
            const imageSender =
                message.key.participant || message.key.remoteJid

                console.log('🖼️ IMAGE FROM:', imageSender)

             lastImages.set(imageSender, message)
        }

                console.log('MESSAGE TYPE:', Object.keys(message.message))

            const text =
                message.message.conversation ||
                message.message.extendedTextMessage?.text ||
                message.message.imageMessage?.caption ||
            ''

        if (!text) return

                console.log('Pesan masuk:', text)

            const jid = message.key.remoteJid
            const sender = message.key.participant || jid

            const args = text.trim().split(/\s+/)
            const command = args.shift().toLowerCase()

        console.log('Command:', command)
        console.log('Arguments:', args)

        // command-command

        if (command === '.menu') {
            await menu(sock, jid, sender)
        }

        if (command === '.daily') {
            await daily(sock, jid, sender)
        }

        if (command === '.register') {
            await register(sock, jid, sender)
        }

        if (['.bal', '.balance', '.cash', '.money'].includes(command)) {
            await balance(sock, jid, sender)
        }

        if (['.cf', '.coinflip'].includes(command)) {
            await coinflip(sock, jid, sender, args)
        }

        if (['.tf', '.send', '.give'].includes(command)) {
            await sendMoney(sock, jid, sender, args.slice(1), message)
        }

        if (['.top', '.topbal', '.topbalance'].includes(command)) {
            await top(sock, jid)
        }

        if (['.job', '.work'].includes(command)) {
            await job(sock, jid, sender)
        }

        if (['.hunt', '.hunting'].includes(command)) {
            await hunt(sock, jid, sender)
        }

        if (['.inventory', '.inv', '.bag'].includes(command)) {
            await inventory(sock, jid, sender)
        }

        if (command === '.sell') {
            await sell(sock, jid, sender, args)
        }

        if (['.fish', '.fishing'].includes(command)) {
            await fishing(
                sock,
                jid,
                sender,
                message.pushName
            )
        }

        if (['.klaimfish', '.claimfish'].includes(command)) {
            await claimFishing(sock, jid, sender, args)
        }

        if (['.mine', '.mining'].includes(command)) {
            await mining(sock, jid, sender)
        }

        if (['.tt', '.tiktok'].includes(command)) {
            await tiktok(sock, jid, sender, args)
        }

        if (['.s', '.sticker'].includes(command)) {
            console.log('👤 COMMAND FROM:', sender)
            console.log('🖼️ SAVED IMAGE:', lastImages.has(sender))

            const lastImage = lastImages.get(sender)

            if (lastImage) {
                console.log('✅ Menggunakan gambar terakhir')
                await sticker(sock, jid, lastImage)
            } else {
                console.log('❌ Tidak menemukan gambar terakhir')
                await sticker(sock, jid, message)
            }
        }

        if (['.dice', '.d'].includes(command)) {
            await dice(sock, jid, sender, args)
        }

        if (await handleGuess(sock, jid, sender, text)) {
            return
        }

        if (command === '.guess') {
            await guess(sock, jid, sender, args)
            return
        }

        if (command === '.ping') {
            await ping(sock, jid)
            return
        }

        if (['.ttt', '.tictactoe'].includes(command)) {
            await tttCommand(sock, jid)
        }

  })
}

startBot()
