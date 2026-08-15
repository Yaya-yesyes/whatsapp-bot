import db from '../database/database.js'

export async function sendMoney(sock, jid, sender, args, message) {
    const senderUser = db.prepare(`
        SELECT *
        FROM users
        WHERE user_id = ?
    `).get(sender)

    if (!senderUser) {
        await sock.sendMessage(jid, {
            text: '❌ Kamu belum terdaftar!\nGunakan .register terlebih dahulu.'
        })
        return
    }

    const amount = Number(args[0])

    if (!Number.isInteger(amount) || amount <= 0) {
        await sock.sendMessage(jid, {
            text: '❌ Jumlah uang tidak valid.\n\nContoh:\n.send @user 1000'
        })
        return
    }

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
            text: `❌ Saldo tidak cukup!\n\n💰 Balance: ${senderUser.balance}\n💸 Transfer: ${amount}`
        })
        return
    }

    const receiverUser = db.prepare(`
        SELECT *
        FROM users
        WHERE user_id = ?
    `).get(receiver)

    if (!receiverUser) {
        await sock.sendMessage(jid, {
            text: '❌ Penerima belum terdaftar.'
        })
        return
    }

    const transfer = db.transaction(() => {
        db.prepare(`
            UPDATE users
            SET balance = balance - ?
            WHERE user_id = ?
        `).run(amount, sender)

        db.prepare(`
            UPDATE users
            SET balance = balance + ?
            WHERE user_id = ?
        `).run(amount, receiver)
    })

    transfer()

    await sock.sendMessage(jid, {
        text: `
💸 TRANSFER SUCCESS

👤 From: @${sender.split('@')[0]}
👤 To: @${receiver.split('@')[0]}

💰 Amount: ${amount} Cowoncy
        `,
        mentions: [sender, receiver]
    })
}
