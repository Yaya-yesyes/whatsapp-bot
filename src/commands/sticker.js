import sharp from 'sharp'
import { downloadMediaMessage } from '@whiskeysockets/baileys'

export async function sticker(sock, jid, message) {
    try {
        let imageMessage = null
        let targetMessage = message

        // =========================
        // CEK GAMBAR LANGSUNG
        // =========================

        if (message.message?.imageMessage) {
            imageMessage = message.message.imageMessage
        }

        // =========================
        // CEK REPLY / QUOTED IMAGE
        // =========================

        const quoted =
            message.message?.extendedTextMessage?.contextInfo?.quotedMessage

        if (!imageMessage && quoted?.imageMessage) {
            imageMessage = quoted.imageMessage

            targetMessage = {
                key: {
                    remoteJid: jid,
                    fromMe: false,
                    id: message.message.extendedTextMessage
                        ?.contextInfo?.stanzaId
                },
                message: quoted
            }
        }

        // =========================
        // TIDAK ADA GAMBAR
        // =========================

        if (!imageMessage) {
            await sock.sendMessage(jid, {
                text: '❌ Kirim atau reply gambar dengan `.sticker`.'
            })
            return
        }

        await sock.sendMessage(jid, {
            text: '⏳ Membuat sticker...'
        })

        // =========================
        // DOWNLOAD IMAGE
        // =========================

        const buffer = await downloadMediaMessage(
            targetMessage,
            'buffer',
            {},
            {
                logger: console
            }
        )

        // =========================
        // CROP + RESIZE
        // =========================

        const sticker = await sharp(buffer)
            .resize(512, 512, {
                fit: 'cover',
                position: 'centre'
            })
            .webp({
                quality: 85
            })
            .toBuffer()

        // =========================
        // SEND STICKER
        // =========================

        await sock.sendMessage(jid, {
            sticker
        })

    } catch (error) {
        console.error('Sticker error:', error)

        await sock.sendMessage(jid, {
            text: '❌ Gagal membuat sticker.'
        })
    }
}
