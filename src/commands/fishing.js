import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

import db from '../database/database.js'
import { createRichHtmlMessage } from '../utils/richHtml.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FISHING_COOLDOWN = 10 * 1000
const CLAIM_EXPIRE_MINUTES = 10

const FISHING_HTML_PATH = path.join(
    __dirname,
    '../games/fishing.html'
)

// Fallback emoji karena saat ini kolom items.emoji kamu masih kosong.
// Nanti bisa dipindahkan langsung ke database.
const FISH_EMOJI = {
    'Fish': '🐟',
    'Salmon': '🐟',
    'Cod': '🐟',
    'Tropical fish': '🐠',
    'Pufferfish': '🐡',
    'Fiery puffer': '🐡',
    'Hot cod': '🐟',
    'Squid': '🦑',
    'Turtle': '🐢',
    'Dolphin': '🐬',
    'Guardian': '🛡️',
    'Emerald squid': '🦑',
    'Rainbow fish': '🌈🐟',
    'Space fish': '👽🐟',
    'Galactic crab': '🦀',
    'Shark': '🦈',
    'Alien fish': '👽🐟'
}

function formatNumber(number) {
    return Number(number || 0).toLocaleString('id-ID')
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}

function randomFloat(min, max) {
    return min + Math.random() * (max - min)
}

/**
 * Weighted random menggunakan catch_rate.
 *
 * Contoh:
 * Fish = 1
 * Salmon = 2
 * Cod = 7
 *
 * Cod akan punya peluang lebih besar.
 */
function weightedRandom(items) {
    if (!items.length) return null

    const totalWeight = items.reduce(
        (sum, item) => sum + Math.max(Number(item.catch_rate) || 0, 0),
        0
    )

    if (totalWeight <= 0) {
        return items[Math.floor(Math.random() * items.length)]
    }

    let random = Math.random() * totalWeight

    for (const item of items) {
        random -= Math.max(Number(item.catch_rate) || 0, 0)

        if (random <= 0) {
            return item
        }
    }

    return items[items.length - 1]
}

function generateClaimCode() {
    return crypto
        .randomBytes(5)
        .toString('hex')
        .toUpperCase()
}

/**
 * last_fishing kita normalisasi.
 * Kalau database lama menyimpan detik Unix, tetap bisa dibaca.
 * Data baru selalu disimpan dalam millisecond.
 */
function normalizeTimestamp(timestamp) {
    const value = Number(timestamp || 0)

    if (!value) return 0

    // Unix seconds
    if (value < 10_000_000_000) {
        return value * 1000
    }

    return value
}

function getRemainingSeconds(lastFishing) {
    const normalized = normalizeTimestamp(lastFishing)

    if (!normalized) {
        return 0
    }

    const remaining = FISHING_COOLDOWN - (Date.now() - normalized)

    if (remaining <= 0) {
        return 0
    }

    return Math.ceil(remaining / 1000)
}

/**
 * Membaca fishing.html lalu mengganti placeholder.
 */
function buildFishingHtml({
    playerName,
    biomeName,
    fishName,
    fishEmoji,
    xp,
    value,
    weight,
    claimCode,
    nextFishing
}) {
    if (!fs.existsSync(FISHING_HTML_PATH)) {
        throw new Error(`Fishing HTML tidak ditemukan: ${FISHING_HTML_PATH}`)
    }

    let html = fs.readFileSync(FISHING_HTML_PATH, 'utf8')

    const replacements = {
        '__PLAYER_NAME__': escapeHtml(playerName),
        '__BIOME_NAME__': escapeHtml(biomeName),
        '__FISH_NAME__': escapeHtml(fishName),
        '__FISH_EMOJI__': escapeHtml(fishEmoji),
        '__FISH_XP__': escapeHtml(`+${xp}`),
        '__FISH_VALUE__': escapeHtml(formatNumber(value)),
        '__FISH_WEIGHT__': escapeHtml(`${Number(weight).toFixed(2)} kg`),
        '__CLAIM_CODE__': escapeHtml(claimCode),
        '__CLAIM_COMMAND__': escapeHtml(`.klaimfish ${claimCode}`),
        '__NEXT_FISHING__': escapeHtml(`${nextFishing} detik`)
    }

    for (const [placeholder, replacement] of Object.entries(replacements)) {
        html = html.replaceAll(placeholder, replacement)
    }

    // Kalau template menggunakan CLAIM_CODE = "..."
    // kita override supaya kode server masuk ke JS juga.
    html = html.replace(
        /const\s+CLAIM_CODE\s*=\s*["'][^"']*["'];?/,
        `const CLAIM_CODE = "${claimCode}";`
    )

    return html
}

