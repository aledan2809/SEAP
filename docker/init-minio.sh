#!/bin/bash
# Initialize MinIO bucket for SEAP Assistant

set -e

# Wait for MinIO to be ready
echo "Waiting for MinIO..."
until mc alias set myminio http://minio:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin} 2>/dev/null; do
  sleep 2
done

# Create bucket if it doesn't exist
echo "Creating bucket seap-documents..."
mc mb myminio/seap-documents --ignore-existing

# Set bucket policy to private
mc anonymous set none myminio/seap-documents

echo "MinIO initialization complete!"
