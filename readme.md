# Secrets CLI

A secure command-line interface tool for managing secrets using Age + SOPS.

## Installation

### Linux
```bash
curl -L https://github.com/ReVision-Labs/secrets-cli/releases/latest/download/secrets-cli-linux -o secrets-cli
chmod +x secrets-cli
sudo mv secrets-cli /usr/local/bin/
```

### macOS
```bash
curl -L https://github.com/ReVision-Labs/secrets-cli/releases/latest/download/secrets-cli-macos -o secrets-cli
chmod +x secrets-cli
sudo mv secrets-cli /usr/local/bin/
```

### Windows
Download the executable from our [releases page](https://github.com/ReVision-Labs/secrets-cli/releases/latest/download/secrets-cli-windows.exe) and add it to your system PATH.

## Usage

```bash
secrets-cli [command] [options]
```

## Available Commands

### Basic Commands
- `init`: Initialize a new secrets configuration in the current directory
- `encrypt`: Encrypt a file using Age encryption
- `decrypt`: Decrypt a file using Age encryption

### Key Management
- `key generate`: Generate a new encryption key
- `key update`: Update user's access scopes
- `key list`: List all encryption keys and their scopes
- `key remove`: Remove a key and optionally its private key file

### Scope Management
- `scope create`: Create a new encryption scope with optional path pattern
- `scope list`: List all available scopes

### Options
- `--help`: Show help information

## Examples

Initialize a new project:
```bash
secrets-cli init my-project
```

Generate a new key (defaults to git config):
```bash
secrets-cli key generate --name "john" --email "john@example.com" --scopes "default,prod"
```

Create a new scope:
```bash
secrets-cli scope create --id prod --path ".*\.prod\.env.*"
```

Encrypt a file:
```bash
secrets-cli encrypt --file config.env --output config.env.enc
```

Decrypt a file:
```bash
secrets-cli decrypt --file config.env.enc --output config.env
```

List all keys and their scopes:
```bash
secrets-cli key list
```

Update user's access scopes:
```bash
secrets-cli key update --user "john" --scopes "default,staging,prod"
```

Remove a key:
```bash
secrets-cli key remove --name "john" --remove-private-key
```
