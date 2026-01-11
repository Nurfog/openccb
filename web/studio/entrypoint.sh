#!/bin/sh

# Start the CMS backend in the background
./cms-service &

# Start the Studio frontend
node server.js
