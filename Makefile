# Makefile

.PHONY: install start

install:
	cd backend && npm install
	cd frontend && npm install

start:
	npm --prefix backend start & npm --prefix frontend start
