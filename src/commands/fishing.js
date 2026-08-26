import db from '../database/database.js'
import { formatMoney } from '../utils.js'

export async function fishing(sock, jid, sender) {
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
    const cooldown = 10
    const remaining = user.last_fishing + cooldown - now

    if (remaining > 0) {
        await sock.sendMessage(jid, {
            text: `⏳ Sabar nelayan.\n\n🎣 Fishing lagi dalam ${remaining} detik.`
        })
        return
    }

    // =========================
    // 2. AMBIL DATA IKAN
    // =========================
    const [fishes] = await db.query(`
        SELECT *
        FROM items
        WHERE type = 'fish'
    `)

    if (fishes.length === 0) {
        await sock.sendMessage(jid, { text: '❌ Belum ada data ikan di database.' })
        return
    }

    // =========================
    // 3. WEIGHTED RANDOM (Tanpa Rarity)
    // =========================
    // Hitung total berat dari semua ikan yang ada
    const totalWeight = fishes.reduce((sum, fish) => sum + fish.weight, 0)
    let randomWeight = Math.random() * totalWeight
    let fish = fishes[0]

    for (const item of fishes) {
        randomWeight -= item.weight
        if (randomWeight <= 0) {
            fish = item
            break
        }
    }

    // =========================
    // 4. TRANSAKSI DATABASE (MYSQL)
    // =========================
    const conn = await db.getConnection()
    
    try {
        await conn.beginTransaction()

        await conn.query(`
            INSERT INTO inventory (user_id, item_id, quantity)
            VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE quantity = quantity + 1
        `, [sender, fish.id])

        await conn.query(`
            UPDATE users
            SET last_fishing = ?
            WHERE user_id = ?
        `, [now, sender])

        await conn.commit()
    } catch (error) {
        await conn.rollback()
        console.error('Fishing Transaction Error:', error)
    } finally {
        conn.release()
    }

    // =========================
    // 5. KIRIM PESAN HASIL
    // =========================
    const text = `🎣 FISHING!

@${sender.split('@')[0]} cast the fishing rod...

${fish.emoji} ${fish.name}
💰 Value: ${formatMoney(fish.value)} Cowoncy

🕐 Next fishing: 10 seconds`

    await sock.sendMessage(jid, {
        text: text.trim(),
        mentions: [sender]
    })
}