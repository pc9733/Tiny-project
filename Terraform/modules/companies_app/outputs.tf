output "instance_id" {
  description = "ID of the EC2 instance hosting the application."
  value       = aws_instance.this.id
}

output "instance_public_ip" {
  description = "Public IPv4 address of the EC2 instance."
  value       = aws_instance.this.public_ip
}
