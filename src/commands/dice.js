import db from '../database/database.js'

const cooldowns = new Map()

const MAX_BET = 250000
const COOLDOWN = 10 * 1000
const MESSAGE_DELAY = 2 * 1000

function formatMoney(number) {
    return Number(number).toLocaleString('id-ID')
}

function rollDice() {
    return Math.floor(Math.random() * 6) + 1
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function dice(sock, jid, sender, args) {
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
            text: `⏳ @${sender.split('@')[0]}, tunggu ${remaining} detik sebelum bermain Dice lagi.`,
            mentions: [sender]
        })

        return
    }

    // =========================
    // CEK BET
    // =========================

    if (!args[0]) {
        await sock.sendMessage(jid, {
            text:
                '❌ Masukkan jumlah taruhan!\n\n' +
                'Contoh:\n' +
                '.dice 1000\n' +
                '.dice all'
        })
        return
    }

    let bet

    if (args[0].toLowerCase() === 'all') {
        bet = Math.min(user.balance, MAX_BET)
    } else {
        bet = Number(args[0])
    }

    if (!Number.isInteger(bet) || bet <= 0) {
        await sock.sendMessage(jid, {
            text: '❌ Bet harus berupa angka positif.'
        })
        return
    }

    if (bet > MAX_BET) {
        await sock.sendMessage(jid, {
            text:
                `❌ Maksimal taruhan Dice adalah ` +
                `${formatMoney(MAX_BET)} Cowoncy.`
        })
        return
    }

    if (bet > user.balance) {
        await sock.sendMessage(jid, {
            text:
                `❌ Saldo tidak cukup!\n\n` +
                `💰 Balance: ${formatMoney(user.balance)}\n` +
                `🎲 Bet: ${formatMoney(bet)}`
        })
        return
    }

    // Set cooldown setelah bet valid
    cooldowns.set(sender, now)

    // =========================
    // ROLL
    // =========================

    const userDice1 = rollDice()
    const userDice2 = rollDice()

    const botDice1 = rollDice()
    const botDice2 = rollDice()

    const userTotal = userDice1 + userDice2
    const botTotal = botDice1 + botDice2

    const jackpot =
        userDice1 === 6 &&
        userDice2 === 6

    let result
    let reward = 0

    if (jackpot) {
        result = 'jackpot'
        reward = bet * 5
    } else if (userTotal > botTotal) {
        result = 'win'
        reward = bet * 2
    } else if (userTotal === botTotal) {
        result = 'draw'
        reward = bet
    } else {
        result = 'lose'
        reward = 0
    }

    // =========================
    // UPDATE BALANCE
    // =========================

    const balanceChange =
        result === 'lose'
            ? -bet
            : reward - bet

    db.prepare(`
        UPDATE users
        SET balance = balance + ?
        WHERE user_id = ?
    `).run(balanceChange, sender)

    const updatedUser = db.prepare(`
        SELECT balance
        FROM users
        WHERE user_id = ?
    `).get(sender)

    const username = sender.split('@')[0]

    // =========================
    // MESSAGE 1
    // =========================

    await sock.sendMessage(jid, {
        text:
            `🎲 @${username} bets 💵 ${formatMoney(bet)} ` +
            `and throws their dice...`,
        mentions: [sender]
    })

    await sleep(MESSAGE_DELAY)

    // =========================
    // MESSAGE 2
    // =========================

    await sock.sendMessage(jid, {
        text:
            `🎲 @${username} gets ` +
            `*${userDice1}* and *${userDice2}*...`,
        mentions: [sender]
    })

    await sleep(MESSAGE_DELAY)

    // =========================
    // MESSAGE 3
    // =========================

    await sock.sendMessage(jid, {
        text:
            `🎲 @${username}, your opponent throws their dice... ` +
            `and gets *${botDice1}* and *${botDice2}*...`,
        mentions: [sender]
    })

    await sleep(MESSAGE_DELAY)

    // =========================
    // RESULT
    // =========================

    let resultText

    if (result === 'jackpot') {
        resultText =
            `🎲 @${username}, you hit *JACKPOT!* 🎰\n` +
            `💥 *6 + 6!*\n` +
            `💵 You won *${formatMoney(reward)}* Cowoncy!`
    } else if (result === 'win') {
        resultText =
            `🎲 @${username}, you *won* 💵 ` +
            `${formatMoney(reward)} Cowoncy!`
    } else if (result === 'draw') {
        resultText =
            `🎲 @${username}, it's a *DRAW!*\n` +
            `💵 Your ${formatMoney(bet)} Cowoncy was returned.`
    } else {
        resultText =
            `🎲 @${username}, you *lost* 💀\n` +
            `💸 Lost: ${formatMoney(bet)} Cowoncy`
    }

    await sock.sendMessage(jid, {
        text:
            resultText +
            `\n\n💰 Balance: ${formatMoney(updatedUser.balance)}`,
        mentions: [sender]
    })
}
