{{ config(materialized='table') }}

WITH src_app_calls AS (
    SELECT
        round,
        intra,
        group,
        month,
        dom
    FROM {{ ref('stg_mainnet__txn_bridge') }}
    WHERE has_usdc
      AND apaa_1 != '3kytSg=='
)

SELECT
    ac.month,
    ac.dom,
    t.amount / 1e6  AS src_usdc
FROM mainnet.txn t
JOIN src_app_calls ac
  ON  t.round = ac.round
  AND t.intra = ac.intra - 1
  AND t.group = ac.group
WHERE t.rcv_addr_id = fn_addr2id_main('KB2YJBRULWSHID77HLX4XKATV7CR56AQD7UCDXJQOXGA2BIXTD7JLKGRRU')
  AND t.asset_id = 31566704