import db from '../database/database.js'

const typeOrder = {
    fish: 1,
    animal: 2,
    ore: 3
}

export async function inventory(sock, jid, sender) {
    // =========================
    // 1. CEK USER
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

    // =========================
    // 2. AMBIL DATA INVENTORY & ITEMS
    // =========================
    const [items] = await db.query(`
        SELECT 
            items.name,
            items.emoji,
            items.type,
            items.value,
            inventory.quantity
        FROM inventory
        JOIN items 
            ON inventory.item_id = items.id
        WHERE inventory.user_id = ?
          AND inventory.quantity > 0
    `, [sender])

    if (items.length === 0) {
        await sock.sendMessage(jid, {
            text: '🎒 Inventory kamu masih kosong.'
        })
        return
    }

    // =========================
    // 3. URUTKAN ITEM (Berdasarkan Tipe & Harga)
    // =========================
    items.sort((a, b) => {
        const typeA = typeOrder[a.type?.toLowerCase()] ?? 99
        const typeB = typeOrder[b.type?.toLowerCase()] ?? 99

        if (typeA !== typeB) {
            return typeA - typeB
        }

        return b.value - a.value
    })

    // =========================
    // 4. KELOMPOKKAN ITEM
    // =========================
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

    // Kategori: Fish
    if (groups.fish.length > 0) {
        text += `🎣 FISH\n`
        for (const item of groups.fish) {
            text += `${item.emoji} ${item.name} ×${item.quantity}\n`
        }
        text += `\n`
    }

    // Kategori: Animals
    if (groups.animal.length > 0) {
        text += `🦌 ANIMALS\n`
        for (const item of groups.animal) {
            text += `${item.emoji} ${item.name} ×${item.quantity}\n`
        }
        text += `\n`
    }

    // Kategori: Materials/Ore
    if (groups.ore.length > 0) {
        text += `⛏️ MATERIALS\n`
        for (const item of groups.ore) {
            text += `${item.emoji} ${item.name} ×${item.quantity}\n`
        }
        text += `\n`
    }

    await sock.sendMessage(jid, {
        text: text.trim(),
        mentions: [sender]
    })
}