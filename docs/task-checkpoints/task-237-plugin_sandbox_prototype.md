# Task 237 checkpoint: plugin sandbox prototype

- Added an offline declarative manifest validation harness with synthetic fixtures, deny-by-default capabilities, forbidden executable fields and active kill switch.
- Added no runtime loader, dynamic/evaluated code, native/IPC/network/shell/plugin filesystem access or user entry point.
- Security review/policy approval remains required before any executable prototype.
- Validation: `npm run plugins:sandbox:prototype`, `npm run plugins:marketplace:policy:smoke`.
