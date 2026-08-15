import db from '../database/database.js'
import { formatMoney } from '../utils.js'

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
        ORDER BY items.type, items.value DESC
    `).all(sender)

    if (items.length === 0) {
        await sock.sendMessage(jid, {
            text: '🎒 Inventory kamu masih kosong.'
        })
        return
    }

    let text = `🎒 INVENTORY @${sender.split('@')[0]}\n\n`

    for (const item of items) {
        text += `${item.emoji} ${item.name} ×${item.quantity}\n`
        text += `   ✨ ${item.rarity} | 💰 ${formatMoney(item.value)}\n`
    }

    await sock.sendMessage(jid, {
        text,
        mentions: [sender]
    })
}
