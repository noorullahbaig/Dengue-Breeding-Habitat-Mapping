# Connecting to EC2

To connect to your EC2 instance using your SSH key, follow these steps:

### 1. Set Key Permissions (One-time setup)
If you haven't already, you must restrict the permissions on your `.pem` file so it is not publicly viewable, otherwise SSH will reject it for security reasons. Run this command:
```bash
chmod 400 /Users/noorullah/Developer/prototype/denguewatch-noorullah-key.pem
```

### 2. Connect to the Server
Run the following command to connect to your instance as the `ec2-user`:
```bash
ssh -i /Users/noorullah/Developer/prototype/denguewatch-noorullah-key.pem ec2-user@<YOUR-EC2-IP>
```

*(Note: If you are prompted with "Are you sure you want to continue connecting?", type `yes` and press Enter.)*
