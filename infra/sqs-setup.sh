#!/bin/bash
# Create SQS FIFO queues and print URLs for the ConfigMap.
# Run once after cluster is provisioned:
#   chmod +x infra/sqs-setup.sh && ./infra/sqs-setup.sh

set -e

REGION="${AWS_REGION:-us-east-1}"

create_queue() {
  local name="$1.fifo"
  aws sqs create-queue \
    --queue-name "$name" \
    --attributes FifoQueue=true,ContentBasedDeduplication=false,VisibilityTimeout=300 \
    --region "$REGION" \
    --query QueueUrl \
    --output text
}

echo "Creating SQS FIFO queues in $REGION..."

ENRICHMENT_URL=$(create_queue "leadgen-bulk-enrichment")
MAPS_URL=$(create_queue "leadgen-bulk-maps-enrich")
ANALYZE_URL=$(create_queue "leadgen-bulk-analyze")
DM_URL=$(create_queue "leadgen-batch-dm")

echo ""
echo "Add these to infra/k8s/backend/configmap.yaml:"
echo ""
echo "  SQS_BULK_ENRICHMENT_URL:  $ENRICHMENT_URL"
echo "  SQS_BULK_MAPS_ENRICH_URL: $MAPS_URL"
echo "  SQS_BULK_ANALYZE_URL:     $ANALYZE_URL"
echo "  SQS_BATCH_DM_URL:         $DM_URL"
