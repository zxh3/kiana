import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";

export function PhotoBackdrop({
  asset,
  hidden = false,
}: {
  asset: GalleryAsset;
  hidden?: boolean;
}) {
  return (
    <div className={cx("absolute inset-0", hidden && "hidden")}>
      <div
        className="absolute -inset-[12%] scale-110 bg-cover bg-center blur-[52px] brightness-[.62] saturate-150 will-change-transform"
        style={{ backgroundImage: `url("${asset.small}")` }}
      />
      <div className="absolute inset-0 bg-[rgba(23,18,15,.3)]" />
    </div>
  );
}
