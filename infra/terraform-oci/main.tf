# infra/terraform-oci/main.tf
# PromptFM streamer host on Oracle Cloud Always Free (Ampere A1, up to 10 TB/month outbound).
# Moves audio egress off GCP, where only 1 GB/month is free.

data "oci_identity_region_subscriptions" "all" {
  tenancy_id = nonsensitive(local.oci.tenancy_ocid)
}

locals {
  home_region = [for r in data.oci_identity_region_subscriptions.all.region_subscriptions : r.region_name if r.is_home_region][0]
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = local.compartment_id
}

data "oci_core_images" "ubuntu_arm" {
  compartment_id           = local.compartment_id
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_vcn" "streamer" {
  compartment_id = local.compartment_id
  display_name   = "promptfm-streamer-vcn"
  cidr_blocks    = [var.vcn_cidr]
  dns_label      = "promptfm"
}

resource "oci_core_internet_gateway" "streamer" {
  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.streamer.id
  display_name   = "promptfm-streamer-igw"
  enabled        = true
}

resource "oci_core_route_table" "public" {
  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.streamer.id
  display_name   = "promptfm-streamer-public"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.streamer.id
  }
}

# Only 22, 80 and 443 are open. Icecast (8000) stays internal behind Caddy.
resource "oci_core_security_list" "streamer" {
  compartment_id = local.compartment_id
  vcn_id         = oci_core_vcn.streamer.id
  display_name   = "promptfm-streamer"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    source   = var.ssh_allowed_cidr
    protocol = "6"
    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    source   = "0.0.0.0/0"
    protocol = "6"
    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    source   = "0.0.0.0/0"
    protocol = "6"
    tcp_options {
      min = 443
      max = 443
    }
  }
}

resource "oci_core_subnet" "public" {
  compartment_id    = local.compartment_id
  vcn_id            = oci_core_vcn.streamer.id
  display_name      = "promptfm-streamer-public"
  cidr_block        = var.vcn_cidr
  dns_label         = "streamer"
  route_table_id    = oci_core_route_table.public.id
  security_list_ids = [oci_core_security_list.streamer.id]
}

resource "oci_core_instance" "streamer" {
  compartment_id      = local.compartment_id
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_index].name
  display_name        = var.instance_name
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_arm.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_gb
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.public.id
    assign_public_ip = false
    display_name     = "promptfm-streamer-vnic"
  }

  metadata = {
    ssh_authorized_keys = file(pathexpand(var.ssh_pub_key_path))
    user_data           = base64encode(file("${path.module}/cloud-init.yaml"))
  }

  lifecycle {
    precondition {
      condition     = nonsensitive(local.oci.region) == local.home_region
      error_message = "Always Free A1 only exists in the home region (${local.home_region}). The credentials secret is set to ${nonsensitive(local.oci.region)}."
    }

    # A newer Ubuntu image must not recreate the VM and lose the streamer state.
    ignore_changes = [source_details[0].source_id, metadata["user_data"]]
  }
}

data "oci_core_vnic_attachments" "streamer" {
  compartment_id = local.compartment_id
  instance_id    = oci_core_instance.streamer.id
}

data "oci_core_private_ips" "streamer" {
  vnic_id = data.oci_core_vnic_attachments.streamer.vnic_attachments[0].vnic_id
}

# Reserved so the address survives stop/start and the DNS record never has to change.
resource "oci_core_public_ip" "streamer" {
  compartment_id = local.compartment_id
  display_name   = "promptfm-streamer-ip"
  lifetime       = "RESERVED"
  private_ip_id  = data.oci_core_private_ips.streamer.private_ips[0].id
}

# $0 policy, layer 1: alerts. A budget only emails; it does not stop spending.
resource "oci_budget_budget" "streamer" {
  count          = local.budget_email != "" ? 1 : 0
  compartment_id = local.compartment_id
  amount         = 1
  reset_period   = "MONTHLY"
  display_name   = "promptfm-1-usd-alert"
  target_type    = "COMPARTMENT"
  targets        = [local.compartment_id]
}

resource "oci_budget_alert_rule" "streamer" {
  count          = local.budget_email != "" ? 1 : 0
  budget_id      = oci_budget_budget.streamer[0].id
  display_name   = "promptfm-1-usd-actual"
  type           = "ACTUAL"
  threshold      = 100
  threshold_type = "PERCENTAGE"
  recipients     = local.budget_email
  message        = "PromptFM Oracle spend reached $1."
}

# Outbound traffic is the only thing that can cost money here: 10 TB/month is free, a 128 kbps
# listener is about 41 GB/month. The alarm fires well before the monthly limit.
resource "oci_ons_notification_topic" "alerts" {
  count          = local.budget_email != "" ? 1 : 0
  compartment_id = local.compartment_id
  name           = "promptfm-streamer-alerts"
  description    = "PromptFM streamer cost and traffic alerts"
}

resource "oci_ons_subscription" "alerts_email" {
  count          = local.budget_email != "" ? 1 : 0
  compartment_id = local.compartment_id
  topic_id       = oci_ons_notification_topic.alerts[0].id
  protocol       = "EMAIL"
  endpoint       = local.budget_email
}

resource "oci_monitoring_alarm" "egress" {
  count                 = local.budget_email != "" ? 1 : 0
  compartment_id        = local.compartment_id
  metric_compartment_id = local.compartment_id
  display_name          = "promptfm-streamer-egress-daily"
  namespace             = "oci_vcn"
  query                 = "VnicToNetworkBytes[1d]{resourceId = \"${data.oci_core_vnic_attachments.streamer.vnic_attachments[0].vnic_id}\"}.sum() > ${var.egress_alarm_gb_per_day * 1000000000}"
  severity              = "WARNING"
  is_enabled            = true
  destinations          = [oci_ons_notification_topic.alerts[0].id]
  body                  = "PromptFM streamer sent more than ${var.egress_alarm_gb_per_day} GB in a day. The free allowance is 10 TB/month."
}

# $0 policy, layer 2: a hard stop. Quota policies are enforced by Oracle, so nothing in this tenancy
# can create billable compute or block storage, from Terraform or the console. Allowed: the Always
# Free Ampere A1 allowance (2 OCPU / 12 GB) and 200 GB of block storage, so the VM itself is allowed.
resource "oci_limits_quota" "free_only" {
  count          = var.enforce_quotas ? 1 : 0
  compartment_id = nonsensitive(local.oci.tenancy_ocid)
  name           = "promptfm-always-free-only"
  description    = "Only the Always Free Ampere A1 allowance and 200 GB of block storage"

  statements = [
    "zero compute-core quotas in tenancy",
    "set compute-core quota standard-a1-core-count to 2 in tenancy",
    "set compute-core quota standard-a1-core-regional-count to 2 in tenancy",
    "zero compute-memory quotas in tenancy",
    "set compute-memory quota standard-a1-memory-count to 12 in tenancy",
    "set compute-memory quota standard-a1-memory-regional-count to 12 in tenancy",
    "zero block-storage quotas in tenancy",
    "set block-storage quota total-storage-gb to 200 in tenancy",
  ]

}
