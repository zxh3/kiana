import { useCallback, useEffect, useState } from "react";

import { authClient } from "../../lib/auth-client";
import { cx } from "../../lib/class-names";
import { isAdmin } from "../../lib/permissions";
import { cue } from "../../lib/sounds";
import { focusRing } from "../gallery/control-button";
import { ShieldIcon } from "../gallery/icons";
import { formatPhotoDate, localDateKey } from "../gallery/model";
import { Initial } from "./admin-page";

/** How many people each page of the list brings. */
const PAGE_SIZE = 100;

const numberFormatter = new Intl.NumberFormat("en-US");

type Person = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  createdAt: Date | string;
  role?: string | null;
};

type People =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; people: Person[]; total: number; more: boolean };

/**
 * Everyone who has signed in, newest first, to make admins of and to take
 * it away from. Better Auth's admin plugin answers, and checks that the
 * one asking may; an admin cannot change their own role.
 */
export function PeoplePanel({
  self,
  onToast,
}: {
  /** The admin's own account, whose role is not theirs to change. */
  self: string;
  onToast: (text: string) => void;
}) {
  const [people, setPeople] = useState<People>({ status: "loading" });
  const [confirming, setConfirming] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (offset: number) => {
    setLoadingMore(offset > 0);
    const { data, error } = await authClient.admin.listUsers({
      query: {
        limit: PAGE_SIZE,
        offset,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    });
    setLoadingMore(false);
    if (error || !data) {
      if (offset === 0) setPeople({ status: "error" });
      return;
    }
    setPeople((current) => {
      const before =
        offset > 0 && current.status === "ready" ? current.people : [];
      // Someone signing in between pages shifts the next page by one.
      const known = new Set(before.map((person) => person.id));
      const all = [
        ...before,
        ...(data.users as Person[]).filter((person) => !known.has(person.id)),
      ];
      return {
        status: "ready",
        people: all,
        total: data.total,
        more: all.length < data.total,
      };
    });
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  const setRole = async (person: Person, admin: boolean) => {
    setConfirming(null);
    setChanging(person.id);
    const { data, error } = await authClient.admin.setRole({
      userId: person.id,
      role: admin ? "admin" : "user",
    });
    setChanging(null);
    if (error || !data) {
      cue("error");
      onToast(error?.message ?? "Couldn’t change the role");
      return;
    }
    cue(admin ? "switchOn" : "switchOff");
    onToast(
      admin
        ? `${person.name} is an admin`
        : `${person.name} is no longer an admin`,
    );
    setPeople((current) =>
      current.status === "ready"
        ? {
            ...current,
            people: current.people.map((each) =>
              each.id === person.id ? { ...each, role: data.user.role } : each,
            ),
          }
        : current,
    );
  };

  return (
    <section
      aria-label="People"
      className="h-full overflow-y-auto overscroll-contain [scrollbar-color:rgb(246_240_230/.18)_transparent] [scrollbar-width:thin]"
    >
      <div className="mx-auto w-full max-w-[880px] px-4 pb-16 sm:px-10">
        <div className="flex h-[116px] flex-col justify-end pb-6 sm:h-[148px]">
          <h1 className="font-serif text-[clamp(34px,4.6vw,56px)] leading-none">
            People
          </h1>
          <p className="label mt-4 leading-relaxed text-paper/45">
            {people.status === "ready"
              ? `${numberFormatter.format(people.total)} signed in with Google · admins may hide photos and make other admins`
              : "Everyone who has signed in"}
          </p>
        </div>

        {people.status === "loading" ? (
          <p className="border-t border-paper/8 py-8 text-[12px] text-paper/45">
            Loading…
          </p>
        ) : people.status === "error" ? (
          <p className="border-t border-paper/8 py-8 text-[12px] text-paper/60">
            Couldn’t load the people who have signed in.{" "}
            <button
              className={cx(
                "cursor-pointer underline underline-offset-4",
                focusRing,
              )}
              onClick={() => {
                setPeople({ status: "loading" });
                void load(0);
              }}
              type="button"
            >
              Try again
            </button>
          </p>
        ) : (
          <>
            <ul className="border-t border-paper/8">
              {people.people.map((person) => {
                const admin = isAdmin(person.role);
                const you = person.id === self;
                return (
                  <li
                    className="flex items-center gap-3.5 border-b border-paper/8 py-3.5 sm:gap-4"
                    key={person.id}
                  >
                    {person.image ? (
                      <img
                        alt=""
                        className="size-9 shrink-0 rounded-full bg-paper/10 object-cover"
                        referrerPolicy="no-referrer"
                        src={person.image}
                      />
                    ) : (
                      <Initial
                        className="size-9 text-[17px]"
                        name={person.name}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[13px] text-paper">
                        {person.name}
                        {you ? (
                          <span className="label text-paper/35">You</span>
                        ) : null}
                      </p>
                      <p className="truncate text-[11px] text-paper/45">
                        {person.email}
                        <span className="max-sm:hidden">
                          {" · joined "}
                          {formatPhotoDate(
                            localDateKey(new Date(person.createdAt)),
                          )}
                        </span>
                      </p>
                    </div>
                    {admin ? (
                      <span className="label flex shrink-0 items-center gap-1.5 rounded-full bg-paper/10 px-2.5 py-1.5 text-paper/80">
                        <ShieldIcon size={12} />
                        Admin
                      </span>
                    ) : null}
                    {you ? null : confirming === person.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <RowButton
                          onClick={() => void setRole(person, !admin)}
                          strong
                        >
                          {admin ? "Remove" : "Make admin"}
                        </RowButton>
                        <RowButton onClick={() => setConfirming(null)}>
                          Cancel
                        </RowButton>
                      </span>
                    ) : (
                      <RowButton
                        disabled={changing === person.id}
                        onClick={() => {
                          cue("select");
                          setConfirming(person.id);
                        }}
                      >
                        {changing === person.id
                          ? "Saving…"
                          : admin
                            ? "Remove admin"
                            : "Make admin…"}
                      </RowButton>
                    )}
                  </li>
                );
              })}
            </ul>
            {people.more ? (
              <button
                className={cx(
                  "label mt-6 cursor-pointer rounded-full border border-paper/14 px-4 py-2.5 text-paper/70 transition-colors hover:border-paper/40 hover:text-paper",
                  focusRing,
                )}
                disabled={loadingMore}
                onClick={() => void load(people.people.length)}
                type="button"
              >
                {loadingMore ? "Loading…" : "Show more"}
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function RowButton({
  children,
  disabled,
  onClick,
  strong,
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
  strong?: boolean;
}) {
  return (
    <button
      className={cx(
        "shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-[11px] tracking-[.04em] transition-colors disabled:pointer-events-none disabled:opacity-40",
        strong
          ? "bg-paper text-ink hover:bg-white"
          : "border border-paper/14 text-paper/70 hover:border-paper/40 hover:text-paper",
        focusRing,
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
