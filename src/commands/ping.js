import os from 'os'
import fs from 'fs'
import { execSync } from 'child_process'

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400)
    seconds %= 86400

    const hours = Math.floor(seconds / 3600)
    seconds %= 3600

    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)

    let result = ''

    if (days > 0) result += `${days}d `
    if (hours > 0) result += `${hours}h `
    if (minutes > 0) result += `${minutes}m `
    if (secs > 0 || result === '') result += `${secs}s`

    return result.trim()
}

function getMemoryUsage() {
    const total = os.totalmem()
    const free = os.freemem()

    return ((total - free) / total * 100).toFixed(1)
}

function getDiskUsage() {
    try {
        const output = execSync(
            "df -P / | tail -1 | awk '{print $5}'"
        ).toString().trim()

        return output.replace('%', '')
    } catch {
        return 'N/A'
    }
}

function getCPUUsage() {
    const cpus = os.cpus()

    let idle = 0
    let total = 0

    for (const cpu of cpus) {
        idle += cpu.times.idle

        total +=
            cpu.times.user +
            cpu.times.nice +
            cpu.times.sys +
            cpu.times.idle +
            cpu.times.irq
    }

    return ((1 - idle / total) * 100).toFixed(1)
}

export async function ping(sock, jid) {

    // =========================
    // HITUNG RESPONSE TIME
    // =========================

    const start = Date.now()

    await sock.sendMessage(jid, {
        text: '🏓 Mengukur system...'
    })

    const responseTime = Date.now() - start

    // =========================
    // SYSTEM INFO
    // =========================

    const uptime = formatUptime(process.uptime())

    const vpsUptime = formatUptime(os.uptime())

    const hostname = os.hostname()

    const cpu = getCPUUsage()

    const ram = getMemoryUsage()

    const disk = getDiskUsage()

    // =========================
    // PING KE SERVER
    // =========================

    let networkPing = 'N/A'

    try {
        const pingStart = Date.now()

        execSync(
            'ping -c 1 -W 1 8.8.8.8',
            { stdio: 'pipe' }
        )

        networkPing = `${Date.now() - pingStart} ms`

    } catch {
        networkPing = 'Offline'
    }

    // =========================
    // MESSAGE
    // =========================

    const text = `
\`Ping:\` ${responseTime} ms

\`Merespon dalam:\` ${responseTime} milidetik

*──「  ✧  S Y S T E M   S T A T U S  ✧ 」──*

◈  *Uptime*   : ${uptime}

◈  *VPS*      : ${vpsUptime}

◈  *Host*     : ${hostname}

*N E T W O R K*

⭓  *CPU*      : ${cpu}%

⭓  *RAM*      : ${ram}%

⭓  *Disk*     : ${disk}%

⭓  *Ping*     : ${networkPing}

─────────────────────
`

    await sock.sendMessage(jid, {
        text
    })
}
