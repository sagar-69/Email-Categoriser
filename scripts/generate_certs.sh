#!/bin/bash
# Generate self-signed SSL certificates for HTTPS in development.
# Idempotent: skips if certs already exist.
#
# Usage: bash scripts/generate_certs.sh

CERT_DIR=".inbox-intel/certs"
KEY_FILE="${CERT_DIR}/key.pem"
CERT_FILE="${CERT_DIR}/cert.pem"

if [ -f "$KEY_FILE" ] && [ -f "$CERT_FILE" ]; then
    echo "✓ SSL certificates already exist at ${CERT_DIR}/"
    echo "  Key:  ${KEY_FILE}"
    echo "  Cert: ${CERT_FILE}"
    exit 0
fi

echo "Generating self-signed SSL certificates..."
mkdir -p "$CERT_DIR"

openssl req -x509 \
    -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days 365 \
    -nodes \
    -subj "/CN=localhost/O=Inbox-Intel/OU=Development" \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ SSL certificates generated successfully!"
    echo "  Key:  ${KEY_FILE}"
    echo "  Cert: ${CERT_FILE}"
    echo ""
    echo "To use HTTPS, add these to your .env:"
    echo "  SSL_KEYFILE=${KEY_FILE}"
    echo "  SSL_CERTFILE=${CERT_FILE}"
else
    echo "✗ Failed to generate certificates. Is OpenSSL installed?"
    exit 1
fi
