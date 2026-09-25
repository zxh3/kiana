import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cleanText, TEXT_MAX } from "../../../../../lib/chat";
import { cx } from "../../../../../lib/class-names";
import { HapticTap } from "../../../haptic-tap";
import { typingChangesAt, typingLine, typingNow } from "../chat";
import type { Chat } from "../use-chat";
import { VerifiedGlyph } from "./glyphs";
import { PodField } from "./pod-field";

/** How far one click of the wheel scrolls the messages: a line. */
const LINE = 13;
/** Within this of the end counts as reading the newest message. */
const NEAR_END = 12;

/**
 * The Chat Room under Apps: everyone with it open talks in one room.
 * The strip at the top says how many are online and opens the list of
 * them (as does the centre button), the messages fill the middle with the
 * newest at the bottom, followed by who is typing, and the field below
 * sends one with Enter. The wheel scrolls the messages; new ones scroll
 * into view unless the viewer has scrolled up to read.
 */
export function ChatRoom({
  chat,
  onSay,
  onShowOnline,
  steps,
}: {
  chat: Chat;
  onSay: (text: string) => void;
  onShowOnline: () => void;
  /** Wheel clicks so far, signed, counted up by the player. */
  steps: number;
}) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);
  const seenSteps = useRef(steps);
  const open = chat.status === "open";

  // Who is typing changes with the clock as well as the room: each typist
  // drops out a while after their last word, so the clock moves on then.
  const [clock, setClock] = useState(() => Date.now());
  const typists = typingNow(chat, clock);
  const typing = typingLine(typists);
  const nextChange = typingChangesAt(chat, clock);
  useEffect(() => {
    if (nextChange === null) return;
    const timer = window.setTimeout(
      () => setClock(Date.now()),
      Math.max(0, nextChange - Date.now()) + 20,
    );
    return () => window.clearTimeout(timer);
  }, [nextChange]);

  // Leaving the screen drops the draft, so the room hears it was cleared.
  const { typing: onTyping } = chat;
  useEffect(() => () => onTyping(false), [onTyping]);

  // New messages scroll into view, unless the viewer is reading back.
  const count = chat.messages.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs for each new message, notice, or typist
  useLayoutEffect(() => {
    const element = list.current;
    if (element && atEnd.current) element.scrollTop = element.scrollHeight;
  }, [count, chat.notice, typing]);

  useEffect(() => {
    const moved = steps - seenSteps.current;
    seenSteps.current = steps;
    if (moved) list.current?.scrollBy({ top: moved * LINE });
  }, [steps]);

  const handleEnter = (value: string) => {
    const text = cleanText(value);
    if (!text || !open) return;
    onSay(text);
    setDraft("");
    atEnd.current = true;
  };

  return (
    <div className="flex h-full flex-col text-[11px] leading-[13px]">
      <button
        aria-label={open ? "Show who is online" : "Connecting"}
        className="relative flex h-[15px] shrink-0 cursor-pointer items-center gap-1 border-b border-[#c9c9c9] bg-[linear-gradient(180deg,#f7f8fa,#e8ebef)] px-2 text-[10px] font-semibold text-[#3d3d3d] outline-none"
        onClick={onShowOnline}
        // For pointers; from the keyboard the centre button opens the list.
        tabIndex={-1}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cx(
            "size-[6px] rounded-full",
            open ? "bg-[#34c759]" : "bg-[#f5a623]",
          )}
        />
        <span className="flex-1 text-left">
          {open ? `${chat.people.length} online` : "Connecting…"}
        </span>
        <span aria-hidden="true" className="text-[12px] text-[#9a9a9a]">
          ›
        </span>
        <HapticTap />
      </button>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1 [scrollbar-width:thin]"
        onScroll={(event) => {
          const element = event.currentTarget;
          atEnd.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            NEAR_END;
        }}
        ref={list}
      >
        {count === 0 ? (
          <p className="pt-9 text-center text-[#8a8a8a]">
            {open ? "No messages yet. Say hi!" : ""}
          </p>
        ) : (
          chat.messages.map((message) => (
            <p className="break-words text-[#141414]" key={message.id}>
              <span
                className={cx(
                  "font-bold",
                  message.from === chat.you || message.mine
                    ? "text-[#2d7ae3]"
                    : "text-[#141414]",
                )}
              >
                {message.name}
              </span>
              {message.verified ? (
                <>
                  {" "}
                  <VerifiedGlyph />
                </>
              ) : null}{" "}
              {message.text}
            </p>
          ))
        )}
        {chat.notice ? (
          <p className="text-[#8a8a8a] italic">{chat.notice}</p>
        ) : null}
        {typing ? (
          <p className="truncate text-[10px] text-[#8a8a8a] italic">
            {typing}
            <span aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <span
                  className="animate-typing-dot motion-reduce:animate-none"
                  key={dot}
                  style={{ animationDelay: `${dot * 0.2}s` }}
                >
                  .
                </span>
              ))}
            </span>
          </p>
        ) : null}
      </div>
      <div className="border-t border-[#c9c9c9] bg-[#fafafa]">
        <PodField
          aria-label="Message"
          enterKeyHint="send"
          height={19}
          maxLength={TEXT_MAX}
          onChange={(event) => {
            setDraft(event.target.value);
            chat.typing(event.target.value.trim() !== "");
          }}
          onEnter={handleEnter}
          placeholder={`Say something as ${chat.name}…`}
          value={draft}
        />
      </div>
    </div>
  );
}
