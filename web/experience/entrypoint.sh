#!/bin/sh

# Start the LMS backend in the background
./lms-service &

# Start the Experience frontend
node server.js
