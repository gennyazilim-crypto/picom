-- T82 (cont.) — schedule the daily analytics rollup. Applied to piso prod 2026-07-15.
-- rollup_piso_daily_analytics(target_date) existed but was never scheduled. Run it daily
-- at 00:20 UTC for the previous day. Additive + reversible.
-- Rollback: select cron.unschedule('daily-analytics-rollup');
select cron.unschedule('daily-analytics-rollup')
  where exists (select 1 from cron.job where jobname = 'daily-analytics-rollup');
select cron.schedule('daily-analytics-rollup', '20 0 * * *',
  $$select public.rollup_piso_daily_analytics((now() - interval '1 day')::date);$$);
