# ============================================================
# PromptFM Local Development Streamer (Liquidsoap)
# Plays local audio loop or generated synth tone to Icecast
# ============================================================

set("log.level", 3)
set("log.stdout", true)

# 1. Fallback Audio: Generates a pleasant generative synth chord / tone
# or plays local music directory if populated.
audio_source = mksafe(
  fallback(
    track_sensitive=false,
    [
      playlist(mode="random", "/music"),
      sine(duration=10.0, 440.0)
    ]
  )
)

# 2. Output stream to local Icecast instance
output.icecast(
  %mp3(bitrate=128),
  host="icecast",
  port=8000,
  password="hackme_local",
  mount="/stream.mp3",
  name="PromptFM Local Dev Radio",
  description="Local development simulated stream",
  genre="AI Music",
  url="http://localhost:3000",
  audio_source
)
