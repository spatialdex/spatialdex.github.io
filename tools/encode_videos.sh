#!/usr/bin/env bash
# Re-encode raw rollout videos for the website.
#
# Usage: tools/encode_videos.sh <raw_dir> <overview.mp4>
#   <raw_dir> is the folder holding the unzipped video_rtc/ and video_nonrtc/ trees.
#
# Rollouts: 4x speed, 720p, H.264, no audio, metadata (incl. GPS) stripped.
# "start" skips that many seconds of the source and "len" keeps that many ("-" = to the end);
# both are raw seconds, i.e. 4x the on-page time.
# Overview: 1080p H.264 + AAC, metadata stripped.
set -euo pipefail

RAW=${1:?raw dir}
OVERVIEW=${2:-}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=$ROOT/assets/videos
POS=$ROOT/assets/posters

# task  slot  start  len  source (relative to RAW)
CLIPS=(
  "flower   v1    0    -   video_rtc/flower/IMG_1175.MOV"
  "flower   v2    0    -   video_rtc/flower/IMG_1176.MOV"
  "flower   v3    0    -   video_rtc/flower/IMG_1178.MOV"
  "flower   v4    0    -   video_rtc/flower/IMG_1260.mov"
  "pour     v1    0    -   video_rtc/pour/IMG_1191.mov"
  "pour     v2    0    -   video_rtc/pour/IMG_1192.MOV"
  "pour     v3    0    -   video_rtc/pour/IMG_1192 3.MOV"
  "pour     v4    0    -   video_rtc/pour/IMG_1261.mov"
  "spray    v1    0    -   video_rtc/spray/IMG_1187.mov"
  "spray    v2    0    -   video_rtc/spray/IMG_1263.mov"
  "spray    v3    0    -   video_rtc/spray/IMG_1189 2.MOV"
  "spray    v4    32   28  video_nonrtc/spray/IMG_0023.MOV"
  "unzip    v1    0    -   video_rtc/unzip/IMG_1202 2.MOV"
  "unzip    v2    0    -   video_rtc/unzip/IMG_1202.MOV"
  "unzip    v3    0    -   video_rtc/unzip/IMG_1265.mov"
  "unzip    v4    0    -   video_rtc/unzip/IMG_1266.MOV"
  "sweep    v1    0    -   video_rtc/sweep/IMG_1197.MOV"
  "sweep    v2    0    -   video_rtc/sweep/IMG_1198.MOV"
  "sweep    v3    0    -   video_nonrtc/sweep/IMG_0078.MOV"
  "sweep    v4    0    -   video_nonrtc/sweep/IMG_0080.MOV"
  "suitcase v1    0    -   video_rtc/suitcase/IMG_1203.MOV"
  "suitcase v2    0    -   video_rtc/suitcase/IMG_1206.MOV"
  "suitcase v3    0    -   video_rtc/suitcase/IMG_1273 2.mov"
  "suitcase v4    0    -   video_rtc/suitcase/IMG_1273.MOV"
  # baseline failures for the end-to-end comparison (SpatialDex side reuses flower/v1, pour/v3, sweep/v1)
  "compare/flower pi05  0    -   video_rtc/pi05_failure/IMG_1292.MOV"
  "compare/flower vitra 0    -   video_rtc/vitra_failure/IMG_1290 2.MOV"
  "compare/pour pi05  0    -   video_rtc/pi05_failure/IMG_1293.MOV"
  "compare/pour vitra 0    -   video_rtc/vitra_failure/IMG_1294 2.mov"
  "compare/sweep pi05  0    -   video_rtc/pi05_failure/IMG_1285.mov"
  "compare/sweep vitra 0    -   video_rtc/vitra_failure/IMG_1284.mov"
)

for row in "${CLIPS[@]}"; do
  read -r task slot ss len src <<<"$row"
  dur=(); [[ $len != - ]] && dur=(-t "$len")
  mkdir -p "$OUT/$task" "$POS/$task"
  dst=$OUT/$task/$slot.mp4
  echo "==> $task/$slot  <-  $src (from ${ss}s, len ${len})"
  ffmpeg -nostdin -v error -y -ss "$ss" ${dur[@]+"${dur[@]}"} -i "$RAW/$src" \
    -vf "setpts=PTS/4,fps=30,scale=1280:720:flags=lanczos,format=yuv420p" \
    -an -c:v libx264 -preset slow -crf 22 -profile:v high \
    -map_metadata -1 -map_chapters -1 -fflags +bitexact -movflags +faststart \
    "$dst"
  ffmpeg -nostdin -v error -y -i "$dst" -frames:v 1 -q:v 4 "$POS/$task/$slot.jpg"
done

if [[ -n "$OVERVIEW" ]]; then
  echo "==> overview  <-  $OVERVIEW"
  ffmpeg -nostdin -v error -y -i "$OVERVIEW" \
    -vf "scale=1920:1080:flags=lanczos,format=yuv420p" \
    -c:v libx264 -preset slow -crf 24 -profile:v high \
    -c:a aac -b:a 128k \
    -map_metadata -1 -map_chapters -1 -fflags +bitexact -movflags +faststart \
    "$OUT/overview.mp4"
  ffmpeg -nostdin -v error -y -ss 2 -i "$OUT/overview.mp4" -frames:v 1 -q:v 3 "$POS/overview.jpg"
fi

du -sh "$OUT" "$POS"
