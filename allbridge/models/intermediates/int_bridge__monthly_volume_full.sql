{{ config(materialized='table') }}

WITH src AS (
    SELECT
        month,
        sum(src_usdc) AS src_usdc
    FROM {{ ref('int_bridge__src_transfers') }}
    GROUP BY month
),

dst AS (
    SELECT
        month,
        sum(dst_usdc) AS dst_usdc
    FROM {{ ref('int_bridge__dst_transfers') }}
    GROUP BY month
)

SELECT
    coalesce(s.month, d.month)          AS date,
    coalesce(s.src_usdc, 0)             AS src_usdc,
    coalesce(d.dst_usdc, 0)             AS dst_usdc,
    coalesce(s.src_usdc, 0)
        + coalesce(d.dst_usdc, 0)       AS volume
FROM src s
FULL OUTER JOIN dst d ON s.month = d.month
ORDER BY date