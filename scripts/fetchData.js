import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client';
import { parse } from 'yaml';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = createClient({
    url: `${process.env.DB_HOST}:${process.env.DB_PORT}`,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'c_algorand',
});

async function fetchAndSaveCSV() {
    console.log('Fetching Allbridge data from ClickHouse...');

    try {
        const yamlPath = path.join(__dirname, 'queries.yaml');
        const yamlContent = fs.readFileSync(yamlPath, 'utf8');
        const { queries } = parse(yamlContent);

        for (const { name, outputPath, query } of queries) {
            console.log(`Fetching ${name} data...`);

            const resultSet = await client.query({
                query,
                format: 'CSVWithNames',
            });

            const csvData = await resultSet.text();
            const resolvedPath = path.resolve(__dirname, outputPath);
            fs.writeFileSync(resolvedPath, csvData);

            console.log(`✅ ${name}.csv saved to ${resolvedPath}`);
        }
    } catch (error) {
        console.error('❌ Failed to fetch data:', error.message);
        throw error;
    } finally {
        await client.close();
    }
}

fetchAndSaveCSV();