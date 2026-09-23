import { type Track, trackArt } from "../../music-track";

/** The cover of the playing song, drifting slowly beside the top menu. */
export function MenuPreview({ track }: { track: Track }) {
  return (
    <div className="relative h-full overflow-hidden border-l border-[#9d9d9d] bg-black">
      <img
        alt=""
        className="absolute inset-0 size-full animate-pod-pan object-cover motion-reduce:animate-none"
        draggable={false}
        key={track.videoId}
        src={trackArt(track)}
      />
    </div>
  );
}
