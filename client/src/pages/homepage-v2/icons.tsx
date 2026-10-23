import type { SVGProps } from "react";

/** Line icons used by the homepage v2 sections (same paths as the reference symbols). */
function Icon(props: SVGProps<SVGSVGElement> & { paths: string[] }): JSX.Element {
  const { paths, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return <Icon {...props} strokeWidth={2.4} paths={["M20 6 9 17l-5-5"]} />;
}

export function PhoneIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon
      {...props}
      paths={[
        "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
      ]}
    />
  );
}

export function SoundIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return <Icon {...props} paths={["M11 5 6 9H2v6h4l5 4z", "M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"]} />;
}

export function PinIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon
      {...props}
      paths={["M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z", "M12 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"]}
    />
  );
}
