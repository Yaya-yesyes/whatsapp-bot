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

    const now = Math.floor(Date.now() / 1000)
    const cooldown = 30 * 60

    const remaining = user.last_job + cooldown - now

    if (remaining > 0) {
        const minutes = Math.floor(remaining / 60)
        const seconds = remaining % 60

        await sock.sendMessage(jid, {
            text: `⏳ Kamu masih capek.\n\n🕐 Kamu bisa kerja lagi dalam ${minutes}M ${seconds}S.`
        })

        return
    }

    const selectedJob = jobs[Math.floor(Math.random() * jobs.length)]

    const reward =
        Math.floor(
            Math.random() * (selectedJob.max - selectedJob.min + 1)
        ) + selectedJob.min

    db.prepare(`
        UPDATE users
        SET balance = balance + ?,
            last_job = ?
        WHERE user_id = ?
    `).run(reward, now, sender)

    const updatedUser = db.prepare(`
        SELECT balance
        FROM users
        WHERE user_id = ?
    `).get(sender)

    await sock.sendMessage(jid, {
        text: `
💼 JOB COMPLETE!

👤 @${sender.split('@')[0]}
🧑‍💻 Job: ${selectedJob.name}

💰 Earned: ${formatMoney(reward)} Cowoncy
💵 Balance: ${formatMoney(updatedUser.balance)} Cowoncy

🕐 Next job: 30M
        `,
        mentions: [sender]
    })
}
