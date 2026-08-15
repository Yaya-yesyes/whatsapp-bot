export async function menu(sock, jid) {
    const text = `
╭───「 BOT MENU 」───
│
│ping
│.menu
│.daily
│.balance
│.send
│.work
│.coinflip
│.hunt
│
│
╰──────────────────
`

    await sock.sendMessage(jid, {
        text: text
    })
}
