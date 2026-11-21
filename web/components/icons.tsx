import type { ReactNode } from "react";

const paths = {
  shelf: <path d="M3 4h4v16H3zm7 0h4v16h-4zm7 2 3-1 3 14-3 1z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2" /></>,
  recommend: <path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" />,
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4A8.5 8.5 0 1 1 21 11.5Z" />,
  search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></>,
  send: <path d="M12 19V5m-6 6 6-6 6 6" />,
  next: <path d="m9 6 6 6-6 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  admin: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M9 3h6v5H9zm-1 9h8m-8 4h8" /></>,
} satisfies Record<string, ReactNode>;

export function Icon({ name, size = 24 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
