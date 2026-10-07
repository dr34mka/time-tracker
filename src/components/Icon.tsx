import { materialPaths } from '../assets/material-symbols/paths';

export type IconName = keyof typeof materialPaths;
interface Props {
  name: IconName;
  size?: number;
  /** Compatibility with existing callers; Material Symbols use their native filled paths. */
  strokeWidth?: number;
  className?: string;
}

/** Official Google Material Symbols Rounded, bundled as SVG (Apache-2.0). */
export default function Icon({ name, size = 20, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-symbol={name}
    >
      {materialPaths[name].map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
}
