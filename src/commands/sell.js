import db from '../database/database.js'
import { formatMoney } from '../utils.js'

export async function sell(sock, jid, sender, args) {
    // =========================
    // 1. VALIDASI USER
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
            `.trim()
        })
        return
    }

    // =========================
    // 2. SELL ALL
    // =========================
    if (itemName === 'all') {
        const [items] = await db.query(`
            SELECT
                items.name,
                items.emoji,
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
                text: '🎒 Inventory kamu kosong.'
            })
            return
        }

        let total = 0
        for (const item of items) {
            total += item.value * item.quantity
        }

        // Transaksi MySQL untuk Sell All
        const conn = await db.getConnection()
        try {
            await conn.beginTransaction()

            await conn.query(`
                DELETE FROM inventory
                WHERE user_id = ?
            `, [sender])

            await conn.query(`
                UPDATE users
                SET balance = balance + ?
                WHERE user_id = ?
            `, [total, sender])

            await conn.commit()
        } catch (error) {
            await conn.rollback()
            console.error('Sell All Transaction Error:', error)
        } finally {
            conn.release()
        }

        const [updatedUserRows] = await db.query(`
            SELECT balance
            FROM users
            WHERE user_id = ?
        `, [sender])

        const updatedUser = updatedUserRows[0]

        await sock.sendMessage(jid, {
            text: `
💰 SELL ALL SUCCESS!

📦 Items sold type: ${items.length}
💵 Total earned: ${formatMoney(total)} Cowoncy

💰 Balance: ${formatMoney(updatedUser.balance)} Cowoncy
            `.trim()
        })

        return
    }

    // =========================
    // 3. FIND ITEM
    // =========================
    const [itemRows] = await db.query(`
        SELECT *
        FROM items
        WHERE LOWER(name) = ?
    `, [itemName])

    const item = itemRows[0]

    if (!item) {
        await sock.sendMessage(jid, {
            text: `❌ Item "${itemName}" tidak ditemukan.`
        })
        return
    }

    // =========================
    // 4. QUANTITY
    // =========================
    const quantity = args[1] ? Number(args[1]) : 1

    if (!Number.isInteger(quantity) || quantity <= 0) {
        await sock.sendMessage(jid, {
            text: '❌ Jumlah harus berupa angka positif.'
        })
        return
    }

    // =========================
    // 5. CHECK INVENTORY
    // =========================
    const [invRows] = await db.query(`
        SELECT quantity
        FROM inventory
        WHERE user_id = ?
          AND item_id = ?
    `, [sender, item.id])

    const inventory = invRows[0]

    if (!inventory || inventory.quantity < quantity) {
        await sock.sendMessage(jid, {
            text: `
❌ Kamu tidak punya ${quantity} ${item.name}.

📦 Jumlah yang kamu punya: ${inventory?.quantity || 0}
            `.trim()
        })
        return
    }

    // =========================
    // 6. CALCULATE PRICE & UPDATE DATABASE
    // =========================
    const total = item.value * quantity
    const conn = await db.getConnection()

    try {
        await conn.beginTransaction()

        // Kurangi quantity item di inventory
        await conn.query(`
            UPDATE inventory
            SET quantity = quantity - ?
            WHERE user_id = ?
              AND item_id = ?
        `, [quantity, sender, item.id])

        // Hapus baris inventory jika quantity habis (<= 0)
        await conn.query(`
            DELETE FROM inventory
            WHERE user_id = ?
              AND item_id = ?
              AND quantity <= 0
        `, [sender, item.id])

        // Tambah balance user
        await conn.query(`
            UPDATE users
            SET balance = balance + ?
            WHERE user_id = ?
        `, [total, sender])

        await conn.commit()
    } catch (error) {
        await conn.rollback()
        console.error('Sell Item Transaction Error:', error)
    } finally {
        conn.release()
    }

    // =========================
    // 7. GET NEW BALANCE & SEND MESSAGE
    // =========================
    const [updatedUserRows] = await db.query(`
        SELECT balance
        FROM users
        WHERE user_id = ?
    `, [sender])

    const updatedUser = updatedUserRows[0]

    await sock.sendMessage(jid, {
        text: `
💰 SALE SUCCESS!

${item.emoji} ${item.name} ×${quantity}

💵 Earned: ${formatMoney(total)} Cowoncy
💰 Balance: ${formatMoney(updatedUser.balance)} Cowoncy
        `.trim()
    })
}