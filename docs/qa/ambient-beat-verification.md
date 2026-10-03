# Ambient beat — 2026-10-03

Replaced the continuous three-tone ambience with an original synthesized four-bar 112 BPM beat: kick, snare, hi-hat, bass and a quiet melody. Audio is generated once in memory and played by a looping AudioBufferSourceNode; no external assets, downloads or scheduler timers. The same saved ambient volume, mute, pause and browser audio-unlock behavior apply. Quiz feedback ducks the beat temporarily.

Audio tests cover unlock failure, pickup spam, reuse of one looping source, mute/cleanup, duration, finite samples, signal energy, clipping headroom and loop-boundary step. Browser UI remains unchanged. Actual speaker/headphone listening and physical mobile playback are not asserted by these checks.
