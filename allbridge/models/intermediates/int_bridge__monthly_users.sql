{{ config(materialized='table') }}

-- MTD: a user counts in a month only if their first active day
-- in that month falls within the days elapsed so far
SELECT
    month AS date,
    count() AS users
FROM {{ ref('int_bridge__user_monthly_activity') }}
WHERE first_dom_in_month <= toDayOfMonth(today())
  AND month >= addMonths(toStartOfMonth(today()), -13)
GROUP BY month
ORDER BY date