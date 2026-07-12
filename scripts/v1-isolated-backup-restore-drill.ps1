param(
  [Parameter(Mandatory = $true)][string]$BackupPath,
  [string]$LifecycleSqlPath = "",
  [Parameter(Mandatory = $true)][switch]$ConfirmSyntheticStaging
)

$ErrorActionPreference = "Stop"
$name = "picom-restore-task624-" + [guid]::NewGuid().ToString("N").Substring(0, 8)
$evidence = Join-Path $BackupPath ("task624-{0}.log" -f $name)
$log = [Collections.Generic.List[string]]::new()

function Record([string]$line) {
  $log.Add(("[{0}] {1}" -f (Get-Date -Format o), $line))
  Write-Output $line
}

function Assert-Native([string]$step, $output) {
  if ($LASTEXITCODE -ne 0) {
    $tail = (($output | Select-Object -Last 14) -join " | ") -replace "(?i)(password|token|secret)=[^ |]+", '$1=[REDACTED]'
    Record ("{0}_error={1}" -f $step, $tail)
    throw "$step failed with exit code $LASTEXITCODE"
  }
}

if (-not $ConfirmSyntheticStaging) {
  throw "Explicit -ConfirmSyntheticStaging is required; production restore targets are forbidden"
}
if ($BackupPath -match "(?i)(^|[\\/])(prod|production)([\\/]|$)") {
  throw "Refusing a path labelled as production"
}
if ([string]::IsNullOrWhiteSpace($LifecycleSqlPath)) {
  $LifecycleSqlPath = Join-Path $PSScriptRoot "sql\v1-isolated-lifecycle-drill.sql"
}
if (-not (Test-Path -LiteralPath $LifecycleSqlPath -PathType Leaf)) {
  throw "Lifecycle SQL contract is missing"
}

$expectedBackups = [ordered]@{
  "schema.sql" = "530587CCBAA6BC6C5034102D4938CEEA8E9762C48ABEFA7D919BF999D79BB88E"
  "public-data.sql" = "D33F1B01DFF3341A95C9DEE98EAABF5711A8DEA85E3EB44389E358526460813E"
  "auth-storage-data.sql" = "9E46D8FCE8EFEEA0660C3359D41702E8F3A92FEACDEAC70E8368F4824AB92625"
  "roles.sql" = "25873CEC56A2CC6514E204F420231777F85C03DA818CAA7090CDCDFA89776ECD"
}
foreach ($entry in $expectedBackups.GetEnumerator()) {
  $source = Join-Path $BackupPath $entry.Key
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing backup file: $($entry.Key)" }
  $actualHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
  if ($actualHash -ne $entry.Value) { throw "Backup checksum mismatch: $($entry.Key)" }
  Record ("backup_checksum=PASS file={0} sha256={1}" -f $entry.Key, $actualHash)
}

try {
  Record "container=$name image=public.ecr.aws/supabase/postgres:17.6.1.141 network=none ports=none"
  docker run -d --name $name --network none -e POSTGRES_PASSWORD=picom_restore_task_only public.ecr.aws/supabase/postgres:17.6.1.141 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "docker run failed" }

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    docker exec $name pg_isready -h 127.0.0.1 -U postgres 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw "Postgres readiness timeout" }

  docker exec $name createdb -h 127.0.0.1 -U postgres -T template0 picom_restore
  if ($LASTEXITCODE -ne 0) { throw "create isolated database failed" }
  docker exec $name psql -h 127.0.0.1 -U postgres -d picom_restore -v ON_ERROR_STOP=1 -c "CREATE SCHEMA extensions; CREATE EXTENSION pg_trgm WITH SCHEMA extensions;" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "extension bootstrap failed" }

  foreach ($file in @("schema.sql", "public-data.sql", "auth-storage-data.sql", "roles.sql")) {
    docker cp (Join-Path $BackupPath $file) ($name + ":/tmp/" + $file) | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "copy $file failed" }
  }

  foreach ($spec in @(
    @("roles", "postgres", "roles.sql"),
    @("schema", "picom_restore", "schema.sql"),
    @("public_data", "picom_restore", "public-data.sql"),
    @("auth_storage", "picom_restore", "auth-storage-data.sql")
  )) {
    $output = docker exec -e PGPASSWORD=picom_restore_task_only $name psql -h 127.0.0.1 -U supabase_admin -d $spec[1] -v ON_ERROR_STOP=1 -f ("/tmp/" + $spec[2]) 2>&1
    Assert-Native ($spec[0] + "_restore") $output
    Record ($spec[0] + "_restore=PASS")
  }

  $countSql = @'
