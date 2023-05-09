#!/bin/bash

rsync -a --exclude "media" --exclude "node_modules" . root@node.pymnts.com:/home/whisper/
