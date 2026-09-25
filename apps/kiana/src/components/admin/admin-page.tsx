import { motion } from "motion/react";
import { type ReactNode, useState } from "react";

import type { loadAdminPhotos } from "../../data/gallery";
import { cx } from "../../lib/class-names";
import { springs } from "../../lib/motion";
import { cue } from "../../lib/sounds";
import { focusRing } from "../gallery/control-button";
import { SignInButton } from "../gallery/favorite-button";
import { CloseIcon, ShieldIcon } from "../gallery/icons";
import { Toast, useToast } from "../gallery/toast";
import { useAccount } from "../gallery/use-account";
import { PeoplePanel } from "./people-panel";
import { PhotosPanel } from "./photos-panel";

/** What the admin page's loader answers an admin with. */
export type AdminPhotos = NonNullable<
  Awaited<ReturnType<typeof loadAdminPhotos>>
>;

const tabs = ["photos", "people"] as const;
type Tab = (typeof tabs)[number];
const tabLabels: Record<Tab, string> = { photos: "Photos", people: "People" };

/**
 * The admin page, at /admin: the photos, to hide some from the gallery and
 * show them again, and the people who have signed in, to make admins. The
 * Worker only answers an admin with the photos; anyone else is asked to
 * sign in, or told this account is not an admin.
 */
export function AdminPage({ data }: { data: AdminPhotos | null }) {
  return data ? <AdminConsole data={data} /> : <AdminGate />;
}

/** Signing out leaves the page, so nothing an admin saw stays on it. */
function signOutAndLeave(signOut: () => Promise<unknown>) {
  void signOut().finally(() => window.location.assign("/"));
}

function AdminConsole({ data }: { data: AdminPhotos }) {
  const [tab, setTab] = useState<Tab>("photos");
  const { signOut } = useAccount();
  const { toast, showToast } = useToast();

  return (
    <div className="relative flex h-dvh flex-col bg-night text-paper">
      <header className="z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-b border-paper/8 bg-night/85 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 backdrop-blur-xl sm:flex-nowrap sm:px-8 sm:py-3.5">
        <div className="flex min-w-0 flex-1 items-baseline gap-3 sm:flex-none">
          <a
            className={cx(
              "rounded-sm font-serif text-[28px] leading-none italic",
              focusRing,
            )}
            href="/"
            title="Back to the gallery"
          >
            Kiana
          </a>
          <span className="label flex items-center gap-1.5 text-paper/40">
            <ShieldIcon className="-mt-0.5" size={13} />
            Admin
          </span>
        </div>

        <nav
          aria-label="Admin sections"
          className="order-last flex w-full gap-1 rounded-full bg-paper/6 p-1 sm:order-none sm:mx-auto sm:w-auto"
        >
          {tabs.map((option) => (
            <button
              aria-current={option === tab ? "page" : undefined}
              className={cx(
                "relative isolate flex-1 cursor-pointer rounded-full px-5 py-2 text-[11px] tracking-[.06em] transition-colors duration-150 sm:flex-none",
                option === tab ? "text-ink" : "text-paper/65 hover:text-paper",
                focusRing,
                "focus-visible:ring-offset-0",
              )}
              key={option}
              onClick={() => {
                cue("select");
                setTab(option);
              }}
              type="button"
            >
              {option === tab ? (
                <motion.span
                  className="absolute inset-0 -z-10 rounded-full bg-paper"
                  layoutId="admin-tab"
                  transition={springs.snappy}
                />
              ) : null}
              {tabLabels[option]}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 text-[11px] text-paper/60 sm:flex">
            <Initial name={data.admin.name} />
            {data.admin.name}
          </span>
          <button
            className={cx(
              "label cursor-pointer rounded-full px-3 py-2.5 text-paper/55 transition-colors hover:bg-paper/8 hover:text-paper",
              focusRing,
            )}
            onClick={() => signOutAndLeave(signOut)}
            type="button"
          >
            Sign out
          </button>
          <a
            aria-label="Back to the gallery"
            className={cx(
              "-mr-2 grid size-10 place-items-center rounded-full text-paper/72 transition-colors hover:bg-paper/10 hover:text-paper sm:mr-0",
              focusRing,
            )}
            href="/"
            title="Back to the gallery"
          >
            <CloseIcon />
          </a>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {/* Photos stay mounted behind People, keeping what was changed,
            the filter, and the place in the grid. */}
        <div
          className={cx("absolute inset-0", tab !== "photos" && "invisible")}
          inert={tab !== "photos"}
        >
          <PhotosPanel data={data} onToast={showToast} toast={toast} />
        </div>
        {tab === "people" ? (
          <div className="absolute inset-0">
            <PeoplePanel self={data.admin.id} onToast={showToast} />
          </div>
        ) : null}
      </div>
      <Toast message={toast} />
    </div>
  );
}

/** A person's first letter in a small circle, in place of a picture. */
export function Initial({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid size-6 shrink-0 place-items-center rounded-full bg-paper/12 font-serif text-[13px] text-paper italic",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Anyone but an admin: a way in, or a word that this account is not one. */
function AdminGate() {
  const account = useAccount();
  const { status, member } = account;
  let body: ReactNode;
  if (status === "member" && member) {
    body = (
      <>
        <p className="font-serif text-[30px] leading-tight italic">
          No admin access.
        </p>
        <p className="mt-3 text-[12px] leading-relaxed text-paper/55">
          You’re signed in as {member.name}. Ask an admin to give this account
          access, then reload.
        </p>
        <button
          className={cx(
            "mt-7 w-full cursor-pointer rounded-full border border-paper/16 px-4 py-2.5 text-[12px] text-paper/80 transition-colors hover:border-paper/40 hover:text-paper",
            focusRing,
          )}
          onClick={() => signOutAndLeave(account.signOut)}
          type="button"
        >
          Sign out
        </button>
      </>
    );
  } else {
    body = (
      <>
        <p className="font-serif text-[30px] leading-tight italic">
          Admins only.
        </p>
        <p className="mt-3 text-[12px] leading-relaxed text-paper/55">
          Sign in with an admin account to continue.
        </p>
        <SignInButton
          account={status === "member" ? "checking" : status}
          className="mt-7"
          onSignIn={() => {
            cue("select");
            void account.signIn();
          }}
        />
      </>
    );
  }

  return (
    <main className="grid h-dvh place-items-center bg-night px-6 text-paper">
      <div className="w-full max-w-[340px]">
        <p className="label mb-6 flex items-center gap-1.5 text-paper/40">
          <ShieldIcon className="-mt-0.5" size={13} />
          Kiana admin
        </p>
        {body}
        <a
          className={cx(
            "label mt-8 inline-block rounded-sm text-paper/40 transition-colors hover:text-paper",
            focusRing,
          )}
          href="/"
        >
          ← Back to the gallery
        </a>
      </div>
    </main>
  );
}
