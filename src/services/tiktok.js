import { ttdl } from 'ab-downloader'

export async function downloadTikTok(url) {
    const result = await ttdl(url)

    return result
}
