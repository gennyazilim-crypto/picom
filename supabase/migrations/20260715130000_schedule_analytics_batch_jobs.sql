-- T82 — batch orchestration: install pg_cron and schedule analytics jobs.
-- Applied to live "piso" (Picom prod) 2026-07-15. Additive + reversible.
--
-- Context: T60 data-quality monitoring showed the analytics queue had 542 rows pending / 0
-- processed because process_analytics_event_queue() was never scheduled. This installs
-- pg_cron and schedules it every minute, plus the data-quality check hourly. After applying,
-- the 542-row backlog was drained manually once (process_analytics_event_queue(1000) -> 542);
-- the cron keeps it clear going forward.
--
-- Rollback:
--   select cron.unschedule('process-analytics-queue');
--   select cron.unschedule('analytics-data-quality');
--   drop extension if exists pg_cron;

create extension if not exists pg_cron;

select cron.unschedule('process-analytics-queue')
  where exists (select 1 from cron.job where jobname = 'process-analytics-queue');
select cron.schedule('process-analytics-queue', '* * * * *',
  $$select public.process_analytics_event_queue(500);$$);

select cron.unschedule('analytics-data-quality')
  where exists (select 1 from cron.job where jobname = 'analytics-data-quality');
select cron.schedule('analytics-data-quality', '0 * * * *',
  $$select public.run_analytics_data_quality();$$);
