output "db_endpoint" { value = aws_db_instance.main.endpoint }
output "db_name" { value = aws_db_instance.main.db_name }
output "db_username" { value = aws_db_instance.main.username }
output "db_url_ssm_path" { value = aws_ssm_parameter.db_url.name }
