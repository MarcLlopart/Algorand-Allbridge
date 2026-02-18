{{ config(materialized='table') }}

SELECT
    snd_addr_id,
    month,
    min(dom)    AS first_dom_in_month,
    count()     AS txns_in_month
FROM {{ ref('stg_mainnet__txn_bridge') }}
GROUP BY snd_addr_id, month