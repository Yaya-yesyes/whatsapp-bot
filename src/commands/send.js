import db from '../database/database.js'
import { formatMoney } from '../utils.js'

export async function sendMoney(sock, jid, sender, args, message) {
    // =========================
    // 1. CEK SENDER (PENGIRIM)
    // =========================
    const [senderRows] = await db.query(`
        SELECT *
        FROM users
        WHERE user_id = ?
    `, [sender])

    const senderUser = senderRows[0]

    if (!senderUser) {
        await sock.sendMessage(jid, {
            text: '❌ Kamu belum terdaftar!\nGunakan .register terlebih dahulu.'
        })
        return
    }

    // =========================
    // 2. VALIDASI JUMLAH UANG
    // =========================
    const amount = Number(args[0])

    if (!Number.isInteger(amount) || amount <= 0) {
        await sock.sendMessage(jid, {
            text: '❌ Jumlah uang tidak valid.\n\nContoh:\n.send @user 1000'
        })
        return
    }

    // =========================
    // 3. CEK PENERIMA (MENTION)
    // =========================
    const mentionedUsers = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

    if (mentionedUsers.length === 0) {
        await sock.sendMessage(jid, {
            text: '❌ Tag orang yang mau menerima uang.'
        })
        return
    }

    const receiver = mentionedUsers[0]

    if (receiver === sender) {
        await sock.sendMessage(jid, {
            text: '❌ Lu nggak bisa ngirim uang ke diri sendiri.'
        })
        return
    }

    if (amount > senderUser.balance) {
        await sock.sendMessage(jid, {
            text: `❌ Saldo tidak cukup!\n\n💰 Balance: ${formatMoney(senderUser.balance)}\n💸 Transfer: ${formatMoney(amount)}`
        })
        return
    }

    // =========================
    // 4. CEK APAKAH PENERIMA TERDAFTAR
    // =========================
    const [receiverRows] = await db.query(`
        SELECT *
        FROM users
        WHERE user_id = ?
    `, [receiver])

    const receiverUser = receiverRows[0]

    if (!receiverUser) {
        await sock.sendMessage(jid, {
            text: '❌ Penerima belum terdaftar.'
        })
        return
    }

    // =========================
    // 5. TRANSAKSI MYSQL (TRANSFER SALDO)
    // =========================
    const conn = await db.getConnection()

    try {
        await conn.beginTransaction()

        // Kurangi saldo pengirim
        await conn.query(`
            UPDATE users
            SET balance = balance - ?
            WHERE user_id = ?
        `, [amount, sender])

        // Tambah saldo penerima
        await conn.query(`
            UPDATE users
            SET balance = balance + ?
            WHERE user_id = ?
        `, [amount, receiver])

        await conn.commit()
    } catch (error) {
        await conn.rollback()
        console.error('Transfer Money Transaction Error:', error)
    } finally {
        conn.release()
    }

    // =========================
    // 6. KIRIM PESAN SUKSES
    // =========================
    await sock.sendMessage(jid, {
        text: `
💸 TRANSFER SUCCESS

👤 From: @${sender.split('@')[0]}
👤 To: @${receiver.split('@')[0]}

💰 Amount: ${formatMoney(amount)} Cowoncy
        `.trim(),
        mentions: [sender, receiver]
    })
}