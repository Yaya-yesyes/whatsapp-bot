import db from '../database/database.js'
import { formatMoney, getRandomItem } from '../utils.js'

export async function fishing(sock, jid, sender) {
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
    const cooldown = 10

    const remaining = user.last_fishing + cooldown - now

    if (remaining > 0) {
        await sock.sendMessage(jid, {
            text: `⏳ Sabar nelayan.\n\n🎣 Fishing lagi dalam ${remaining} detik.`
        })
        return
    }

    const fishes = db.prepare(`
        SELECT *
        FROM items
        WHERE type = 'fish'
    `).all()

    const fish = getRandomItem(fishes)

    db.transaction(() => {
        db.prepare(`
            INSERT INTO item_inventory (user_id, item_id, quantity)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, item_id)
            DO UPDATE SET quantity = quantity + 1
        `).run(sender, fish.id)

        db.prepare(`
            UPDATE users
            SET last_fishing = ?
            WHERE user_id = ?
        `).run(now, sender)
    })()

    await sock.sendMessage(jid, {
        text: `
🎣 FISHING!

@${sender.split('@')[0]} cast the fishing rod...

${fish.emoji} ${fish.name}
✨ Rarity: ${fish.rarity}
💰 Value: ${formatMoney(fish.value)} Cowoncy

🕐 Next fishing: 10 seconds
        `,
        mentions: [sender]
    })
}
