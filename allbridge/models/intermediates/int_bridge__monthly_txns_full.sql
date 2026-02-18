{{ config(materialized='table') }}

WITH daily AS (
    SELECT
        toStartOfMonth(realtime)    AS month,
        toDayOfMonth(realtime)      AS dom,
        count()                     AS txns
    FROM {{ ref('stg_mainnet__txn_bridge') }}
    GROUP BY month, dom
)

SELECT
    month AS date,
    sum(txns) AS transactions
FROM daily
GROUP BY month
ORDER BY date