export type ToastMessage = { id: number; text: string };

export function Toast({ message }: { message: ToastMessage | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-[max(80px,calc(env(safe-area-inset-top)+68px))] z-30 flex justify-center px-4"
    >
      {message ? (
        <p
          className="glass animate-toast-in rounded-full px-4 py-2.5 text-[11px] tracking-[.08em] text-paper"
          key={message.id}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
