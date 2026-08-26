import { formatMoney } from '../utils.js'
import db from '../database/database.js'

export async function balance(sock, jid, sender) {
    // Ubah cara memanggil data menjadi versi MySQL (asynchronous)
    const [rows] = await db.query(`
        SELECT balance
        FROM users
        WHERE user_id = ?
    `, [sender]) // Jangan lupa parameternya dibungkus array []

    // Ambil data pertama dari hasil pencarian
    const user = rows[0]

    if (!user) {
        await sock.sendMessage(jid, {
            text: '❌ Kamu belum terdaftar!\nGunakan .register terlebih dahulu.'
        })
        return
    }

    // Pastikan menggunakan backtick (`) untuk template literal teksnya
    await sock.sendMessage(jid, {
        text: `💰 @${sender.split('@')[0]} memiliki ${formatMoney(user.balance)} Cowoncy!`,
        mentions: [sender]
    })
}