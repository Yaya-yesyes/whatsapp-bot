export function formatMoney(amount) {
    return new Intl.NumberFormat('id-ID').format(amount)
}
export function getRandomItem(items) {
    const totalWeight = items.reduce(
        (total, item) => total + item.weight,
        0
    )

    let random = Math.random() * totalWeight

    for (const item of items) {
        random -= item.weight

        if (random < 0) {
            return item
        }
    }

    return items[items.length - 1]
}
