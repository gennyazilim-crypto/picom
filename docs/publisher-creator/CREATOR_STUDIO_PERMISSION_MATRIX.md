# Creator Studio Permission Matrix

| Role | streams.* | chat.moderate | analytics.read | finance.read | payout.manage | team.manage |
|------|-----------|---------------|----------------|--------------|---------------|-------------|
| OWNER | Y | Y | Y | Y | Y | Y |
| MANAGER | most (no credentials) | Y | Y | N | N | Y |
| STREAM_MANAGER | Y (+credentials) | N | N | N | N | N |
| MODERATOR | read | Y | N | N | N | N |
| ANALYST | read | N | Y | N | N | N |
| FINANCE_MANAGER | N | N | N | Y | Y | N |
| EDITOR | write/media | N | N | N | N | N |

`dashboard.read` (platform) does not grant Studio finance access.
