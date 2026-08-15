import db from '../database/database.js'

export async function register(sock, jid, sender) {
    const user = db.prepare(`
        SELECT * FROM users
        WHERE user_id = ?
    `).get(sender)

    if (user) {
        await sock.sendMessage(jid, {
            text: '❌ Kamu sudah terdaftar!'
        })
        return
    }

    db.prepare(`
        INSERT INTO users (user_id)
        VALUES (?)
    `).run(sender)

    await sock.sendMessage(jid, {
        text: `✅ @${sender.split('@')[0]} berhasil terdaftar!\n\n💰 Balance: 0 Cowoncy\n🔥 Daily streak: 0`,
        mentions: [sender]
    })
}
