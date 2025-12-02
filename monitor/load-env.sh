#!/bin/bash

# Script to export environment variables from .env file
# Usage:
#   source ./load-env.sh          # Source to export to current shell
#   ./load-env.sh                 # Execute to export to current shell
#   ./load-env.sh && npm start    # Export and run command

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE" >&2
    # Return instead of exit when sourced
    if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
        return 1 2>/dev/null || exit 1
    else
        exit 1
    fi
fi

# Function to export environment variables from .env file
load_env() {
    # Read .env file line by line
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip empty lines
        if [ -z "$line" ]; then
            continue
        fi

        # Skip comments (lines starting with #)
        if [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi

        # Remove leading/trailing whitespace
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        # Skip if line is empty after trimming
        if [ -z "$line" ]; then
            continue
        fi

        # Check if line contains = (assignment)
        if [[ "$line" =~ ^[^=]+= ]]; then
            # Extract key and value
            key=$(echo "$line" | cut -d '=' -f 1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            value=$(echo "$line" | cut -d '=' -f 2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

            # Remove quotes if present (handles both single and double quotes)
            if [[ "$value" =~ ^\".*\"$ ]] || [[ "$value" =~ ^\'.*\'$ ]]; then
                value=$(echo "$value" | sed 's/^["'\'']//;s/["'\'']$//')
            fi

            # Skip if key is empty
            if [ -z "$key" ]; then
                continue
            fi

            # Export the variable
            export "$key=$value"
        fi
    done < "$ENV_FILE"
}

# Load environment variables
load_env

# If script is being sourced, don't exit
if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
    # Script is being sourced
    echo "Environment variables loaded from .env file"
    return 0 2>/dev/null || true
else
    # Script is being executed
    echo "Environment variables exported from .env file"
    echo "You can now run your commands, or source this script to export to current shell:"
    echo "  source ./load-env.sh"
fi