export async function fishing(sock, jid, sender, pushName) {
    try {
        // ============================================================
        // 1. Ambil user
        // ============================================================

        const [userRows] = await db.query(
            `
            SELECT
                id,
                user_id,
                balance,
                level,
                xp,
                last_fishing,
                current_biome_id,
                current_rod_id
            FROM users
            WHERE user_id = ?
            LIMIT 1
            `,
            [sender]
        )

        if (!userRows.length) {
            await sock.sendMessage(jid, {
                text: '❌ Kamu belum terdaftar.\nGunakan *.register* dulu.'
            })

            return
        }

        const user = userRows[0]

        // ============================================================
        // 2. Cooldown
        // ============================================================

        const remaining = getRemainingSeconds(user.last_fishing)

        if (remaining > 0) {
            await sock.sendMessage(jid, {
                text:
                    `🎣 *Fishing masih cooldown!*\n\n` +
                    `⏳ Tunggu *${remaining} detik* lagi.`
            })

            return
        }

        // ============================================================
        // 3. Ambil biome
        // ============================================================

        const [biomeRows] = await db.query(
            `
            SELECT
                id,
                name,
                req_level
            FROM biomes
            WHERE id = ?
            LIMIT 1
            `,
            [user.current_biome_id || 1]
        )

        if (!biomeRows.length) {
            await sock.sendMessage(jid, {
                text:
                    '❌ Biome kamu tidak ditemukan.\n' +
                    'Cek kembali current_biome_id di database.'
            })

            return
        }

        const biome = biomeRows[0]

        // ============================================================
        // 4. Cek level biome
        // ============================================================

        const userLevel = Number.isFinite(Number(user.level))
            ? Number(user.level)
            : 1
        const biomeLevel = Number(biome.req_level || 1)

        if (userLevel < biomeLevel) {
            await sock.sendMessage(jid, {
                text:
                    `🔒 *Biome terkunci!*\n\n` +
                    `🌎 Biome: *${biome.name}*\n` +
                    `⭐ Level dibutuhkan: *${biomeLevel}*\n` +
                    `⭐ Level kamu: *${userLevel}*`
            })

            return
        }

        // ============================================================
        // 5. Ambil semua ikan pada biome
        // ============================================================

        const [fishRows] = await db.query(
            `
            SELECT
                i.id,
                i.name,
                i.emoji,
                i.type,
                i.value,
                i.weight_min,
                i.weight_max,
                i.xp_reward,
                ib.catch_rate
            FROM item_biome ib
            INNER JOIN items i
                ON i.id = ib.item_id
            WHERE ib.biome_id = ?
              AND i.type = 'fish'
            `,
            [biome.id]
        )

        if (!fishRows.length) {
            await sock.sendMessage(jid, {
                text:
                    `❌ Tidak ada ikan yang tersedia di biome *${biome.name}*.`
            })

            return
        }

        // ============================================================
        // 6. Tentukan ikan
        // ============================================================

        const fish = weightedRandom(fishRows)

        if (!fish) {
            await sock.sendMessage(jid, {
                text: '❌ Gagal menentukan ikan.'
            })

            return
        }

        const fishName = fish.name
        const fishEmoji =
            String(fish.emoji || '').trim() ||
            FISH_EMOJI[fishName] ||
            '🐟'

        const minWeight = Number(fish.weight_min || 1)
        const maxWeight = Number(fish.weight_max || minWeight)

        const weight = randomFloat(
            Math.min(minWeight, maxWeight),
            Math.max(minWeight, maxWeight)
        )

        const xp = Number(fish.xp_reward || 0)
        const sellPrice = Number(fish.value || 0)

        // ============================================================
        // 7. Generate claim code
        // ============================================================

        const claimCode = generateClaimCode()

        const now = Date.now()
        const expiresAt = new Date(
            Date.now() + CLAIM_EXPIRE_MINUTES * 60 * 1000
        )

        // ============================================================
        // 8. Simpan cooldown
        // ============================================================

        await db.query(
            `
            UPDATE users
            SET last_fishing = ?
            WHERE user_id = ?
            `,
            [now, sender]
        )

        // ============================================================
        // 9. Simpan hasil fishing ke fish_claims
        // ============================================================
await db.query(
    `
    INSERT INTO inventory (
        user_id,
        item_id,
        quantity
    )
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE
        quantity = quantity + 1
    `,
    [sender, fish.id]
)

await db.query(
    `
    UPDATE users
    SET xp = COALESCE(xp, 0) + ?
    WHERE user_id = ?
    `,
    [xp, sender]
)
        // ============================================================
        // 10. Render HTML
        // ============================================================

        let playerName = pushName || 'User'

        const html = buildFishingHtml({
            playerName,
            biomeName: biome.name,
            fishName,
            fishEmoji,
            xp,
            value: sellPrice,
            weight,
            claimCode,
            nextFishing: FISHING_COOLDOWN / 1000
        })

        // ============================================================
        // 11. Bungkus menjadi Rich HTML
        // ============================================================

        const richMessage = createRichHtmlMessage(
            html,
            `Fishing - ${fishName}`
        )

        // ============================================================
        // 12. Relay
        // ============================================================

        await sock.relayMessage(
            jid,
            richMessage,
            {
                messageId: crypto.randomUUID()
            }
        )

        console.log(
            `[FISHING] ${sender} caught ${fishName} ` +
            `(${weight.toFixed(2)}kg) code=${claimCode}`
        )

    } catch (error) {
        console.error('[FISHING ERROR]', error)

        try {
            await sock.sendMessage(jid, {
                text:
                    '❌ Terjadi kesalahan saat memancing.\n' +
                    'Cek console bot untuk detail error.'
            })
        } catch (sendError) {
            console.error(
                '[FISHING ERROR] Gagal kirim pesan error:',
                sendError
            )
        }
    }
}

