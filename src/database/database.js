import Database from 'better-sqlite3'

const db = new Database('./data/bot.db')

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        balance INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0
    )
`).run()

export default db
