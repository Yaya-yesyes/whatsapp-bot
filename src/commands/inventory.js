import db from '../database/database.js'
import { formatMoney } from '../utils.js'

const rarityEmoji = {
    Common: '🪨',
    Uncommon: '🍃',
    Rare: '🔥',
    Epic: '🔮',
    Legendary: '✨'
}

const typeOrder = {
    fish: 1,
    animal: 2,
    ore: 3
}

export async function inventory(sock, jid, sender) {
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

    const items = db.prepare(`
        SELECT
            items.name,
            items.emoji,
            items.type,
            items.rarity,
            items.value,
            item_inventory.quantity
        FROM item_inventory
        JOIN items
            ON item_inventory.item_id = items.id
        WHERE item_inventory.user_id = ?
        AND item_inventory.quantity > 0
    `).all(sender)

    if (items.length === 0) {
        await sock.sendMessage(jid, {
            text: '🎒 Inventory kamu masih kosong.'
        })
        return
    }

    const rarityOrder = {
        Common: 1,
        Uncommon: 2,
        Rare: 3,
        Epic: 4,
        Legendary: 5
    }

    // Urutkan berdasarkan kategori → rarity → value
    items.sort((a, b) => {
        const typeA = typeOrder[a.type?.toLowerCase()] ?? 99
        const typeB = typeOrder[b.type?.toLowerCase()] ?? 99

        if (typeA !== typeB) {
            return typeA - typeB
        }

        const rarityA = rarityOrder[a.rarity] ?? 0
        const rarityB = rarityOrder[b.rarity] ?? 0

        if (rarityA !== rarityB) {
            return rarityA - rarityB
        }

        return b.value - a.value
    })

    const groups = {
        fish: [],
        animal: [],
        ore: []
    }

    for (const item of items) {
        const type = item.type?.toLowerCase()

        if (groups[type]) {
            groups[type].push(item)
        }
    }

    let text = `🎒 INVENTORY @${sender.split('@')[0]}\n\n`

    // =========================
    // FISH
    // =========================

    if (groups.fish.length > 0) {
        text += `🎣 FISH\n`

        for (const item of groups.fish) {
            const rarity = rarityEmoji[item.rarity] || '⚪'

            text += `${rarity} ${item.emoji} ${item.name} ×${item.quantity}\n`
        }

        text += `\n`
    }

    // =========================
    // ANIMALS
    // =========================

    if (groups.animal.length > 0) {
        text += `🦌 ANIMALS\n`

        for (const item of groups.animal) {
            const rarity = rarityEmoji[item.rarity] || '⚪'

            text += `${rarity} ${item.emoji} ${item.name} ×${item.quantity}\n`
        }

        text += `\n`
    }

    // =========================
    // MATERIALS
    // =========================

    if (groups.ore.length > 0) {
        text += `⛏️ MATERIALS\n`

        for (const item of groups.ore) {
            text += `${item.emoji} ${item.name} ×${item.quantity}\n`
        }

        text += `\n`
    }

    // =========================
    // TOTAL RARITY
    // =========================

    const rarityTotal = {
        Common: 0,
        Uncommon: 0,
        Rare: 0,
        Epic: 0,
        Legendary: 0
    }

    for (const item of items) {
        if (rarityTotal[item.rarity] !== undefined) {
            rarityTotal[item.rarity] += item.quantity
        }
    }

    text += `━━━━━━━━━━━━\n`
    text += `🪨 Common: ${rarityTotal.Common}\n`
    text += `🍃 Uncommon: ${rarityTotal.Uncommon}\n`
    text += `🔥 Rare: ${rarityTotal.Rare}\n`
    text += `🔮 Epic: ${rarityTotal.Epic}\n`
    text += `✨ Legendary: ${rarityTotal.Legendary}`

    await sock.sendMessage(jid, {
          text,
          mentions: [sender]
    })
}
