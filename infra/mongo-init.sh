#!/usr/bin/env bash
# Initialises the single-node replica set required for MongoDB transactions.
set -euo pipefail

mongosh --host mongo:27017 --quiet --eval '
try {
  rs.status();
  print("replica set already initialised");
} catch (error) {
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] });
  print("replica set initiated");
}
'

for attempt in $(seq 1 60); do
  primary="$(mongosh --host mongo:27017 --quiet --eval 'db.hello().isWritablePrimary')"
  if [ "$primary" = "true" ]; then
    echo "replica set primary is ready"
    exit 0
  fi
  sleep 1
done

echo "timed out waiting for the replica set primary" >&2
exit 1
