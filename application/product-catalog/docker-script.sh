#!/usr/bin/env bash

docker build -t $1:latest .

docker tag $1 wapinho2016/$1:latest

docker push wapinho2016/$1:latest
