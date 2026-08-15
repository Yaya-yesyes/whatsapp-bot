import db from '../database/database.js'
import { formatMoney } from '../utils.js'

export async function top(sock, jid) {
    const users = db.prepare(`
        SELECT user_id, balance
        FROM users
        ORDER BY balance DESC
        LIMIT 10
    `).all()

    if (users.length === 0) {
        await sock.sendMessage(jid, {
            text: '❌ Belum ada user yang terdaftar.'
        })
        return
    }

    let text = '🏆 TOP 10 BALANCE\n\n'

    users.forEach((user, index) => {
        const number = index + 1
        const username = user.user_id.split('@')[0]

        text += `${number}. @${username} — 💰 ${formatMoney(user.balance)}\n`
    })

    await sock.sendMessage(jid, {
        text,
        mentions: users.map(user => user.user_id)
    })
}
