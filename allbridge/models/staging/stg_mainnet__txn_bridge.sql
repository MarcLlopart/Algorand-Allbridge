SELECT
    round,
    intra,
    group,
    snd_addr_id,
    rcv_addr_id,
    asset_id,
    amount,
    realtime,
    txn_extra,

    -- convenience time fields used by every downstream model
    toStartOfMonth(realtime)    AS month,
    toDayOfMonth(realtime)      AS dom,

    -- classify the call type once, used in multiple intermediates
    JSONExtractString(txn_extra, 'apaa', 1) AS apaa_1,
    has(JSONExtract(txn_extra, 'apas', 'Array(Int64)'), 31566704) AS has_usdc

FROM mainnet.txn
WHERE app_id = 3361283339