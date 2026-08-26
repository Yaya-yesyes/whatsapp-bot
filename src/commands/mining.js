import db from '../database/database.js'
import { formatMoney, getRandomItem } from '../utils.js'

export async function mining(sock, jid, sender) {
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
    const cooldown = 30 * 60 // 30 Menit

    const remaining = user.last_mining + cooldown - now

    if (remaining > 0) {
        const minutes = Math.floor(remaining / 60)
        const seconds = remaining % 60

        await sock.sendMessage(jid, {
            text: `⛏️ Kamu masih kelelahan!\n\nMining lagi dalam ${minutes}M ${seconds}S.`
        })
        return
    }

    // =========================
    // 2. AMBIL DATA ORE
    // =========================
    const [ores] = await db.query(`
        SELECT *
        FROM items
        WHERE type = 'ore'
    `)

    if (ores.length === 0) {
        await sock.sendMessage(jid, { text: '❌ Belum ada data ore di database.' })
        return
    }

    const ore = getRandomItem(ores)

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
        `, [sender, ore.id])

        await conn.query(`
            UPDATE users
            SET last_mining = ?
            WHERE user_id = ?
        `, [now, sender])

        await conn.commit()
    } catch (error) {
        await conn.rollback()
        console.error('Mining Transaction Error:', error)
    } finally {
        conn.release()
    }

    // =========================
    // 4. KIRIM PESAN HASIL
    // =========================
    const text = `⛏️ MINING!

@${sender.split('@')[0]} went mining...

${ore.emoji} ${ore.name}
💰 Value: ${formatMoney(ore.value)} Cowoncy

🕐 Next mining: 30 minutes`

    await sock.sendMessage(jid, {
        text: text.trim(),
        mentions: [sender]
    })
}