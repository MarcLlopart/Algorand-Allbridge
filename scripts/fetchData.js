import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create ClickHouse client with correct URL format
const client = createClient({
    url: `${process.env.DB_HOST}:${process.env.DB_PORT}`,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'c_algorand',
});

async function fetchAndSaveCSV() {
    console.log('Fetching Alpha Arcade data from ClickHouse...');

    try {
        const query = `
      SELECT *
      FROM c_algorand.mart_bridge__monthly  
      ORDER BY month
    `;

        // Fetch directly as CSV format from ClickHouse
        const resultSet = await client.query({
            query: query,
            format: 'CSVWithNames',
        });

        const csvData = await resultSet.text();

        const outputPath = path.join(__dirname, '../public/allbridge.csv');
        fs.writeFileSync(outputPath, csvData);

        console.log(`✅ CSV saved to ${outputPath}`);
    } catch (error) {
        console.error('❌ Failed to fetch data:', error.message);
        throw error;
    } finally {
        await client.close();
    }
}

fetchAndSaveCSV();