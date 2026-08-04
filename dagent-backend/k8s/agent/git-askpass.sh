#!/bin/sh
case "$1" in
  *sername*) printf '%s\n' "${DAGENT_GIT_USERNAME:-oauth2}" ;;
  *) printf '%s\n' "$DAGENT_GIT_PASSWORD" ;;
esac
