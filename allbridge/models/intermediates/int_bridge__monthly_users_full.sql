{{ config(materialized='table') }}

-- user_monthly_activity is already at user×month grain
-- so count() here gives exact distinct users per full month
SELECT
    month AS date,
    count() AS users
FROM {{ ref('int_bridge__user_monthly_activity') }}
GROUP BY month
ORDER BY date