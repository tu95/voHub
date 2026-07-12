import type { SVGProps } from "react";

const paths: Record<string, string> = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z",
  devices:
    "M7 2h10a2 2 0 0 1 2 2v16H5V4a2 2 0 0 1 2-2Zm2 3v5h6V5H9Zm0 8v2h2v-2H9Zm4 0v2h2v-2h-2Z",
  proxy: "M7 7h10V4l5 4-5 4V9H7V7Zm10 10H7v3l-5-4 5-4v3h10v2Z",
  sms: "M3 4h18v14H6l-3 3V4Zm4 5v2h10V9H7Zm0 4v2h7v-2H7Z",
  logs: "M5 3h14v18H5V3Zm3 4v2h8V7H8Zm0 4v2h8v-2H8Zm0 4v2h6v-2H8Z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 5.4-2 .8-.3.8.8 2-2.1 2.1-2-.8-.8.3-.8 2h-3l-.8-2-.8-.3-2 .8-2.1-2.1.8-2-.3-.8-2-.8v-3l2-.8.3-.8-.8-2 2.1-2.1 2 .8.8-.3.8-2h3l.8 2 .8.3 2-.8 2.1 2.1-.8 2 .3.8 2 .8v3Z",
};

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
