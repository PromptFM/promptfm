# /etc/liquidsoap/radio.liq
# PromptFM 24/7 Dynamic Radio Stream Engine
# Connects to PromptFM /api/radio/next to query upcoming tracks and DJ drops,
# downloads R2 MP3s, crossfades, and streams 128 kbps MP3 to Icecast.

# Settings
settings.log.stdout.set(true)
settings.log.level.set(3)

# 1. Fallback ambient audio loop in case of API or network disconnect
emergency_fallback = mksafe(single("/etc/liquidsoap/fallback.mp3"))

# 2. Dynamic track fetcher from PromptFM API
def get_next_promptfm_track() =
  # Call PromptFM API endpoint
  result = process.read("curl -s 'https://promptfm.vercel.app/api/radio/next?format=uri'")
  uri = string.trim(result)
  if uri == "" then
    "/etc/liquidsoap/fallback.mp3"
  else
    uri
  end
end

# Request dynamic stream
dynamic_stream = request.dynamic(get_next_promptfm_track)

# 3. Crossfade between tracks (1.5s smooth transition)
stream = crossfade(duration=1.5, dynamic_stream)

# Fallback safely if dynamic stream fails
radio = fallback(track_sensitive=false, [stream, emergency_fallback])

# 4. Stream to Icecast
output.icecast(
  %mp3(bitrate=128, samplerate=44100),
  host="icecast",
  port=8000,
  password="promptfm_source_2026",
  mount="/stream.mp3",
  name="PromptFM — 24/7 AI Generated Music Radio",
  description="Continuous generative beats, AI DJ monologues, and community-curated music.",
  url="https://promptfm.vercel.app",
  genre="AI Music / Electronic / Ambient",
  radio
)

