#!/bin/bash
set -e  # Exit on error

# Cleanup function
cleanup() {
    echo "Cleaning up..."

    if [ "$(basename "$(pwd)")" == "test-repo" ]; then
        echo "Moving up one level"
        cd ..
    fi
    if [ -d "test-repo" ]; then
        rm -r test-repo/
    fi
}

# Setup trap for cleanup
cleanup

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Starting CLI tests..."

# Create and enter test directory
mkdir -p test-repo
cd test-repo

# Initialize the repository
echo "1. Initializing repository..."
../secrets-cli init

# Create scopes with glob patterns
echo "2. Creating scopes..."
../secrets-cli scope create --id stg --path ".*\.stg\.env.*"
../secrets-cli scope create --id prod --path ".*\.prod\.env.*"

# Generate keys for different roles
echo "3. Generating keys..."
../secrets-cli key generate --name "root" --email "root@company.com" --scopes default,stg,prod
../secrets-cli key generate --name "dev" --email "dev@company.com" --scopes default
../secrets-cli key generate --name "stage" --email "stage@company.com" --scopes default,stg
../secrets-cli key generate --name "production" --email "prod@company.com" --scopes default,stg,prod

# Create test environment files
echo "4. Creating test environment files..."
echo "TEST_VAR=test" > .env
echo "STG_VAR=staging" > .stg.env
echo "PROD_VAR=production" > .prod.env

# Encrypt files
echo "5. Encrypting environment files..."
../secrets-cli encrypt --file .env --key-file .age-keys/root.txt --output .env.enc
../secrets-cli encrypt --file .stg.env --key-file .age-keys/root.txt --output .stg.env.enc
../secrets-cli encrypt --file .prod.env --key-file .age-keys/root.txt --output .prod.env.enc

# Test access control
echo "6. Testing access control..."

test_decrypt() {
    local key=$1
    local file=$2
    local expected=$3
    
    echo "Testing $key with $file..."
    local original_file="${file%.enc}"
    local uniqueId="$(date +%Y-%m-%d)"
    local decrypted_file="${file%.enc}.${uniqueId}.decrypted"
    
    if ../secrets-cli decrypt --file "$file" --key-file ".age-keys/$key.txt" --output "$decrypted_file" 2>/dev/null; then
        # First check if the decrypted file exists
        if [ ! -f "$decrypted_file" ]; then
            if [ "$expected" = "fail" ]; then
                echo -e "${GREEN}✓ $key cannot decrypt $file (expected)${NC}"
            else
                echo -e "${RED}✗ $key should be able to decrypt $file (no output file created)${NC}"
                exit 1
            fi
            return
        fi

        # If file exists, check content
        if diff "$original_file" "$decrypted_file" >/dev/null; then
            if [ "$expected" = "success" ]; then
                echo -e "${GREEN}✓ $key can decrypt $file (expected)${NC}"
            else
                echo -e "${RED}✗ $key should not be able to decrypt $file${NC}"
                exit 1
            fi
        else
            echo -e "${RED}✗ Decrypted content does not match original file${NC}"
            exit 1
        fi
    else
        if [ "$expected" = "fail" ]; then
            echo -e "${GREEN}✓ $key cannot decrypt $file (expected)${NC}"
        else
            echo -e "${RED}✗ $key should be able to decrypt $file${NC}"
            exit 1
        fi
    fi
    
    # Clean up
    rm -f "$decrypted_file"
}

# Root access tests
test_decrypt "root" ".env.enc" "success"
test_decrypt "root" ".stg.env.enc" "success"
test_decrypt "root" ".prod.env.enc" "success"

# Dev access tests
test_decrypt "dev" ".env.enc" "success"
test_decrypt "dev" ".stg.env.enc" "fail"
test_decrypt "dev" ".prod.env.enc" "fail"

# Stage access tests
test_decrypt "stage" ".env.enc" "success"
test_decrypt "stage" ".stg.env.enc" "success"
test_decrypt "stage" ".prod.env.enc" "fail"

