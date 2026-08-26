import db from '../database/database.js'

export async function register(sock, jid, sender) {
    // 1. Cek user pakai db.query
    const [rows] = await db.query(`
        SELECT * FROM users
        WHERE user_id = ?
    `, [sender])

    // Ambil data pertama dari hasil pencarian
    const user = rows[0]

    if (user) {
        await sock.sendMessage(jid, {
            text: '❌ Kamu sudah terdaftar!'
        })
        return
    }

    // 2. Insert data pakai db.query (tanpa .run)
    await db.query(`
        INSERT INTO users (user_id)
        VALUES (?)
    `, [sender])

    await sock.sendMessage(jid, {
        text: `✅ @${sender.split('@')[0]} berhasil terdaftar!\n\n💰 Balance: 0 Cowoncy\n🔥 Daily streak: 0`,
        mentions: [sender]
    })
}