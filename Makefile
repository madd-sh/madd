.PHONY: check test validate pack-check

test:
	npm test

validate:
	node bin/madd.js validate . --require-bound --json

pack-check:
	npm pack --dry-run --ignore-scripts

check: test validate pack-check
