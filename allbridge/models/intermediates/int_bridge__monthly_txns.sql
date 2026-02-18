{{ config(materialized='table') }}

WITH daily AS (
    SELECT
        toStartOfMonth(realtime)    AS month,
        toDayOfMonth(realtime)      AS dom,
        count()                     AS txns
    FROM {{ ref('stg_mainnet__txn_bridge') }}
    WHERE realtime >= addMonths(toStartOfMonth(today()), -13)
    GROUP BY month, dom
)

SELECT
    month AS date,
    sum(txns) AS transactions
FROM daily
WHERE dom <= toDayOfMonth(today())
GROUP BY month
ORDER BY date