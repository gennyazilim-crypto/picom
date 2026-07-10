# Task 414 checkpoint: Real staging backup/restore drill

## Status

**PARTIAL / BLOCKED / No-Go.**

## Passed

- Real hosted staging schema, public data, Auth/Storage data, and role exports.
- External manifest with byte sizes and SHA-256 values.
- Source project/region/migration recorded.
- Production remained untouched.
- Failed temporary containers were cleaned up.

## Failed or blocked

- Raw restore failed on managed Auth schema ownership/version compatibility.
- Local Supabase restore target conflicted with an unrelated active project port; it was not stopped.
- No complete restored integrity matrix exists.
- No destructive lifecycle drill ran.

RB-11 remains open.