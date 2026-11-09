# /etc/liquidsoap/radio-standby.liq
# Standby: loops the fallback track into Icecast and never calls the PromptFM API.
# A second streamer that polls /api/radio/next would consume the live queue and double every
# Discord/Telegram "now playing" post, so a host that is not yet on air runs this script instead.

settings.log.stdout.set(true)
settings.log.level.set(3)

standby = mksafe(single("annotate:title=\"PromptFM Standby\",artist=\"PromptFM Core\",promptfm_id=\"\":/etc/liquidsoap/fallback.mp3"))

output.icecast(
  %mp3(bitrate=128, samplerate=44100),
  host="icecast",
  port=8000,
  password="promptfm_source_2026",
  mount="/stream.mp3",
  encoding="UTF-8",
  name="PromptFM — 24/7 AI Generated Music Radio",
  description="Continuous generative beats, AI DJ monologues, and community-curated music.",
  url="https://promptfm.live",
  genre="AI Music / Electronic / Ambient",
  standby
)
