import Icon from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
}
interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  block?: boolean;
  minWidth?: number;
  "aria-label"?: string;
}

/** Native selection provides keyboard, touch and screen-reader behavior. */
export default function Select({
  value,
  options,
  onChange,
  block,
  minWidth,
  "aria-label": label,
}: Props) {
  return (
    <div
      className={"select native-select" + (block ? " block" : "")}
      style={minWidth ? { minWidth } : undefined}
    >
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} className="native-select-chevron" />
    </div>
  );
}
