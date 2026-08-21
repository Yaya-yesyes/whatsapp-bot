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

    // =========================
    // ROLL RARITY
    // =========================

    const rarityRoll = Math.random() * 100

    let rarity

    if (rarityRoll < 50) {
        rarity = 'Common'
    } else if (rarityRoll < 75) {
        rarity = 'Uncommon'
    } else if (rarityRoll < 90) {
        rarity = 'Rare'
    } else {
        rarity = 'Legendary'
    }

    // =========================
    // FILTER IKAN SESUAI RARITY
    // =========================

    const rarityFishes = fishes.filter(
        fish => fish.rarity === rarity
    )

    // =========================
    // WEIGHTED RANDOM
    // =========================

    const totalWeight = rarityFishes.reduce(
        (sum, fish) => sum + fish.weight,
        0
    )

    let randomWeight = Math.random() * totalWeight

    let fish

    for (const item of rarityFishes) {
        randomWeight -= item.weight

        if (randomWeight <= 0) {
            fish = item
            break
        }
    }

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
