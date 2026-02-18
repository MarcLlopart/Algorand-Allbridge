{{ config(materialized='table') }}

SELECT
    snd_addr_id,
    min(month)  AS first_seen_month,
    min(dom)    AS first_seen_dom
FROM {{ ref('stg_mainnet__txn_bridge') }}
GROUP BY snd_addr_id