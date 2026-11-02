# infra/Makefile
# One-click operations for PromptFM infrastructure and streaming configuration

.PHONY: help deploy plan apply destroy ansible status logs

help:
	@echo "PromptFM Streamer Infrastructure Commands:"
	@echo "  make deploy     - Full automated deployment (Terraform -> Ansible -> Verify)"
	@echo "  make plan       - Preview Terraform infrastructure changes"
	@echo "  make apply      - Apply Terraform changes"
	@echo "  make ansible    - Run Ansible playbook against the live VM"
	@echo "  make status     - Inspect live container and audio stream health"
	@echo "  make logs       - Tail live Icecast & Liquidsoap container logs"
	@echo "  make destroy    - Teardown cloud resources"

deploy:
	@chmod +x ./deploy.sh && ./deploy.sh

plan:
	@cd terraform && terraform init && terraform plan

apply:
	@cd terraform && terraform init && terraform apply -auto-approve

ansible:
	@cd ansible && ansible-playbook -i inventory.ini playbook.yml

status:
	@gcloud compute ssh promptfm-streamer \
		--project="promptfm-radio-1793623670" \
		--zone="us-central1-a" \
		--command="sudo docker ps && curl -sI http://localhost:8000/status.xsl | head -n 5"

logs:
	@gcloud compute ssh promptfm-streamer \
		--project="promptfm-radio-1793623670" \
		--zone="us-central1-a" \
		--command="cd ~/streamer && sudo docker-compose logs --tail=50 -f"

destroy:
	@cd terraform && terraform destroy -auto-approve

