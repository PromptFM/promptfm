output "public_ip" {
  description = "Reserved public IPv4 of the streamer VM. Point stream.promptfm.live here at cutover."
  value       = oci_core_public_ip.streamer.ip_address
}

output "ssh" {
  description = "SSH command"
  value       = "ssh ubuntu@${oci_core_public_ip.streamer.ip_address}"
}

output "ansible_inventory_line" {
  description = "Line for infra/ansible/inventory.ini"
  value       = "promptfm-streamer-oci ansible_host=${oci_core_public_ip.streamer.ip_address} ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/google_compute_engine"
}

output "image_used" {
  description = "Ubuntu image the VM was created from"
  value       = data.oci_core_images.ubuntu_arm.images[0].display_name
}

output "home_region" {
  description = "Tenancy home region (Always Free A1 lives here)"
  value       = local.home_region
}
