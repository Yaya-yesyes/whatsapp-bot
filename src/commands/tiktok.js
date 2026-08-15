import { downloadTikTok } from '../services/tiktok.js'

export async function tiktok(sock, jid, sender, args) {
    const url = args[0]

    if (!url) {
        await sock.sendMessage(jid, {
            text: '❌ Masukkan URL TikTok!\n\nContoh:\n.tt https://www.tiktok.com/@user/video/123456'
        })
        return
    }

    if (!url.includes('tiktok.com')) {
        await sock.sendMessage(jid, {
            text: '❌ Itu bukan URL TikTok.'
        })
        return
    }

    try {
        await sock.sendMessage(jid, {
            text: '⏳ Sedang mengambil video TikTok...'
        })

        const result = await downloadTikTok(url)

        if (!result.video || !result.video[0]) {
            throw new Error('Video URL tidak ditemukan')
        }

        const videoUrl = result.video[0]

        await sock.sendMessage(jid, {
            video: {
                url: videoUrl
            },
            caption: `🎬 ${result.title || 'TikTok Video'}`
        })

    } catch (error) {
        console.error('TikTok error:', error)

        await sock.sendMessage(jid, {
            text: '❌ Gagal mengunduh video TikTok.'
        })
    }
}