SELECT jsonb_build_object(
  'profiles',(SELECT count(*) FROM public.profiles),'auth_users',(SELECT count(*) FROM auth.users),
  'communities',(SELECT count(*) FROM public.communities),'memberships',(SELECT count(*) FROM public.community_members),
  'roles',(SELECT count(*) FROM public.roles),'channels',(SELECT count(*) FROM public.channels),
  'messages',(SELECT count(*) FROM public.messages),'attachments',(SELECT count(*) FROM public.attachments),
  'reactions',(SELECT count(*) FROM public.message_reactions),'read_states',(SELECT count(*) FROM public.read_states),
  'friendships',(SELECT count(*) FROM public.friendships),'direct_conversations',(SELECT count(*) FROM public.direct_conversations),
  'direct_messages',(SELECT count(*) FROM public.direct_messages),'auth_sessions',(SELECT count(*) FROM auth.sessions),
  'storage_buckets',(SELECT count(*) FROM storage.buckets),'storage_objects',(SELECT count(*) FROM storage.objects));
'@
  $countOutput = docker exec -e PGPASSWORD=picom_restore_task_only $name psql -h 127.0.0.1 -U supabase_admin -d picom_restore -Atq -v ON_ERROR_STOP=1 -c $countSql 2>&1
  Assert-Native "row_count_matrix" $countOutput
  $countJson = ($countOutput | Where-Object { $_ -match "^\{" } | Select-Object -Last 1)
  if (-not $countJson) { throw "Row-count matrix output missing" }
  $counts = $countJson | ConvertFrom-Json
  if ($counts.profiles -ne $counts.auth_users) { throw "Auth/profile count mismatch" }
  Record ("row_counts=" + $countJson)

  $integritySql = @'
SELECT jsonb_build_object(
  'channels_without_community',(SELECT count(*) FROM public.channels c LEFT JOIN public.communities x ON x.id=c.community_id WHERE x.id IS NULL),
  'members_without_user',(SELECT count(*) FROM public.community_members m LEFT JOIN public.profiles p ON p.id=m.user_id WHERE p.id IS NULL),
  'members_without_community',(SELECT count(*) FROM public.community_members m LEFT JOIN public.communities c ON c.id=m.community_id WHERE c.id IS NULL),
  'members_without_role',(SELECT count(*) FROM public.community_members m LEFT JOIN public.roles r ON r.id=m.role_id WHERE m.role_id IS NOT NULL AND r.id IS NULL),
  'communities_without_owner',(SELECT count(*) FROM public.communities c LEFT JOIN public.profiles p ON p.id=c.owner_id WHERE p.id IS NULL),
  'messages_without_channel',(SELECT count(*) FROM public.messages m LEFT JOIN public.channels c ON c.id=m.channel_id WHERE c.id IS NULL),
  'attachments_without_message',(SELECT count(*) FROM public.attachments a LEFT JOIN public.messages m ON m.id=a.message_id WHERE m.id IS NULL),
  'reactions_without_message',(SELECT count(*) FROM public.message_reactions r LEFT JOIN public.messages m ON m.id=r.message_id WHERE m.id IS NULL),
  'read_states_without_channel',(SELECT count(*) FROM public.read_states r LEFT JOIN public.channels c ON c.id=r.channel_id WHERE c.id IS NULL),
  'dm_participants_without_conversation',(SELECT count(*) FROM public.direct_conversation_participants p LEFT JOIN public.direct_conversations c ON c.id=p.conversation_id WHERE c.id IS NULL),
  'dm_messages_without_conversation',(SELECT count(*) FROM public.direct_messages m LEFT JOIN public.direct_conversations c ON c.id=m.conversation_id WHERE c.id IS NULL),
  'dm_attachments_without_message',(SELECT count(*) FROM public.direct_message_attachments a LEFT JOIN public.direct_messages m ON m.id=a.message_id WHERE m.id IS NULL));
'@
  $integrityOutput = docker exec -e PGPASSWORD=picom_restore_task_only $name psql -h 127.0.0.1 -U supabase_admin -d picom_restore -Atq -v ON_ERROR_STOP=1 -c $integritySql 2>&1
  Assert-Native "integrity_matrix" $integrityOutput
  $integrityJson = ($integrityOutput | Where-Object { $_ -match "^\{" } | Select-Object -Last 1)
  if (-not $integrityJson) { throw "Integrity matrix output missing" }
  foreach ($property in ($integrityJson | ConvertFrom-Json).PSObject.Properties) {
    if ([int64]$property.Value -ne 0) { throw "Integrity failure: $($property.Name)=$($property.Value)" }
  }
  Record ("integrity=" + $integrityJson)

  $rlsSql = @'
