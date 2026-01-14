#!/bin/sh

# Start the LMS backend in the background
./lms-service &

# Start the Experience frontend on port 3003
PORT=3003 node server.js
