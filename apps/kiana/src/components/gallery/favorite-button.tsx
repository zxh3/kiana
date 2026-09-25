import { cx } from "../../lib/class-names";
import type { AccountStatus } from "./account";
import { ControlButton, focusRing } from "./control-button";
import { HeartIcon } from "./icons";
import { Popover } from "./popover";

/**
 * The dock's heart. Signed in, it saves the photo to the account's
 * favorites or takes it out; for a guest it opens a word on signing in,
 * since favorites are kept by the account.
 */
export function FavoriteButton({
  account,
  favorite,
  onOpenChange,
  onSignIn,
  onToggle,
  open,
}: {
  account: AccountStatus;
  favorite: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: () => void;
  onToggle: () => void;
  open: boolean;
}) {
  const heart = (
    <span
      className={cx("grid", favorite && "animate-heart-pop")}
      key={favorite ? "on" : "off"}
    >
      <HeartIcon filled={favorite} />
    </span>
  );
  if (account === "member") {
    return (
      <ControlButton
        aria-pressed={favorite}
        className={favorite ? "text-rose hover:text-rose" : undefined}
        label={favorite ? "Remove from favorites" : "Add to favorites"}
        onClick={onToggle}
        shortcut="L"
      >
        {heart}
      </ControlButton>
    );
  }
  return (
    <Popover
      className="w-[min(280px,calc(100vw-24px))]"
      kind="dialog"
      label="Favorites"
      onOpenChange={onOpenChange}
      open={open}
      placement="top-start"
      trigger={(props) => (
        <ControlButton
          {...props}
          className={open ? "bg-paper/12 text-paper" : undefined}
          label="Sign in to save favorites"
          shortcut="L"
        >
          {heart}
        </ControlButton>
      )}
    >
      <p className="label px-3 pt-3 text-paper/40">Favorites</p>
      <p className="px-3 pt-2 pb-3 text-[13px] leading-relaxed text-paper/75">
        Sign in to save favorites across devices.
      </p>
      <SignInButton account={account} onSignIn={onSignIn} />
    </Popover>
  );
}

/** Goes to Google to sign in, once the session is known to be missing. */
export function SignInButton({
  account,
  className,
  onSignIn,
}: {
  account: AccountStatus;
  className?: string;
  onSignIn: () => void;
}) {
  return (
    <button
      className={cx(
        "flex w-full cursor-pointer items-center justify-center rounded-full bg-paper px-4 py-2.5 text-[12px] font-medium text-ink transition-[background-color,scale] duration-200 ease-soft hover:bg-white active:scale-97 disabled:pointer-events-none disabled:opacity-40",
        focusRing,
        className,
      )}
      disabled={account !== "guest"}
      onClick={onSignIn}
      type="button"
    >
      {account === "checking"
        ? "Checking…"
        : account === "unavailable"
          ? "Sign-in unavailable"
          : "Sign in with Google"}
    </button>
  );
}
