import sharp from 'sharp'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { spawn } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

/**
 * ================================
 * RUN FFMPEG
 * ================================
 */

function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', args)

        let stderr = ''

        process.stderr.on('data', data => {
            stderr += data.toString()
        })

        process.on('error', reject)

        process.on('close', code => {
            if (code === 0) {
                resolve()
            } else {
                reject(new Error(`FFmpeg exited with code ${code}\n${stderr}`))
            }
        })
    })
}


/**
 * ================================
 * GET MEDIA FROM MESSAGE
 * ================================
 */

function getMedia(message, jid) {

    let mediaMessage = null
    let type = null
    let targetMessage = message

    // ==================================
    // DIRECT IMAGE
    // ==================================

    if (message.message?.imageMessage) {
        mediaMessage = message.message.imageMessage
        type = 'image'
    }

    // ==================================
    // DIRECT VIDEO
    // ==================================

    else if (message.message?.videoMessage) {
        mediaMessage = message.message.videoMessage
        type = 'video'
    }

    // ==================================
    // QUOTED MESSAGE
    // ==================================

    const contextInfo =
        message.message?.extendedTextMessage?.contextInfo

    const quoted = contextInfo?.quotedMessage

    if (!mediaMessage && quoted) {

        if (quoted.imageMessage) {
            mediaMessage = quoted.imageMessage
            type = 'image'
        }

        else if (quoted.videoMessage) {
            mediaMessage = quoted.videoMessage
            type = 'video'
        }

        // ===============================
        // REBUILD QUOTED MESSAGE
        // ===============================

        if (mediaMessage) {

            targetMessage = {
                key: {
                    remoteJid: jid,
                    fromMe: false,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                message: quoted
            }
        }
    }

    return {
        mediaMessage,
        type,
        targetMessage
    }
}


/**
 * ================================
 * IMAGE → STICKER
 * ================================
 */

async function imageToSticker(buffer) {

    return await sharp(buffer)
        .resize(512, 512, {
            fit: 'cover',
            position: 'centre'
        })
        .webp({
            quality: 85
        })
        .toBuffer()
}


/**
 * ================================
 * VIDEO → ANIMATED STICKER
 * ================================
 */

async function videoToSticker(buffer) {

    const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'wa-sticker-')
    )

    const inputPath = path.join(tempDir, 'input.mp4')
    const outputPath = path.join(tempDir, 'output.webp')

    try {

        await fs.writeFile(inputPath, buffer)

        await runFFmpeg([
            '-y',

            '-i',
            inputPath,

            // ==========================
            // BATASI DURASI
            // ==========================

            '-t',
            '6',

            // ==========================
            // CROP MENJADI 1:1
            // ==========================

            '-vf',
            'crop=min(iw\\,ih):min(iw\\,ih),scale=512:512:flags=lanczos,fps=12',

            // ==========================
            // WEBP ANIMATED
            // ==========================

            '-c:v',
            'libwebp',

            '-lossless',
            '0',

            '-q:v',
            '60',

            '-loop',
            '0',

            '-preset',
            'default',

            outputPath
        ])

        return await fs.readFile(outputPath)

    } finally {

        await fs.rm(tempDir, {
            recursive: true,
            force: true
        })
    }
}


/**
 * ================================
 * MAIN STICKER COMMAND
 * ================================
 */

export async function sticker(sock, jid, message) {

    try {

        // ==================================
        // GET IMAGE / VIDEO
        // ==================================

        const {
            mediaMessage,
            type,
            targetMessage
        } = getMedia(message, jid)


        // ==================================
        // NO MEDIA
        // ==================================

        if (!mediaMessage) {

            await sock.sendMessage(jid, {
                text:
                    '❌ Kirim foto/video dengan caption `.s` atau `.stiker`, atau reply media tersebut.'
            })

            return
        }


        // ==================================
        // PROCESSING
        // ==================================

        await sock.sendMessage(jid, {
            text:
                type === 'video'
                    ? '⏳ Membuat animated sticker...'
                    : '⏳ Membuat sticker...'
        })


        // ==================================
        // DOWNLOAD MEDIA
        // ==================================

        const buffer = await downloadMediaMessage(
            targetMessage,
            'buffer',
            {},
            {
                logger: console
            }
        )


        // ==================================
        // CONVERT
        // ==================================

        let stickerBuffer

        if (type === 'image') {

            stickerBuffer = await imageToSticker(buffer)

        } else {

            stickerBuffer = await videoToSticker(buffer)

        }


        // ==================================   
        // SEND STICKER
        // ==================================

        await sock.sendMessage(jid, {
            sticker: stickerBuffer
        })


    } catch (error) {

        console.error('Sticker error:', error)

        await sock.sendMessage(jid, {
            text:
                '❌ Gagal membuat sticker.\n\n' +
                'Pastikan file media tidak rusak dan ukuran/durasinya tidak terlalu besar.'
        })
    }
}   