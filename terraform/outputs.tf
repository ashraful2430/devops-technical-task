output "server_public_ip" {
  description = "Public IP of the deployed EC2 instance"
  value       = aws_eip.app_eip.public_ip
}

output "server_public_dns" {
  description = "Public DNS of the deployed EC2 instance"
  value       = aws_instance.app_server.public_dns
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ${var.key_pair_name}.pem ubuntu@${aws_eip.app_eip.public_ip}"
}

output "api_url" {
  description = "URL to access the API"
  value       = "http://${aws_eip.app_eip.public_ip}/status"
}
