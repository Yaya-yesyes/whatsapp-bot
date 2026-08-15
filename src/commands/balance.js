import { formatMoney } from '../utils.js'
import db from '../database/database.js'

export async function balance(sock, jid, sender) {
    const user = db.prepare(`
        SELECT balance
        FROM users
        WHERE user_id = ?
    `).get(sender)

    if (!user) {
        await sock.sendMessage(jid, {
            text: '❌ Kamu belum terdaftar!\nGunakan .register terlebih dahulu.'
        })
        return
    }

    await sock.sendMessage(jid, {
        text: `💰 @${sender.split('@')[0]} memiliki ${formatMoney(user.balance)} Cowoncy!`,
        mentions: [sender]
    })
}
