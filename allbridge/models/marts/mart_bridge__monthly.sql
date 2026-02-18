{{ config(materialized='table') }}

WITH base AS (
    SELECT
        coalesce(f.date, uf.date, vf.date)  AS month,

        -- Full month values
        f.transactions                       AS monthly_transactions,
        uf.users                             AS monthly_active_users,
        vf.src_usdc                          AS monthly_src_usdc,
        vf.dst_usdc                          AS monthly_dst_usdc,
        vf.volume                            AS monthly_usdc,

        -- MTD values
        fm.transactions                      AS transactions_mtd,
        um.users                             AS active_users_mtd,
        vm.vol                               AS volume_mtd

    FROM {{ ref('int_bridge__monthly_txns_full') }}     f
    LEFT JOIN {{ ref('int_bridge__monthly_users_full') }}   uf  ON f.date = uf.date
    LEFT JOIN {{ ref('int_bridge__monthly_volume_full') }}  vf  ON f.date = vf.date
    LEFT JOIN {{ ref('int_bridge__monthly_txns') }}         fm  ON f.date = fm.date
    LEFT JOIN {{ ref('int_bridge__monthly_users') }}        um  ON f.date = um.date
    LEFT JOIN {{ ref('int_bridge__monthly_volume') }}       vm  ON f.date = vm.date
)

SELECT
    month,
    monthly_transactions,
    monthly_active_users,
    monthly_src_usdc,
    monthly_dst_usdc,
    monthly_usdc,
    transactions_mtd,
    active_users_mtd,
    volume_mtd
FROM base
WHERE month >= addMonths(toStartOfMonth(today()), -12)
ORDER BY month