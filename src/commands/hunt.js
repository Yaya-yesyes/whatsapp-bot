import db from '../database/database.js'
import { formatMoney, getRandomItem } from '../utils.js'

export async function hunt(sock, jid, sender) {
    // =========================
    // 1. VALIDASI USER & COOLDOWN
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

    const now = Math.floor(Date.now() / 1000)
    const cooldown = 10 * 60 // 10 Menit
    const remaining = user.last_hunt + cooldown - now

    if (remaining > 0) {
        const minutes = Math.floor(remaining / 60)
        const seconds = remaining % 60

        await sock.sendMessage(jid, {
            text: `⏳ Kamu masih capek berburu!\n\n🏹 Hunt lagi dalam ${minutes}M ${seconds}S.`
        })
        return
    }

    // =========================
    // 2. AMBIL DATA HEWAN
    // =========================
    const [animals] = await db.query(`
        SELECT *
        FROM items
        WHERE type = 'animal'
    `)

    if (animals.length === 0) {
        await sock.sendMessage(jid, { text: '❌ Belum ada data hewan buruan di database.' })
        return
    }

    const animal = getRandomItem(animals)

    // =========================
    // 3. TRANSAKSI DATABASE (MYSQL)
    // =========================
    const conn = await db.getConnection()

    try {
        await conn.beginTransaction()

        // Menggunakan ON DUPLICATE KEY UPDATE untuk MySQL
        await conn.query(`
            INSERT INTO inventory (user_id, item_id, quantity)
            VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE quantity = quantity + 1
        `, [sender, animal.id])

        await conn.query(`
            UPDATE users
            SET last_hunt = ?
            WHERE user_id = ?
        `, [now, sender])

        await conn.commit()
    } catch (error) {
        await conn.rollback()
        console.error('Hunt Transaction Error:', error)
    } finally {
        conn.release()
    }

    // =========================
    // 4. KIRIM PESAN HASIL
    // =========================
    const text = `🏹 HUNTING!

@${sender.split('@')[0]} went hunting...

${animal.emoji} ${animal.name}
✨ Rarity: ${animal.rarity}
💰 Value: ${formatMoney(animal.value)} Cowoncy

🕐 Next hunt: 10 minutes`

    await sock.sendMessage(jid, {
        text: text.trim(),
        mentions: [sender]
    })
}