# Production access tests
test_decrypt "production" ".env.enc" "success"
test_decrypt "production" ".stg.env.enc" "success"
test_decrypt "production" ".prod.env.enc" "success"

# Test key removal
echo "7. Testing key removal..."

test_key_removal() {
    local key=$1
    echo "Testing removal of $key key..."
    
    # Remove the key
    ../secrets-cli key remove --name "$key" --remove-private-key
    
    # Verify key file is gone
    if [ ! -f ".age-keys/$key.txt" ]; then
        echo -e "${GREEN}✓ Key file for $key was removed${NC}"
    else
        echo -e "${RED}✗ Key file for $key still exists${NC}"
        exit 1
    fi
    
    # Try to use the removed key (should fail)
    if ! ../secrets-cli decrypt --file ".env.enc" --key-file ".age-keys/$key.txt" --output ".env.removed.test" 2>/dev/null; then
        echo -e "${GREEN}✓ Removed key cannot be used${NC}"
    else
        echo -e "${RED}✗ Removed key can still be used${NC}"
        exit 1
    fi

    # Clean up
    rm -f ".env.removed.test"
}

# Run the new tests
test_key_removal "dev"

# Test key rotation and re-encryption
echo "8. Testing key rotation and re-encryption..."

test_key_rotation() {
    local remove_key=$1
    local encrypt_key=$2
    local file=".env"
    echo "Testing key rotation - removing ${remove_key}, using ${encrypt_key}..."
    
    # Backup original encrypted file
    cp "${file}.enc" "${file}.enc.backup"
    
    # Backup the key before removal
    cp ".age-keys/${remove_key}.txt" "${remove_key}.txt.backup"
    
    # Remove the key
    ../secrets-cli key remove --name "$remove_key"
    
    # Verify we can still decrypt with backed up key
    if ../secrets-cli decrypt --file "${file}.enc.backup" --key-file "${remove_key}.txt.backup" --output "${file}.restored" 2>/dev/null; then
        echo -e "${GREEN}✓ Can decrypt with backed up key${NC}"
        
        # Verify content matches original
        if diff "${file}" "${file}.restored" >/dev/null; then
            echo -e "${GREEN}✓ Decrypted content matches original${NC}"
        else
            echo -e "${RED}✗ Decrypted content does not match original${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ Cannot decrypt with backed up key${NC}"
        exit 1
    fi
    
    # Re-encrypt with remaining key
    ../secrets-cli encrypt --file "${file}" --key-file ".age-keys/${encrypt_key}.txt" --output "${file}.new.enc"
    
    # Try to decrypt with remaining key
    if ../secrets-cli decrypt --file "${file}.new.enc" --key-file ".age-keys/${encrypt_key}.txt" --output "${file}.new.decrypted" 2>/dev/null; then
        echo -e "${GREEN}✓ Can decrypt with remaining key${NC}"
        
        # Verify content matches original
        if diff "${file}" "${file}.new.decrypted" >/dev/null; then
            echo -e "${GREEN}✓ Re-encrypted content matches original${NC}"
        else
            echo -e "${RED}✗ Re-encrypted content does not match original${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ Cannot decrypt with remaining key${NC}"
        exit 1
    fi
    
    # Verify removed key cannot decrypt new file
    if ! ../secrets-cli decrypt --file "${file}.new.enc" --key-file "${remove_key}.txt.backup" --output "${file}.should.fail" 2>/dev/null; then
        echo -e "${GREEN}✓ Removed key cannot decrypt new file (expected)${NC}"
    else
        echo -e "${RED}✗ Removed key can still decrypt new file (unexpected)${NC}"
        exit 1
    fi
    
    # Cleanup
    rm -f "${file}.enc.backup" "${remove_key}.txt.backup" "${file}.restored" "${file}.new.enc" "${file}.new.decrypted" "${file}.should.fail"
}

# Run the key rotation test
test_key_rotation "stage" "root"

cleanup
echo "All tests completed successfully!"
