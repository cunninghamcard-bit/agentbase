#!/bin/bash
TARGET=500
META="/home/cc/Documents/resume/agentbase/data/arxiv_metadata.jsonl"

while true; do
  if [ -f "$META" ]; then
    COUNT=$(wc -l < "$META" | tr -d ' ')
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Current papers: $COUNT"
    if [ "$COUNT" -ge "$TARGET" ]; then
      echo "TARGET REACHED: $COUNT papers downloaded!"
      exit 0
    fi
  fi
  sleep 120
done
