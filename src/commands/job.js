import db from '../database/database.js'
import { formatMoney } from '../utils.js'

const jobs = [
    { name: 'Programmer', min: 4000, max: 8000 },
    { name: 'Chef', min: 2000, max: 5000 },
    { name: 'Delivery Driver', min: 1500, max: 4000 },
    { name: 'Farmer', min: 1000, max: 3500 },
    { name: 'Mechanic', min: 3000, max: 6500 }
]

export async function job(sock, jid, sender) {
    // =========================
    // 1. VALIDASI USER & COOLDOWN
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

    const now = Math.floor(Date.now() / 1000)
    const cooldown = 30 * 60 // 30 Menit
    const remaining = user.last_job + cooldown - now

    if (remaining > 0) {
        const minutes = Math.floor(remaining / 60)
        const seconds = remaining % 60

        await sock.sendMessage(jid, {
            text: `⏳ Kamu masih capek.\n\n🕐 Kamu bisa kerja lagi dalam ${minutes}M ${seconds}S.`
        })
        return
    }

    // =========================
    // 2. PILIH JOB & HITUNG GAJI (REWARD)
    // =========================
    const selectedJob = jobs[Math.floor(Math.random() * jobs.length)]

    const reward = Math.floor(
        Math.random() * (selectedJob.max - selectedJob.min + 1)
    ) + selectedJob.min

    // =========================
    // 3. UPDATE DATABASE (MYSQL)
    // =========================
    await db.query(`
        UPDATE users
        SET balance = balance + ?,
            last_job = ?
        WHERE user_id = ?
    `, [reward, now, sender])

    // Ambil saldo terbaru untuk ditampilkan di pesan
    const [updatedUserRows] = await db.query(`
        SELECT balance
        FROM users
        WHERE user_id = ?
    `, [sender])

    const updatedUser = updatedUserRows[0]

    // =========================
    // 4. KIRIM PESAN HASIL
    // =========================
    const text = `💼 JOB COMPLETE!

👤 @${sender.split('@')[0]}
🧑‍💻 Job: ${selectedJob.name}

💰 Earned: ${formatMoney(reward)} Cowoncy
💵 Balance: ${formatMoney(updatedUser.balance)} Cowoncy

🕐 Next job: 30M`

    await sock.sendMessage(jid, {
        text: text.trim(),
        mentions: [sender]
    })
}