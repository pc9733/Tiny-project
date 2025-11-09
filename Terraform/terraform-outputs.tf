output "dynamodb_table_name" {
  description = "Name of the DynamoDB table."
  value       = aws_dynamodb_table.companies.name
}

output "instance_id" {
  description = "ID of the EC2 instance running the app."
  value       = module.companies_app.instance_id
}

output "instance_public_ip" {
  description = "Public IPv4 address for quick access."
  value       = module.companies_app.instance_public_ip
}
