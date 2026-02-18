{{ config(materialized='table') }}

SELECT
    month,
    dom,
    reinterpretAsUInt64(reverse(base64Decode(
        JSONExtractString(txn_extra, 'apaa', 2)
    ))) / 1000.0    AS dst_usdc
FROM {{ ref('stg_mainnet__txn_bridge') }}
WHERE has_usdc
  AND apaa_1 = '3kytSg=='