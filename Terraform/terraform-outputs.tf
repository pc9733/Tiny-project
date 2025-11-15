output "dynamodb_table_name" {
  description = "Name of the DynamoDB table."
  value       = aws_dynamodb_table.companies.name
}

output "autoscaling_group_name" {
  description = "Auto Scaling Group managing the app instances."
  value       = module.companies_app.autoscaling_group_name
}

output "launch_template_id" {
  description = "Launch template used by the Auto Scaling Group."
  value       = module.companies_app.launch_template_id
}
