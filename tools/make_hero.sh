#!/usr/bin/env bash
# Build the full-screen hero montage: ~2.5 s of each task at 4x speed, 1080p, no audio.
# Uses each task's second variation so it doesn't repeat the teaser grid.
# Usage: tools/make_hero.sh <raw_dir>
set -euo pipefail
RAW=${1:?raw dir}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SEG=10   # seconds of source per task (2.5 s after the 4x speed-up)

# source  start-fraction
PARTS=(
  "video_rtc/flower/IMG_1176.MOV 0.30"
  "video_rtc/pour/IMG_1192.MOV 0.35"
  "video_rtc/spray/IMG_1263.mov 0.35"
  "video_rtc/unzip/IMG_1202.MOV 0.25"
  "video_rtc/sweep/IMG_1198.MOV 0.30"
  "video_rtc/suitcase/IMG_1206.MOV 0.35"
)

inputs=(); filters=""; i=0
for row in "${PARTS[@]}"; do
  src=${row% *}; frac=${row##* }
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RAW/$src")
  ss=$(python3 -c "print(round(min($dur*$frac, max($dur-$SEG, 0)), 2))")
  inputs+=(-ss "$ss" -t "$SEG" -i "$RAW/$src")
  filters+="[$i:v]setpts=PTS/4,fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,setsar=1[v$i];"
  i=$((i+1))
done
concat=""; for k in $(seq 0 $((i-1))); do concat+="[v$k]"; done
filters+="${concat}concat=n=$i:v=1:a=0[out]"

ffmpeg -nostdin -v error -y "${inputs[@]}" -filter_complex "$filters" -map "[out]" \
  -an -c:v libx264 -preset slow -crf 25 -profile:v high \
  -map_metadata -1 -map_chapters -1 -fflags +bitexact -movflags +faststart \
  "$ROOT/assets/videos/hero.mp4"
ffmpeg -nostdin -v error -y -i "$ROOT/assets/videos/hero.mp4" -frames:v 1 -q:v 3 "$ROOT/assets/posters/hero.jpg"
ls -la "$ROOT/assets/videos/hero.mp4"
