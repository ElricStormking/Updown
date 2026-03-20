#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
INFRA_FILE="$ROOT_DIR/docker-compose.infra.yml"
SERVICES_FILE="$ROOT_DIR/docker-compose.services.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$INFRA_FILE" -f "$SERVICES_FILE" "$@"
}

service_container_id() {
  compose ps -q "$1"
}

wait_for_healthy() {
  local service="$1"
  local timeout="${2:-180}"
  local start_ts
  start_ts="$(date +%s)"

  while true; do
    local container_id
    container_id="$(service_container_id "$service")"
    if [[ -n "$container_id" ]]; then
      local status
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
      if [[ "$status" == "healthy" || "$status" == "running" ]]; then
        echo "$service is $status"
        return 0
      fi
      if [[ "$status" == "exited" || "$status" == "dead" ]]; then
        echo "$service entered unexpected status: $status" >&2
        docker inspect "$container_id" >&2 || true
        return 1
      fi
    fi

    if (( "$(date +%s)" - start_ts >= timeout )); then
      echo "Timed out waiting for $service to become healthy" >&2
      compose ps >&2 || true
      return 1
    fi

    sleep 3
  done
}

wait_for_exit_zero() {
  local service="$1"
  local timeout="${2:-180}"
  local start_ts
  start_ts="$(date +%s)"

  while true; do
    local container_id
    container_id="$(service_container_id "$service")"
    if [[ -n "$container_id" ]]; then
      local status
      status="$(docker inspect --format '{{.State.Status}}' "$container_id")"
      if [[ "$status" == "exited" ]]; then
        local exit_code
        exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$container_id")"
        if [[ "$exit_code" == "0" ]]; then
          echo "$service completed successfully"
          return 0
        fi
        echo "$service failed with exit code $exit_code" >&2
        compose logs "$service" >&2 || true
        return 1
      fi
    fi

    if (( "$(date +%s)" - start_ts >= timeout )); then
      echo "Timed out waiting for $service to exit successfully" >&2
      compose logs "$service" >&2 || true
      return 1
    fi

    sleep 3
  done
}

echo "Pulling latest images"
compose pull

echo "Starting infrastructure services"
compose up -d postgres redis
wait_for_healthy postgres 180
wait_for_healthy redis 180

echo "Running database migrations"
compose rm -sf migrate >/dev/null 2>&1 || true
compose up -d migrate
wait_for_exit_zero migrate 180

echo "Starting application services"
compose up -d hi-lo-server hi-lo-client hi-lo-admin hi-lo-merchant
wait_for_healthy hi-lo-server 240
wait_for_healthy hi-lo-client 180
wait_for_healthy hi-lo-admin 240
wait_for_healthy hi-lo-merchant 240

echo "Publishing gateway"
compose up -d nginx

echo "Deployment status"
compose ps

