#!/bin/sh
set -eu

container_name=${1:?Usage: deploy.sh CONTAINER_NAME IMAGE_TAG}
image_tag=${2:?Usage: deploy.sh CONTAINER_NAME IMAGE_TAG}
case "$container_name" in ''|*[!a-zA-Z0-9_.-]*) echo 'Invalid container name' >&2; exit 2 ;; esac
case "$image_tag" in ''|*[!a-zA-Z0-9_.-]*) echo 'Invalid image tag' >&2; exit 2 ;; esac

image_name="$container_name:$image_tag"
docker image inspect "$image_name" >/dev/null
if docker container inspect "$container_name" >/dev/null 2>&1; then
    docker stop "$container_name"
    docker rm "$container_name"
fi

docker run -d --restart=always --name "$container_name" \
    --add-host=host.docker.internal:host-gateway \
    -p "${FRONTEND_PORT:-9901}:80" \
    -e "BACKEND_URL=${BACKEND_URL:-http://host.docker.internal:8080}" \
    "$image_name"
