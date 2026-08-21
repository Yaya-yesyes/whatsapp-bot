import axios from 'axios'
import 'dotenv/config'

export async function pinterest(sock, jid, args) {
    const query = args.join(' ').trim()

    if (!query) {
        await sock.sendMessage(jid, {
            text: '❌ Masukkan kata yang mau dicari.\n\nContoh:\n.pin anime\n.pin wallpaper mobil'
        })
        return
    }

    const token = process.env.PINTEREST_ACCESS_TOKEN

    if (!token) {
        console.error('❌ PINTEREST_ACCESS_TOKEN tidak ditemukan di .env')

        await sock.sendMessage(jid, {
            text: '❌ Pinterest API belum dikonfigurasi.'
        })
        return
    }

    try {
        console.log(`🔎 Pinterest search: ${query}`)

        const response = await axios.get(
            'https://api.pinterest.com/v5/pins',
            {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params: {
                    query: query,
                    page_size: 10
                }
            }
        )

        const pins = response.data?.items || []

        console.log(`📌 Pinterest menemukan ${pins.length} pin`)

        if (!pins.length) {
            await sock.sendMessage(jid, {
                text: `❌ Tidak menemukan hasil untuk: ${query}`
            })
            return
        }

        let sent = 0

        for (const pin of pins) {
            const image =
                pin.media?.images?.orig?.url ||
                pin.media?.images?.['600x']?.url ||
                pin.media?.images?.['564x']?.url

            if (!image) continue

            try {
                await sock.sendMessage(jid, {
                    image: {
                        url: image
                    },
                    caption:
                        `📌 *Pinterest*\n\n` +
                        `🔎 ${query}\n` +
                        `🆔 ${pin.id}\n\n` +
                        `Powered by Pinterest`
                })

                sent++

                // Jangan spam API/WhatsApp terlalu cepat
                if (sent >= 5) break

                await new Promise(resolve =>
                    setTimeout(resolve, 1000)
                )

            } catch (sendError) {
                console.error(
                    '❌ Gagal mengirim gambar:',
                    sendError.message
                )
            }
        }

        if (sent === 0) {
            await sock.sendMessage(jid, {
                text: '❌ Hasil ditemukan, tapi tidak ada gambar yang bisa dikirim.'
            })
        }

    } catch (error) {
        console.error(
            '❌ Pinterest API Error:',
            error.response?.status,
            error.response?.data || error.message
        )

        let message = '❌ Gagal mengambil data dari Pinterest.'

        if (error.response?.status === 401) {
            message =
                '❌ Access Token Pinterest tidak valid atau sudah expired.'
        }

        if (error.response?.status === 403) {
            message =
                '❌ Pinterest menolak akses API untuk aplikasi/token ini.'
        }

        if (error.response?.status === 429) {
            message =
                '❌ Pinterest API sedang terkena rate limit. Coba lagi nanti.'
        }

        await sock.sendMessage(jid, {
            text: message
        })
    }
}