/**
 * ================================================================
 * .klaimfish CODE
 * ================================================================
 */
export async function claimFishing(sock, jid, sender, args = []) {
    let connection

    try {
        const claimCode = String(args[0] || '')
            .trim()
            .toUpperCase()

        // ============================================================
        // 1. Validasi command
        // ============================================================

        if (!claimCode) {
            await sock.sendMessage(jid, {
                text:
                    '🎣 *Cara klaim:*\n\n' +
                    '*.klaimfish KODE*\n\n' +
                    'Contoh:\n' +
                    '`.klaimfish A1B2C3D4E5`'
            })

            return
        }

        if (!/^[A-Z0-9]{6,32}$/.test(claimCode)) {
            await sock.sendMessage(jid, {
                text: '❌ Claim code tidak valid.'
            })

            return
        }

        // ============================================================
        // 2. Ambil claim berdasarkan user + code
        // ============================================================

        const [claimRows] = await db.query(
            `
            SELECT
                id,
                claim_code,
                user_id,
                fish_name,
                fish_emoji,
                xp,
                sell_price,
                weight,
                used,
                expires_at
            FROM fish_claims
            WHERE claim_code = ?
              AND user_id = ?
            LIMIT 1
            `,
            [claimCode, sender]
        )

        if (!claimRows.length) {
            await sock.sendMessage(jid, {
                text:
                    '❌ Claim code tidak ditemukan.\n' +
                    'Pastikan kode milik kamu dan tidak salah ketik.'
            })

            return
        }

        const claim = claimRows[0]

        // ============================================================
        // 3. Sudah dipakai?
        // ============================================================

        if (Number(claim.used) === 1) {
            await sock.sendMessage(jid, {
                text: '❌ Claim code ini sudah digunakan.'
            })

            return
        }

        // ============================================================
        // 4. Expired?
        // ============================================================

        const expiresAtMs = new Date(claim.expires_at).getTime()

        if (
            !Number.isNaN(expiresAtMs) &&
            Date.now() > expiresAtMs
        ) {
            await db.query(
                `
                UPDATE fish_claims
                SET used = 1
                WHERE id = ?
                  AND used = 0
                `,
                [claim.id]
            )

            await sock.sendMessage(jid, {
                text:
                    `⌛ Claim code *${claimCode}* sudah expired.\n\n` +
                    `Ikan *${claim.fish_name}* tidak bisa diklaim lagi.`
            })

            return
        }

        // ============================================================
        // 5. Cari item berdasarkan nama ikan
        // ============================================================

        const [itemRows] = await db.query(
            `
            SELECT
                id,
                name
            FROM items
            WHERE name = ?
              AND type = 'fish'
            LIMIT 1
            `,
            [claim.fish_name]
        )

        if (!itemRows.length) {
            await sock.sendMessage(jid, {
                text:
                    `❌ Item *${claim.fish_name}* tidak ditemukan di tabel items.\n` +
                    `Claim dibatalkan agar data tidak rusak.`
            })

            return
        }

        const item = itemRows[0]

        // ============================================================
        // 6. Transaction
        // ============================================================

        connection = await db.getConnection()

        try {
            await connection.beginTransaction()

            // --------------------------------------------------------
            // Lock claim
            // --------------------------------------------------------

            const [lockedClaimRows] = await connection.query(
                `
                SELECT
                    id,
                    claim_code,
                    user_id,
                    fish_name,
                    xp,
                    used,
                    expires_at
                FROM fish_claims
                WHERE id = ?
                FOR UPDATE
                `,
                [claim.id]
            )

            if (!lockedClaimRows.length) {
                throw new Error('Claim tidak ditemukan saat transaction.')
            }

            const lockedClaim = lockedClaimRows[0]

            if (Number(lockedClaim.used) === 1) {
                throw new Error('CLAIM_ALREADY_USED')
            }

            const lockedExpiresAt = new Date(
                lockedClaim.expires_at
            ).getTime()

            if (
                !Number.isNaN(lockedExpiresAt) &&
                Date.now() > lockedExpiresAt
            ) {
                await connection.rollback()

                await sock.sendMessage(jid, {
                    text:
                        `⌛ Claim code *${claimCode}* sudah expired.`
                })

                return
            }

            // --------------------------------------------------------
            // Tambahkan ke inventory
            // --------------------------------------------------------

            await connection.query(
                `
                INSERT INTO inventory (
                    user_id,
                    item_id,
                    quantity
                )
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    quantity = quantity + 1
                `,
                [
                    sender,
                    item.id
                ]
            )

            // --------------------------------------------------------
            // Tambahkan XP
            // --------------------------------------------------------

            await connection.query(
                `
                UPDATE users
                SET xp = COALESCE(xp, 0) + ?
                WHERE user_id = ?
                `,
                [
                    Number(claim.xp || 0),
                    sender
                ]
            )

            // --------------------------------------------------------
            // Tandai claim sudah digunakan
            // --------------------------------------------------------

            const [usedResult] = await connection.query(
                `
                UPDATE fish_claims
                SET used = 1
                WHERE id = ?
                  AND used = 0
                `,
                [claim.id]
            )

            if (usedResult.affectedRows !== 1) {
                throw new Error('CLAIM_RACE_CONDITION')
            }

            await connection.commit()

        } catch (transactionError) {
            await connection.rollback()
            throw transactionError
        }

        // ============================================================
        // 7. Berhasil
        // ============================================================

        await sock.sendMessage(jid, {
            text:
                `✅ *IKAN BERHASIL DIKLAIM!*\n\n` +
                `${claim.fish_emoji} *${claim.fish_name}*\n` +
                `⚖️ Berat: *${Number(claim.weight).toFixed(2)} kg*\n` +
                `💰 Nilai: *${formatNumber(claim.sell_price)}*\n` +
                `✨ XP: *+${formatNumber(claim.xp)}*\n\n` +
                `🎒 Ikan masuk ke *inventory* kamu.`
        })

        console.log(
            `[FISH CLAIM] ${sender} claimed ${claim.fish_name} ` +
            `code=${claimCode}`
        )

    } catch (error) {
        console.error('[CLAIM FISH ERROR]', error)

        if (error.message === 'CLAIM_ALREADY_USED') {
            await sock.sendMessage(jid, {
                text: '❌ Claim code ini sudah digunakan.'
            })

            return
        }

        if (error.message === 'CLAIM_RACE_CONDITION') {
            await sock.sendMessage(jid, {
                text: '❌ Claim gagal karena kode baru saja digunakan.'
            })

            return
        }

        try {
            await sock.sendMessage(jid, {
                text:
                    '❌ Gagal mengklaim ikan.\n' +
                    'Cek console bot untuk detail error.'
            })
        } catch (sendError) {
            console.error(
                '[CLAIM FISH] gagal kirim pesan error:',
                sendError
            )
        }

    } finally {
        if (connection) {
            connection.release()
        }
    }
}