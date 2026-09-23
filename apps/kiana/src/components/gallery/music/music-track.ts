export type Track = {
  videoId: string;
  title: string;
  artist: string;
};

/**
 * The background playlist, played in this order unless shuffled. Titles and
 * artists are written out by hand because the YouTube titles carry extra
 * text. The artist for 送别 is its long-standing attribution, and the one for
 * 你離開了南京 is the uploading channel; neither performer credit could be
 * confirmed from YouTube.
 */
export const playlist: ReadonlyArray<Track> = [
  { videoId: "A78Hknx4lsA", title: "半句再見", artist: "孫燕姿" },
  { videoId: "CyQHQ1ixFto", title: "送别", artist: "李叔同" },
  { videoId: "f-seFpDIsWs", title: "那时候的我", artist: "刘惜君" },
  {
    videoId: "OlEXCEX2ucc",
    title: "你離開了南京，從此沒有人和我說話",
    artist: "Joseph Hsieh",
  },
  { videoId: "tpEBdPGKVYA", title: "送你一朵小紅花", artist: "趙英俊" },
];

export function trackUrl(track: Track) {
  return `https://www.youtube.com/watch?v=${track.videoId}`;
}

/** The video's 16:9 still, without the letterbox bars of the larger sizes. */
export function trackArt(track: Track) {
  return `https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg`;
}
