import db from '../database/database.js'
import { formatMoney } from '../utils.js'

export async function sell(sock, jid, sender, args) {
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

    const itemName = args[0]?.toLowerCase()

    if (!itemName) {
        await sock.sendMessage(jid, {
            text: `
❌ Masukkan item yang ingin dijual.

Contoh:
.sell rabbit
.sell rabbit 3
.sell koi 5
.sell all
            `
        })
        return
    }

    // =========================
    // SELL ALL
    // =========================

    if (itemName === 'all') {
        const items = db.prepare(`
            SELECT
                items.name,
                items.emoji,
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
                text: '🎒 Inventory kamu kosong.'
            })
            return
        }

        let total = 0

        for (const item of items) {
            total += item.value * item.quantity
        }

        db.transaction(() => {
            db.prepare(`
                DELETE FROM item_inventory
                WHERE user_id = ?
            `).run(sender)

            db.prepare(`
                UPDATE users
                SET balance = balance + ?
                WHERE user_id = ?
            `).run(total, sender)
        })()

        const updatedUser = db.prepare(`
            SELECT balance
            FROM users
            WHERE user_id = ?
        `).get(sender)

        await sock.sendMessage(jid, {
            text: `
💰 SELL ALL SUCCESS!

📦 Items sold: ${items.length}
💵 Total earned: ${formatMoney(total)} Cowoncy

💰 Balance: ${formatMoney(updatedUser.balance)} Cowoncy
            `
        })

        return
    }

    // =========================
    // FIND ITEM
    // =========================

    const item = db.prepare(`
        SELECT *
        FROM items
        WHERE LOWER(name) = ?
    `).get(itemName)

    if (!item) {
        await sock.sendMessage(jid, {
            text: `❌ Item "${itemName}" tidak ditemukan.`
        })
        return
    }

    // =========================
    // QUANTITY
    // =========================

    const quantity = args[1] ? Number(args[1]) : 1

    if (!Number.isInteger(quantity) || quantity <= 0) {
        await sock.sendMessage(jid, {
            text: '❌ Jumlah harus berupa angka positif.'
        })
        return
    }

    // =========================
    // CHECK INVENTORY
    // =========================

    const inventory = db.prepare(`
        SELECT quantity
        FROM item_inventory
        WHERE user_id = ?
        AND item_id = ?
    `).get(sender, item.id)

    if (!inventory || inventory.quantity < quantity) {
        await sock.sendMessage(jid, {
            text: `
❌ Kamu tidak punya ${quantity} ${item.name}.

📦 Jumlah yang kamu punya: ${inventory?.quantity || 0}
            `
        })
        return
    }

    // =========================
    // CALCULATE PRICE
    // =========================

    const total = item.value * quantity

    // =========================
    // UPDATE DATABASE
    // =========================

    db.transaction(() => {
        db.prepare(`
            UPDATE item_inventory
            SET quantity = quantity - ?
            WHERE user_id = ?
            AND item_id = ?
        `).run(quantity, sender, item.id)

        db.prepare(`
            DELETE FROM item_inventory
            WHERE user_id = ?
            AND item_id = ?
            AND quantity <= 0
        `).run(sender, item.id)

        db.prepare(`
            UPDATE users
            SET balance = balance + ?
            WHERE user_id = ?
        `).run(total, sender)
    })()

    // =========================
    // GET NEW BALANCE
    // =========================

    const updatedUser = db.prepare(`
        SELECT balance
        FROM users
        WHERE user_id = ?
    `).get(sender)

    await sock.sendMessage(jid, {
        text: `
💰 SALE SUCCESS!

${item.emoji} ${item.name} ×${quantity}
✨ Rarity: ${item.rarity}

💵 Earned: ${formatMoney(total)} Cowoncy
💰 Balance: ${formatMoney(updatedUser.balance)} Cowoncy
        `
    })
}
