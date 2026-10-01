import sharp from 'sharp'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import twemoji from 'twemoji'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TWEMOJI_DIR = path.join(
    __dirname,
    '../../node_modules/twemoji/assets/svg'
)

// ========================================
// CONFIG
// ========================================

const SIZE = 512

const FONT_FAMILY =
    'Nimbus Sans Narrow, DejaVu Sans Condensed, sans-serif'

const SIDE_MARGIN = 21

const STROKE_WIDTH = 7


// ========================================
// ESCAPE XML
// ========================================

function escapeXml(text) {

    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}


// ========================================
// SPLIT TEXT
// ========================================

function splitText(text, maxChars = 18) {

    const words = text.split(/\s+/)

    const lines = []
    let current = ''

    for (const word of words) {

        const test =
            current.length === 0
                ? word
                : `${current} ${word}`

        if (test.length <= maxChars) {

            current = test

        } else {

            if (current) {
                lines.push(current)
            }

            current = word
        }
    }

    if (current) {
        lines.push(current)
    }

    return lines
}


// ========================================
// FONT SIZE
// ========================================

function calculateFontSize(text) {

    const length = text.length

    if (length <= 10) return 58
    if (length <= 16) return 54
    if (length <= 22) return 48
    if (length <= 30) return 42
    if (length <= 40) return 36
    if (length <= 50) return 31

    return 27
}


// ========================================
// SPLIT EMOJI
// ========================================

function splitEmoji(text) {
    const result = []

    const segments = [
        ...new Intl.Segmenter('en', {
            granularity: 'grapheme'
        }).segment(text)
    ]

    for (const segment of segments) {
        const char = segment.segment

        const code = twemoji.convert.toCodePoint(
            char,
            '-'
        )

        const emojiPath = path.join(
            TWEMOJI_DIR,
            `${code}.svg`
        )

        if (fs.existsSync(emojiPath)) {
            result.push({
                type: 'emoji',
                emoji: char,
                code
            })
        } else {
            const last = result[result.length - 1]

            if (last?.type === 'text') {
                last.text += char
            } else {
                result.push({
                    type: 'text',
                    text: char
                })
            }
        }
    }

    return result
}

// ========================================
// CREATE TEXT + EMOJI DATA
// ========================================

function createTextLayer(
    text,
    position
) {

    if (!text) {

        return {
            svg: '',
            emojis: []
        }
    }

    text =
        text
            .trim()
            .toUpperCase()

    let fontSize =
        calculateFontSize(text)

    let lines =
        splitText(
            text,
            fontSize >= 50
                ? 16
                : fontSize >= 40
                    ? 20
                    : 26
        )

    if (lines.length > 3) {

        lines = [
            lines
                .slice(0, 2)
                .join(' '),

            lines
                .slice(2)
                .join(' ')
        ]

        fontSize =
            Math.min(
                fontSize,
                30
            )
    }

    const lineHeight =
        fontSize * 0.92

    const totalHeight =
        lines.length *
        lineHeight

    let startY

    if (position === 'top') {

        startY =
            SIDE_MARGIN +
            fontSize

    } else {

        startY =
            SIZE -
            SIDE_MARGIN -
            totalHeight +
            fontSize
    }

    let output = ''

    const emojis = []


    // ====================================
    // EACH LINE
    // ====================================

    lines.forEach(
        (line, lineIndex) => {

            const y =
                startY +
                lineIndex *
                lineHeight

            const parts =
                splitEmoji(line)

            let totalWidth = 0


            // =================================
            // CALCULATE WIDTH
            // =================================

            for (const part of parts) {

                if (
                    part.type === 'emoji'
                ) {

                    totalWidth +=
                        fontSize

                } else {

                    totalWidth +=
                        part.text.length *
                        fontSize *
                        0.55
                }
            }

            let x =
                256 -
                totalWidth / 2


            // =================================
            // RENDER
            // =================================

            for (const part of parts) {


                // =============================
                // NORMAL TEXT
                // =============================

                if (
                    part.type === 'text' &&
                    part.text
                ) {

                    output += `
                        <text
                            x="${x}"
                            y="${y}"
                            text-anchor="start"
                            font-family="${FONT_FAMILY}"
                            font-size="${fontSize}px"
                            font-weight="900"
                            fill="white"
                            stroke="black"
                            stroke-width="${STROKE_WIDTH}"
                            stroke-linejoin="round"
                            paint-order="stroke fill"
                        >
                            ${escapeXml(
                                part.text
                            )}
                        </text>
                    `

                    x +=
                        part.text.length *
                        fontSize *
                        0.55

                    continue
                }


                // =============================
                // EMOJI
                // =============================

                if (
                    part.type === 'emoji'
                ) {

                    const emojiSize =
                        Math.round(
                            fontSize * 1.05
                        )

                    const emojiX =
                        Math.round(x)

                    const emojiY =
                        Math.round(
                            y - fontSize
                        )

                    emojis.push({
                        code: part.code,
                        x: emojiX,
                        y: emojiY,
                        size: emojiSize
                    })

                    x += emojiSize
                }
            }
        }
    )


    return {
        svg: output,
        emojis
    }
}


