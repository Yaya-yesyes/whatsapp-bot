import db from '../database/database.js'
import { formatMoney } from '../utils.js'

export async function daily(sock, jid, sender) {
    // =========================
    // 1. CEK USER
    // =========================
    const [userRows] = await db.query(`
        SELECT *
        FROM users
        WHERE user_id = ?
    `, [sender])

    const user = userRows[0]

    if (!user) {
        await sock.sendMessage(jid, {
            text: '❌ Kamu belum terdaftar!\nGunakan .register terlebih dahulu.'
        })
        return
    }

    // =========================
    // 2. CEK COOLDOWN DAILY
    // =========================
    const now = Math.floor(Date.now() / 1000)
    const cooldown = 24 * 60 * 60 // 24 Jam

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

    // =========================
    // 3. UPDATE BALANCE & STREAK
    // =========================
    await db.query(`
        UPDATE users
        SET balance = balance + ?,
            daily_streak = daily_streak + 1,
            last_daily = ?
        WHERE user_id = ?
    `, [reward, now, sender])

    // Ambil data terbaru user untuk streak & balance
    const [updatedUserRows] = await db.query(`
        SELECT balance, daily_streak
        FROM users
        WHERE user_id = ?
    `, [sender])

    const updatedUser = updatedUserRows[0]

    // =========================
    // 4. KIRIM PESAN SUKSES
    // =========================
    await sock.sendMessage(jid, {
        text: `
💰| @${sender.split('@')[0]}! Here is your daily 💵 ${formatMoney(reward)} Cowoncy!
🔥| You're on a ${updatedUser.daily_streak} daily streak!
💰| Your balance is now ${formatMoney(updatedUser.balance)} Cowoncy!
🕐| Your next daily is in: 24H 0M 0S
        `.trim(),
        mentions: [sender]
    })
}