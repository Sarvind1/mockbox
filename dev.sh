#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export NODE="/opt/homebrew/bin/node"
cd "$(dirname "$0")"
lsof -ti:3000 | xargs kill -9 2>/dev/null
rm -rf .next
exec /opt/homebrew/bin/node node_modules/.bin/next dev --port 3000
