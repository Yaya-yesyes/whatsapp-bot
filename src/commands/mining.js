import db from '../database/database.js'
import { formatMoney, getRandomItem } from '../utils.js'

export async function mining(sock, jid, sender) {
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
    const cooldown = 30 * 60

    const remaining = user.last_mining + cooldown - now

    if (remaining > 0) {
        const minutes = Math.floor(remaining / 60)
        const seconds = remaining % 60

        await sock.sendMessage(jid, {
            text: `⛏️ Kamu masih kelelahan!\n\nMining lagi dalam ${minutes}M ${seconds}S.`
        })
        return
    }

    const ores = db.prepare(`
        SELECT *
        FROM items
        WHERE type = 'ore'
    `).all()

    const ore = getRandomItem(ores)

    db.transaction(() => {
        db.prepare(`
            INSERT INTO item_inventory (user_id, item_id, quantity)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, item_id)
            DO UPDATE SET quantity = quantity + 1
        `).run(sender, ore.id)

        db.prepare(`
            UPDATE users
            SET last_mining = ?
            WHERE user_id = ?
        `).run(now, sender)
    })()

    await sock.sendMessage(jid, {
        text: `
⛏️ MINING!

@${sender.split('@')[0]} went mining...

${ore.emoji} ${ore.name}
✨ Rarity: ${ore.rarity}
💰 Value: ${formatMoney(ore.value)} Cowoncy

🕐 Next mining: 30 minutes
        `,
        mentions: [sender]
    })
}
