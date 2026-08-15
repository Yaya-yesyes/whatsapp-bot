import { formatMoney } from '../utils.js'
import db from '../database/database.js'

export async function daily(sock, jid, sender) {
    const user = db.prepare(`
        SELECT *
        FROM users
        WHERE user_id = ?
    `).get(sender)

    if (!user) {
        await sock.sendMessage(jid, {
            text: '❌ Kamu belum terdaftar!\nGunakan .register terlebih dahulu.'
        })
        return
    }

    const now = Math.floor(Date.now() / 1000)

    const cooldown = 24 * 60 * 60

    const nextDaily = user.last_daily + cooldown
    const remaining = nextDaily - now

    if (remaining > 0) {
        const hours = Math.floor(remaining / 3600)
        const minutes = Math.floor((remaining % 3600) / 60)
        const seconds = remaining % 60

        await sock.sendMessage(jid, {
            text: `⏳ @${sender.split('@')[0]}, your daily is still on cooldown!\n\n🕐 Next daily in: ${hours}H ${minutes}M ${seconds}S`,
            mentions: [sender]
        })

        return
    }

    const reward = 2269

    db.prepare(`
        UPDATE users
        SET balance = balance + ?,
            daily_streak = daily_streak + 1,
            last_daily = ?
        WHERE user_id = ?
    `).run(reward, now, sender)

    const updatedUser = db.prepare(`
        SELECT balance, daily_streak
        FROM users
        WHERE user_id = ?
    `).get(sender)

    await sock.sendMessage(jid, {
        text: `
💰| @${sender.split('@')[0]}! Here is your daily 💵 ${formatMoney(reward)} Cowoncy!
🔥| You're on a ${updatedUser.daily_streak} daily streak!
💰| Your balance is now ${formatMoney(updatedUser.balance)} Cowoncy!
🕐| Your next daily is in: 24H 0M 0S
        `,
        mentions: [sender]
    })
}
