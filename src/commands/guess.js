import db from '../database/database.js'

const games = new Map()
const cooldowns = new Map()

const MAX_BET = 250000
const MAX_ATTEMPTS = 5
const COOLDOWN = 10 * 1000
const MESSAGE_DELAY = 2 * 1000

function formatMoney(number) {
    return Number(number).toLocaleString('id-ID')
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function guess(sock, jid, sender, args) {

    const username = sender.split('@')[0]

    // =================================
    // CEK GAME YANG MASIH AKTIF
    // =================================

    if (games.has(sender)) {
        await sock.sendMessage(jid, {
            text:
                `🤔 @${username}, kamu masih punya game Guess yang aktif!\n\n` +
                `🎯 Kirim angka **1-100** sebagai tebakanmu.`,
            mentions: [sender]
        })

        return
    }

    // =================================
    // COOLDOWN
    // =================================

    const now = Date.now()
    const lastGame = cooldowns.get(sender)

    if (lastGame && now - lastGame < COOLDOWN) {

        const remaining = Math.ceil(
            (COOLDOWN - (now - lastGame)) / 1000
        )

        await sock.sendMessage(jid, {
            text:
                `⏳ @${username}, tunggu **${remaining} detik** ` +
                `sebelum bermain Guess lagi.`,
            mentions: [sender]
        })

        return
    }

    // =================================
    // CEK BET
    // =================================

    if (!args[0]) {
        await sock.sendMessage(jid, {
            text:
                `❌ @${username}, masukkan taruhan!\n\n` +
                `🎯 Contoh:\n` +
                `.guess 1000\n` +
                `.guess all`,
            mentions: [sender]
        })

        return
    }

    const [rows] = await db.query(`
        SELECT *
        FROM users
        WHERE user_id = ?
    `, [sender])

    const user = rows[0]

    if (!user) {
        await sock.sendMessage(jid, {
            text:
                `❌ @${username}, kamu belum terdaftar!\n` +
                `Gunakan .register terlebih dahulu.`,
            mentions: [sender]
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
                `❌ Maksimal taruhan Guess adalah ` +
                `${formatMoney(MAX_BET)} Cowoncy.`
        })

        return
    }

    if (bet > user.balance) {
        await sock.sendMessage(jid, {
            text:
                `❌ Saldo tidak cukup!\n\n` +
                `💰 Balance: ${formatMoney(user.balance)}\n` +
                `🎯 Bet: ${formatMoney(bet)}`
        })

        return
    }

    // =================================
    // BUAT ANGKA RAHASIA
    // =================================

    const secretNumber =
        Math.floor(Math.random() * 100) + 1

    console.log('🎯 GUESS SECRET NUMBER:', secretNumber)

    games.set(sender, {
        secretNumber,
        bet,
        attempts: 0
    })

    // =================================
    // PESAN AWAL
    // =================================

    await sock.sendMessage(jid, {
        text:
            `🤔 @${username} bets 💵 ${formatMoney(bet)} ` +
            `and starts the mystery machine...`,
        mentions: [sender]
    })

    await sleep(MESSAGE_DELAY)

    await sock.sendMessage(jid, {
        text:
            `🤖 @${username}, the mystery machine is ready!\n\n` +
            `🎯 You have **5 attempts** to guess the number ` +
            `between **1 and 100**.\n\n` +
            `🔢 Type your answer!`,
        mentions: [sender]
    })
}


// =====================================
// HANDLE TEBAKAN
// =====================================

export async function handleGuess(
    sock,
    jid,
    sender,
    text
) {

    const game = games.get(sender)

    if (!game) return false

    const username = sender.split('@')[0]

    const guessNumber = Number(text.trim())

    // =================================
    // VALIDASI
    // =================================

    if (
        !Number.isInteger(guessNumber) ||
        guessNumber < 1 ||
        guessNumber > 100
    ) {

        await sock.sendMessage(jid, {
            text:
                `❌ @${username}, masukkan angka **1-100**!`,
            mentions: [sender]
        })

        return true
    }

    // =================================
    // TAMBAH ATTEMPT
    // =================================

    game.attempts++

    const attemptsLeft =
        MAX_ATTEMPTS - game.attempts

    // =================================
    // MENANG
    // =================================

    if (guessNumber === game.secretNumber) {

        let multiplier

        switch (game.attempts) {
            case 1:
                multiplier = 5
                break

            case 2:
                multiplier = 4
                break

            case 3:
                multiplier = 3
                break

            case 4:
                multiplier = 2
                break

            case 5:
                multiplier = 2
                break
        }

        const reward =
            game.bet * multiplier

        await db.query(`
            UPDATE users
            SET balance = balance + ?
            WHERE user_id = ?
        `, [
            reward,
            sender
        ])

        const [updatedRows] = await db.query(`
            SELECT balance
            FROM users
            WHERE user_id = ?
        `, [sender])

        const updatedUser = updatedRows[0]

        games.delete(sender)

        cooldowns.set(
            sender,
            Date.now()
        )

        await sock.sendMessage(jid, {
            text:
                `🎉🎯 @${username}, YOU GOT IT!\n\n` +
                `🔐 The number was **${game.secretNumber}**!\n\n` +
                `🏆 Attempts: **${game.attempts}**\n` +
                `💰 Reward: **${formatMoney(reward)}** Cowoncy\n` +
                `🔥 Multiplier: **×${multiplier}**\n\n` +
                `💵 Balance: **${formatMoney(updatedUser.balance)}**`,
            mentions: [sender]
        })

        return true
    }

    // =================================
    // MASIH ADA KESEMPATAN
    // =================================

    if (attemptsLeft > 0) {

        const hint =
            guessNumber < game.secretNumber
                ? `📈 The number you are looking for is **greater than ${guessNumber}**`
                : `📉 The number you are looking for is **less than ${guessNumber}**`

        await sock.sendMessage(jid, {
            text:
                `🤔 @${username}, ${hint}\n\n` +
                `🎯 **${attemptsLeft} attempts left**`,
            mentions: [sender]
        })

        return true
    }

    // =================================
    // KALAH
    // =================================

    games.delete(sender)

    cooldowns.set(
        sender,
        Date.now()
    )

    await sock.sendMessage(jid, {
        text:
            `💀 @${username}, GAME OVER!\n\n` +
            `🔐 The number was **${game.secretNumber}**.\n\n` +
            `💸 You lost **${formatMoney(game.bet)}** Cowoncy.\n` +
            `🎯 Better luck next time!`,
        mentions: [sender]
    })

    return true
}