SELECT jsonb_build_object(
  'sensitive_without_rls',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY['profiles','community_members','messages','attachments','friendships','direct_conversations','direct_conversation_participants','direct_messages','direct_message_attachments','direct_message_reactions','user_device_sessions']) AND c.relkind='r' AND NOT c.relrowsecurity),
  'dm_policy_count',(SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'direct_%'),
  'private_storage_buckets',(SELECT count(*) FROM storage.buckets WHERE public IS NOT TRUE),
  'public_storage_buckets',(SELECT count(*) FROM storage.buckets WHERE public IS TRUE));
'@
  $rlsOutput = docker exec -e PGPASSWORD=picom_restore_task_only $name psql -h 127.0.0.1 -U supabase_admin -d picom_restore -Atq -v ON_ERROR_STOP=1 -c $rlsSql 2>&1
  Assert-Native "rls_matrix" $rlsOutput
  $rlsJson = ($rlsOutput | Where-Object { $_ -match "^\{" } | Select-Object -Last 1)
  if (-not $rlsJson) { throw "RLS matrix output missing" }
  $rls = $rlsJson | ConvertFrom-Json
  if ($rls.sensitive_without_rls -ne 0 -or $rls.dm_policy_count -lt 1 -or $rls.public_storage_buckets -ne 0) { throw "RLS/private-storage matrix failed" }
  Record ("rls=" + $rlsJson)

  $actorSql = @'
WITH chosen AS (
  SELECT c.id, c.owner_id
  FROM public.communities c
  WHERE (SELECT count(*) FROM public.community_members m WHERE m.community_id=c.id AND m.user_id<>c.owner_id) >= 3
  ORDER BY c.id LIMIT 1
)
SELECT id, owner_id,
  (SELECT user_id FROM public.community_members WHERE community_id=chosen.id AND user_id<>chosen.owner_id ORDER BY user_id OFFSET 0 LIMIT 1),
  (SELECT user_id FROM public.community_members WHERE community_id=chosen.id AND user_id<>chosen.owner_id ORDER BY user_id OFFSET 1 LIMIT 1),
  (SELECT user_id FROM public.community_members WHERE community_id=chosen.id AND user_id<>chosen.owner_id ORDER BY user_id OFFSET 2 LIMIT 1),
  (SELECT p.id FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id=chosen.id AND m.user_id=p.id) ORDER BY p.id LIMIT 1),
  (SELECT user_id FROM auth.sessions ORDER BY created_at LIMIT 1)
FROM chosen;
'@
  $actorOutput = docker exec -e PGPASSWORD=picom_restore_task_only $name psql -h 127.0.0.1 -U supabase_admin -d picom_restore -AtF "|" -v ON_ERROR_STOP=1 -c $actorSql 2>&1
  Assert-Native "actor_select" $actorOutput
  $parts = (($actorOutput | Select-Object -Last 1).Trim()).Split("|")
  if ($parts.Count -ne 7) { throw "actor selection returned $($parts.Count) fields" }
  foreach ($value in $parts) {
    if ($value -notmatch "^[0-9a-fA-F-]{36}$") { throw "actor selection returned an invalid UUID" }
  }
  $community, $owner, $actor1, $actor2, $actor3, $outsider, $sessionUser = $parts
  Record "actor_select=PASS ids_redacted=7"

  docker cp $LifecycleSqlPath ($name + ":/tmp/task624-lifecycle.sql") | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "copy lifecycle SQL failed" }
  $lifecycleOutput = docker exec -e PGPASSWORD=picom_restore_task_only $name psql -h 127.0.0.1 -U supabase_admin -d picom_restore -Atq -v ON_ERROR_STOP=1 -v community=$community -v owner=$owner -v actor1=$actor1 -v actor2=$actor2 -v actor3=$actor3 -v outsider=$outsider -v session_user=$sessionUser -f /tmp/task624-lifecycle.sql 2>&1
  Assert-Native "lifecycle_drill" $lifecycleOutput
  $resultJson = $lifecycleOutput | Where-Object { $_ -match "^\{" } | Select-Object -Last 1
  if (-not $resultJson) { throw "lifecycle result JSON missing" }
  Record ("lifecycle_drill=PASS operations=" + $resultJson)
  Record "result=ISOLATED_RESTORE_AND_DATABASE_LIFECYCLE_PASS"
  Record "storage_object_bytes=BLOCKED provider_object_recovery_not_executed"
  Record "auth_api_token_rejection=BLOCKED GoTrue_service_not_started"
  Record "v1_release_gate=BLOCKED RB-11_remains_open"
}
catch {
  Record ("result=BLOCKED error=" + $_.Exception.Message)
  throw
}
finally {
  $log | Set-Content -LiteralPath $evidence -Encoding UTF8
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  docker inspect $name 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { docker rm -f $name 2>$null | Out-Null }
  $ErrorActionPreference = $previousPreference
  Write-Output "cleanup=isolated_container_removed"
  Write-Output "EVIDENCE=$evidence"
}
