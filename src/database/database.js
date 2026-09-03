import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const db = mysql.createPool({
    host: process.env.host,
    user: process.env.user,
    password: process.env.password,
    database: process.env.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const initDB = async () => {
    try {
        // 1. Tabel Users
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) UNIQUE NOT NULL,
                balance BIGINT DEFAULT 0,
                level INT DEFAULT 0,
                daily_streak INT DEFAULT 0,
                last_daily BIGINT DEFAULT 0,
                last_job BIGINT DEFAULT 0,
                last_fishing BIGINT DEFAULT 0,
                last_hunt BIGINT DEFAULT 0,
                last_mining BIGINT DEFAULT 0,
                xp INT DEFAULT 0,
                current_biome_id INT DEFAULT 1,
                current_rod_id INT DEFAULT 1
            )
        `);

        // 2. Tabel Items
        await db.query(`
            CREATE TABLE IF NOT EXISTS items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                emoji VARCHAR(50),
                type ENUM('fish', 'junk', 'rod', 'treasure') NOT NULL,
                value INT DEFAULT 0,
                weight_min FLOAT DEFAULT 1.0,
                weight_max FLOAT DEFAULT 5.0,
                xp_reward INT DEFAULT 5
            )
        `);

        // 3. Tabel Biomes
        await db.query(`
            CREATE TABLE IF NOT EXISTS biomes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                req_level INT DEFAULT 1
            )
        `);

        // 4. Tabel Relasi Item ke Biome (ItemBiome)
        await db.query(`
            CREATE TABLE IF NOT EXISTS item_biome (
                item_id INT NOT NULL,
                biome_id INT NOT NULL,
                catch_rate FLOAT NOT NULL,
                PRIMARY KEY (item_id, biome_id),
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
                FOREIGN KEY (biome_id) REFERENCES biomes(id) ON DELETE CASCADE
            )
        `);

        // 5. Tabel Inventory
        await db.query(`
            CREATE TABLE IF NOT EXISTS inventory (
                user_id VARCHAR(255) NOT NULL,
                item_id INT NOT NULL,
                quantity INT DEFAULT 0,
                PRIMARY KEY (user_id, item_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Semua Tabel Virtual Fisher Siap!');
    } catch (error) {
        console.error('❌ Gagal setup database:', error);
    }
};

initDB();

export default db;