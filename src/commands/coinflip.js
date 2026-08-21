import db from '../database/database.js'
import { formatMoney } from '../utils.js'

const cooldowns = new Map()
const COOLDOWN = 10 * 1000

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function coinflip(sock, jid, sender, args) {
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

    if (!args[0]) {
        await sock.sendMessage(jid, {
            text: '❌ Masukkan jumlah taruhan!\n\nContoh:\n.cf 1000\n.cf 1000 tails\n.cf all heads'
        })
        return
    }

    // =========================
    // COOLDOWN
    // =========================

    const now = Date.now()
    const lastPlay = cooldowns.get(sender)

    if (lastPlay && now - lastPlay < COOLDOWN) {
        const remaining = Math.ceil(
            (COOLDOWN - (now - lastPlay)) / 1000
           )

           await sock.sendMessage(jid, {
               text: `⏳ @${sender.split('@')[0]}, tunggu ${remaining} detik sebelum bermain Coinflip lagi.`,
               mentions: [sender]
        })

         return
    }

    // =========================
    // BET
    // =========================

    let bet

    if (args[0].toLowerCase() === 'all') {
        bet = Math.min(user.balance, 250000)
    } else {
        bet = Number(args[0])
    }

    if (!Number.isInteger(bet) || bet <= 0) {
        await sock.sendMessage(jid, {
            text: '❌ Jumlah taruhan harus berupa angka positif.'
        })
        return
    }

    if (bet > 250000) {
        await sock.sendMessage(jid, {
            text: '❌ Maksimal taruhan coinflip adalah 250.000 Cowoncy.'
        })
        return
    }

    if (bet > user.balance) {
        await sock.sendMessage(jid, {
            text: `❌ Saldo tidak cukup!\n\n💰 Balance: ${formatMoney(user.balance)}\n🎲 Bet: ${formatMoney(bet)}`
        })
        return
    }

    // =========================
    // CHOICE
    // =========================

    let choice = args[1]?.toLowerCase() || 'heads'

    if (['h', 'head', 'heads'].includes(choice)) {
        choice = 'heads'
    }

    if (['t', 'tail', 'tails'].includes(choice)) {
        choice = 'tails'
    }

    if (choice !== 'heads' && choice !== 'tails') {
        await sock.sendMessage(jid, {
            text: '❌ Pilihan hanya h/head/heads atau t/tail/tails.'
        })
        return
    }

    // =========================
    // SET COOLDOWN
    // =========================

    cooldowns.set(sender, Date.now())

    // =========================
    // COINFLIP
    // =========================

    const result = Math.random() < 0.5
        ? 'heads'
        : 'tails'

    const won = choice === result

    // ========================o=
    // UPDATE BALANCE
    // =========================

    if (won) {
        db.prepare(`
            UPDATE users
            SET balance = balance + ?
            WHERE user_id = ?
        `).run(bet, sender)
    } else {
        db.prepare(`
            UPDATE users
            SET balance = balance - ?
            WHERE user_id = ?
        `).run(bet, sender)
    }

    // =========================
    // GET UPDATED BALANCE
    // =========================

    const updatedUser = db.prepare(`
        SELECT balance
        FROM users
        WHERE user_id = ?
    `).get(sender)

    // =========================
    // RESULT MESSAGE
    // =========================

    const username = sender.split('@')[0]

    const resultEmoji = result === 'heads'
        ? '🪙 HEADS'
        : '🪙 TAILS'

    const text = `
🪙 COINFLIP

👤 @${username}

💰 Bet: ${formatMoney(bet)} Cowoncy
🎯 Choice: ${choice.toUpperCase()}
🪙 Result: ${resultEmoji}

${
    won
        ? `🎉 YOU WIN!
💵 Profit: +${formatMoney(bet)} Cowoncy`
        : `💀 YOU LOSE!
💸 Lost: -${formatMoney(bet)} Cowoncy`
}

💰 Balance: ${formatMoney(updatedUser.balance)} Cowoncy
`

    await sock.sendMessage(jid, {
        text,
        mentions: [sender]
    })
}
