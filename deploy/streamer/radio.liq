# /etc/liquidsoap/radio.liq
# PromptFM 24/7 Dynamic Radio Stream Engine
# Connects to PromptFM /api/radio/next to query upcoming tracks and DJ drops,
# downloads R2 MP3s, crossfades, and streams 128 kbps MP3 to Icecast.
# Synchronizes track transitions via native HTTP requests and ICY metadata.

# Settings
settings.log.stdout.set(true)
settings.log.level.set(3)

# 1. Fallback ambient audio loop in case of API or network disconnect
emergency_fallback = mksafe(single("annotate:title=\"PromptFM Ambient AI Anthem\",artist=\"PromptFM Core\",promptfm_id=\"demo-fallback\":/etc/liquidsoap/fallback.mp3"))

# 2. Dynamic track fetcher from PromptFM API with annotate metadata
def get_next_promptfm_track() =
  # Call PromptFM API endpoint with native HTTP GET
  result = try
    http.get("https://promptfm.live/api/radio/next?format=annotate")
  catch _ do
    ""
  end
  uri = string.trim(result)
  target = if uri == "" then
    "annotate:title=\"PromptFM Ambient AI Anthem\",artist=\"PromptFM Core\",promptfm_id=\"demo-fallback\":/etc/liquidsoap/fallback.mp3"
  else
    uri
  end
  request.create(target)
end

# Request dynamic stream
dynamic_stream = request.dynamic(get_next_promptfm_track)

# 3. Crossfade between tracks (1.5s smooth transition)
stream = crossfade(duration=1.5, dynamic_stream)

# Fallback safely if dynamic stream fails
radio = fallback(track_sensitive=false, [stream, emergency_fallback])

# 4. On-Air Transition Hook: Notifies PromptFM when the track actually airs
def on_airplay_start(meta) =
  let item_id = meta["promptfm_id"]
  let title = meta["title"]
  let artist = meta["artist"]
  print(">>> [AIRPLAY TRANSITION] #{title} by #{artist} (ID: #{item_id})")
  if item_id != "" then
    try
      ignore(http.post(data="{\"channel\":\"main\",\"item_id\":\"" ^ item_id ^ "\"}", headers=[("Content-Type", "application/json")], "https://promptfm.live/api/radio/started"))
    catch _ do
      ()
    end
  end
end

radio = source.on_track(radio, on_airplay_start)

# 5. Stream to Icecast
output.icecast(
  %mp3(bitrate=128, samplerate=44100),
  host="icecast",
  port=8000,
  password="promptfm_source_2026",
  mount="/stream.mp3",
  name="PromptFM — 24/7 AI Generated Music Radio",
  description="Continuous generative beats, AI DJ monologues, and community-curated music.",
  url="https://promptfm.live",
  genre="AI Music / Electronic / Ambient",
  radio
)