// ========================================
// CREATE OVERLAY
// ========================================

function createMemeOverlay(
    topText,
    bottomText
) {

    const top =
        createTextLayer(
            topText,
            'top'
        )

    const bottom =
        createTextLayer(
            bottomText,
            'bottom'
        )

    const svg = `
        <svg
            width="${SIZE}"
            height="${SIZE}"
            viewBox="0 0 ${SIZE} ${SIZE}"
            xmlns="http://www.w3.org/2000/svg"
        >
            ${top.svg}
            ${bottom.svg}
        </svg>
    `

    return {
        svg,
        emojis: [
            ...top.emojis,
            ...bottom.emojis
        ]
    }
}


// ========================================
// LOAD TWEMOJI AS PNG
// ========================================
async function createEmojiBuffer(code, size) {
    const emojiPath = path.join(
        TWEMOJI_DIR,
        `${code}.svg`
    )

    console.log(
        '[SMEME] Emoji:',
        code,
        'Path:',
        emojiPath
    )

    if (!fs.existsSync(emojiPath)) {
        console.log(
            '[SMEME] Emoji file TIDAK ADA'
        )
        return null
    }

    try {
        const svg = fs.readFileSync(
            emojiPath,
            'utf8'
        )

        const png = await sharp(
            Buffer.from(svg)
        )
            .resize(size, size)
            .png()
            .toBuffer()

        console.log(
            '[SMEME] Emoji berhasil:',
            code
        )

        return png

    } catch (err) {
        console.error(
            '[SMEME] Gagal render emoji:',
            code,
            err
        )

        return null
    }
}

// ========================================
// GET IMAGE / STICKER
// ========================================

function getImage(
    message,
    jid
) {

    let mediaMessage = null
    let targetMessage = message


    // ==================================
    // DIRECT IMAGE
    // ==================================

    if (
        message.message?.imageMessage
    ) {

        mediaMessage =
            message.message.imageMessage
    }


    // ==================================
    // DIRECT STICKER
    // ==================================

    if (
        !mediaMessage &&
        message.message?.stickerMessage
    ) {

        mediaMessage =
            message.message.stickerMessage
    }


    // ==================================
    // QUOTED
    // ==================================

    const contextInfo =
        message.message
            ?.extendedTextMessage
            ?.contextInfo

    const quoted =
        contextInfo?.quotedMessage


    // ==================================
    // QUOTED IMAGE
    // ==================================

    if (
        !mediaMessage &&
        quoted?.imageMessage
    ) {

        mediaMessage =
            quoted.imageMessage

        targetMessage = {

            key: {
                remoteJid: jid,
                fromMe: false,
                id: contextInfo.stanzaId,
                participant:
                    contextInfo.participant
            },

            message: quoted
        }
    }


    // ==================================
    // QUOTED STICKER
    // ==================================

    if (
        !mediaMessage &&
        quoted?.stickerMessage
    ) {

        mediaMessage =
            quoted.stickerMessage

        targetMessage = {

            key: {
                remoteJid: jid,
                fromMe: false,
                id: contextInfo.stanzaId,
                participant:
                    contextInfo.participant
            },

            message: quoted
        }
    }


    return {
        mediaMessage,
        targetMessage
    }
}


