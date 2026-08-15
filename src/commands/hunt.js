import db from '../database/database.js'
import { formatMoney, getRandomItem } from '../utils.js'

export async function hunt(sock, jid, sender) {
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
    const cooldown = 10 * 60

    const remaining = user.last_hunt + cooldown - now

    if (remaining > 0) {
        const minutes = Math.floor(remaining / 60)
        const seconds = remaining % 60

        await sock.sendMessage(jid, {
            text: `⏳ Kamu masih capek berburu!\n\n🏹 Hunt lagi dalam ${minutes}M ${seconds}S.`
        })

        return
    }

    const animals = db.prepare(`
        SELECT *
        FROM items
        WHERE type = 'animal'
    `).all()

    const animal = getRandomItem(animals)

    db.transaction(() => {
        db.prepare(`
            INSERT INTO item_inventory (user_id, item_id, quantity)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, item_id)
            DO UPDATE SET quantity = quantity + 1
        `).run(sender, animal.id)

        db.prepare(`
            UPDATE users
            SET last_hunt = ?
            WHERE user_id = ?
        `).run(now, sender)
    })()

    await sock.sendMessage(jid, {
        text: `
🏹 HUNTING!

@${sender.split('@')[0]} went hunting...

${animal.emoji} ${animal.name}
✨ Rarity: ${animal.rarity}
💰 Value: ${formatMoney(animal.value)} Cowoncy

🕐 Next hunt: 10 minutes
        `,
        mentions: [sender]
    })
}
