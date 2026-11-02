output "instance_name" {
  description = "The name of the stream server instance"
  value       = google_compute_instance.streamer.name
}

output "instance_id" {
  description = "The server-assigned unique identifier of the instance"
  value       = google_compute_instance.streamer.instance_id
}

output "zone" {
  description = "The GCP zone where the stream server is hosted"
  value       = google_compute_instance.streamer.zone
}

output "internal_ip" {
  description = "Internal private IPv4 address"
  value       = google_compute_instance.streamer.network_interface[0].network_ip
}

output "external_ip" {
  description = "External public IPv4 address"
  value       = google_compute_instance.streamer.network_interface[0].access_config[0].nat_ip
}

output "icecast_stream_url" {
  description = "Direct Icecast 2 audio stream URL"
  value       = "http://${google_compute_instance.streamer.network_interface[0].access_config[0].nat_ip}:8000/stream.mp3"
}

output "icecast_admin_url" {
  description = "Icecast administration dashboard URL"
  value       = "http://${google_compute_instance.streamer.network_interface[0].access_config[0].nat_ip}:8000/admin/"
}

output "gcs_state_bucket" {
  description = "Google Cloud Storage bucket storing Terraform state (100% Free Tier)"
  value       = google_storage_bucket.tf_state.name
}