// ========================================
// MAIN
// ========================================

export async function smeme(
    sock,
    jid,
    message,
    args
) {

    try {

        // ==================================
        // GET TEXT
        // ==================================

        const text =
            args.join(' ').trim()


        if (!text) {

            await sock.sendMessage(
                jid,
                {
                    text:
                        '❌ Format:\n\n' +
                        '.smeme teks bawah\n\n' +
                        'Atau:\n' +
                        '.smeme teks atas | teks bawah'
                }
            )

            return
        }


        // ==================================
        // PARSE TEXT
        // ==================================

        let topText = ''
        let bottomText = ''


        if (
            text.includes('|')
        ) {

            const parts =
                text
                    .split('|')
                    .map(
                        x =>
                            x.trim()
                    )

            topText =
                parts[0] || ''

            bottomText =
                parts
                    .slice(1)
                    .join(' | ')

        } else {

            bottomText =
                text
        }


        // ==================================
        // GET IMAGE
        // ==================================

        const {
            mediaMessage,
            targetMessage
        } =
            getImage(
                message,
                jid
            )


        if (!mediaMessage) {

            await sock.sendMessage(
                jid,
                {
                    text:
                        '❌ Kirim/reply gambar atau sticker dengan command `.smeme`.'
                }
            )

            return
        }


        // ==================================
        // PROCESSING
        // ==================================

        await sock.sendMessage(
            jid,
            {
                text:
                    '⏳ Membuat meme sticker...'
            }
        )


        // ==================================
        // DOWNLOAD MEDIA
        // ==================================

        const buffer =
            await downloadMediaMessage(
                targetMessage,
                'buffer',
                {},
                {
                    logger: console
                }
            )


        // ==================================
        // PREPARE IMAGE
        // ==================================

        const baseImage =
            await sharp(buffer)
                .resize(
                    SIZE,
                    SIZE,
                    {
                        fit: 'cover',
                        position: 'centre'
                    }
                )
                .png()
                .toBuffer()


        // ==================================
        // CREATE TEXT
        // ==================================

        const overlay =
            createMemeOverlay(
                topText,
                bottomText
            )


        // ==================================
        // TEXT LAYER
        // ==================================

        let compositeLayers = [
            {
                input:
                    Buffer.from(
                        overlay.svg
                    ),
                top: 0,
                left: 0
            }
        ]


        // ==================================
        // EMOJI LAYERS
        // ==================================

        for (
            const emoji of overlay.emojis
        ) {

            try {

                const emojiBuffer =
                    await createEmojiBuffer(
                        emoji.code,
                        emoji.size
                    )

                if (!emojiBuffer) {
                    continue
                }

                compositeLayers.push({
                    input: emojiBuffer,
                    top: emoji.y,
                    left: emoji.x
                })

            } catch (emojiError) {

                console.error(
                    'EMOJI ERROR:',
                    emojiError
                )
            }
        }


        // ==================================
        // COMPOSITE
        // ==================================

        const sticker =
            await sharp(baseImage)
                .composite(
                    compositeLayers
                )
                .webp({
                    quality: 90
                })
                .toBuffer()


        // ==================================
        // SEND
        // ==================================

        await sock.sendMessage(
            jid,
            {
                sticker
            }
        )

    } catch (error) {

        console.error(
            'SMEME ERROR:',
            error
        )

        await sock.sendMessage(
            jid,
            {
                text:
                    '❌ Gagal membuat meme sticker.'
            }
        )
    }
}