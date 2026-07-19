# Task 33 — Topic Clustering

Groups **channels/communities** into topic clusters from structural signals (co-membership,
category, co-activity) for discovery — never by reading message content.

## Architecture
```
membership + category + co-activity graph (23) ──► clustering ──► cluster labels ──► discovery/recommend
```

## Method
- Graph/co-occurrence clustering over community–community and member-overlap edges;
  labels from existing category taxonomy (not inferred from text).

## Data & privacy
- Uses aggregate structural signals only; **no message content**, no per-user topic
  profiles. Small clusters k-suppressed.

## Database / infra
- `topic_clusters(cluster_id, label, members)`; `community_cluster(community_id, cluster_id)`.

## APIs / jobs
- Periodic clustering job; feeds AI Recommendation Engine (11) and discovery.

## Dashboard metrics
- Cluster sizes, cross-cluster overlap, coverage.

## Tests
- No content used; clusters reproducible; k-suppressed; labels from taxonomy only.

## Validation checklist
- [ ] structural signals only · [ ] no content · [ ] no per-user topic profile · [ ] k-suppressed

## Risks / blockers
- Mislabeling → keep human-readable taxonomy labels, allow admin override. Uses Warehouse (23).

**Next:** Task 34 — Sentiment-Safe Analytics.
