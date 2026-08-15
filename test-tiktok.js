import { ttdl } from 'ab-downloader'

const url = process.argv[2]

if (!url) {
    console.log('Usage: node test-tiktok.js <tiktok-url>')
    process.exit(1)
}

try {
    console.log('⏳ Mengambil data TikTok...')

    const result = await ttdl(url)

    console.log('✅ Berhasil!')
    console.dir(result, { depth: null })

} catch (error) {
    console.error('❌ Gagal:')
    console.error(error)
}
