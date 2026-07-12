# Noise Shield acoustic QA plan

## Safety and consent

Use a dedicated test account, a non-sensitive spoken phrase, and consenting participants only. Picom does not provide a recorder in this harness. Do not upload or retain test audio. Observe quality live through a second consenting client or an OS-local loopback tool approved for the test lab, then destroy any external temporary capture immediately.

Enhanced and Voice Focus rows are `BLOCKED: PROVIDER_UNAVAILABLE` when the official provider package/runtime is absent. Never relabel Standard fallback as Enhanced or Voice Focus.

## Controlled setup

1. Use the same room, network, speaker phrase, microphone distance, output level, and 60-second duration for each mode.
2. Record Electron/Picom version, OS, microphone class, selected-device key from Support diagnostics, and provider state. Do not record a full device ID or label.
3. Run Off, Standard, Enhanced, and Voice Focus in that order. Rejoin between modes if the test calls for fresh initialization.
4. Rate each quality field from 1 (unusable) to 5 (excellent). Record dropouts as a count and fallback as the exact safe code/status.
5. Stop immediately if feedback, clipping, unexpected capture, or a non-consenting voice enters the test.

## Environment matrix

Run all four modes for every row. `Enhanced*` and `Voice Focus*` run only when diagnostics truthfully report that mode active.

| ID | Condition | Reproducible setup | Modes |
| --- | --- | --- | --- |
| A01 | Quiet room | Ambient room, no intentional noise, 50 cm microphone distance | Off / Standard / Enhanced* / Voice Focus* |
| A02 | Laptop fan | Fixed high-performance fan profile, laptop microphone | Off / Standard / Enhanced* / Voice Focus* |
| A03 | Mechanical keyboard | Type the same 80-word passage 30 cm from microphone | Off / Standard / Enhanced* / Voice Focus* |
| A04 | Air conditioner / hum | Constant HVAC or open-licensed synthetic 50/60 Hz hum from a separate speaker | Off / Standard / Enhanced* / Voice Focus* |
| A05 | One nearby background speaker | One consenting person reads a fixed phrase 1.5 m behind the primary speaker | Off / Standard / Enhanced* / Voice Focus* |
| A06 | Multiple nearby speakers | Two consenting background readers at fixed positions | Off / Standard / Enhanced* / Voice Focus* |
| A07 | Speaker echo | Fixed Picom output level through laptop speakers; no headset | Off / Standard / Enhanced* / Voice Focus* |
| A08 | USB microphone | Cardioid USB microphone, fixed gain and 30 cm distance | Off / Standard / Enhanced* / Voice Focus* |
| A09 | Laptop microphone | Built-in array, fixed 50 cm distance | Off / Standard / Enhanced* / Voice Focus* |
| A10 | Bluetooth headset | Connected headset after a clean device refresh | Off / Standard / Enhanced* / Voice Focus* |
| A11 | Loud transient | One controlled clap or open-licensed transient from a speaker at a marked level | Off / Standard / Enhanced* / Voice Focus* |

## Result sheet

Create one row per environment and mode.

| Run ID | Mode requested | Mode applied | Speech intelligibility 1-5 | Noise reduction 1-5 | Clipping/pumping 1-5 | Speech distortion 1-5 | Latency 1-5 | Dropouts | Fallback code/status | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Example-A01-Off | Off | Off | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | Native desktop execution required |

## Voice Focus warning tests

- Shared microphone: confirm the warning states that other intended speakers may be suppressed; Voice Focus remains opt-in.
- Multiple intended speakers: confirm Standard remains selected by default and Voice Focus requires explicit selection.
- Music/studio input: confirm the warning rejects this use case and Radio/Podcast/music tracks never enter the processor.
- Unsupported provider: confirm the control is disabled with a specific explanation and the applied state remains Standard.

## Switch and recovery observations

During A08-A10, switch input devices while speaking, unplug the selected test device once, revoke/restore permission manually once, and perform one reconnect. Record dropout duration, duplicate audio, processor state, fallback code, and whether the system default recovered. Do not repeatedly trigger OS permission prompts.
