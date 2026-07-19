import * as React from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  type SpringOptions,
  type MotionValue,
} from 'motion/react';

/* Адаптация Dock (ui.unlumen.com/components/dock):
   Tailwind заменён на классы из styles.css, item.href/separator убраны,
   добавлен флаг active для подсветки текущего экрана */

export interface DockItem {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export interface DockProps {
  items: DockItem[];
  magnification?: number;
  distance?: number;
  iconSize?: number;
  gap?: number;
  borderRadius?: number;
  springOptions?: SpringOptions;
}

const DEFAULT_SPRING: SpringOptions = {
  stiffness: 400,
  damping: 25,
  mass: 0.4,
};

function DockIcon({
  item,
  mouseX,
  magnification,
  distance,
  iconSize,
  borderRadius,
  springOptions,
  onHover,
  iconRef: externalIconRef,
}: {
  item: DockItem;
  mouseX: MotionValue<number>;
  magnification: number;
  distance: number;
  iconSize: number;
  borderRadius: number;
  springOptions: SpringOptions;
  onHover: (ref: React.RefObject<HTMLDivElement> | null) => void;
  iconRef: React.RefObject<HTMLDivElement>;
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const distanceFromMouse = useTransform(mouseX, (val) => {
    const el = wrapperRef.current;
    if (!el) return distance * 100;
    const rect = el.getBoundingClientRect();
    return Math.abs(val - (rect.left + rect.width / 2));
  });

  const gaussian = (d: number) =>
    (magnification - 1) * Math.exp(-(d * d) / (2 * distance * distance)) + 1;

  const widthRaw = useTransform(distanceFromMouse, (d) => iconSize * gaussian(d));
  const heightRaw = useTransform(distanceFromMouse, (d) => iconSize * gaussian(d));

  const width = useSpring(widthRaw, springOptions);
  const height = useSpring(heightRaw, springOptions);

  return (
    // фиксированная высота в потоке; ширина анимируется и раздвигает соседей
    <motion.div
      ref={wrapperRef}
      className="dock-item"
      style={{ width, height: iconSize }}
    >
      {/* абсолютный блок, прижат к низу — иконка растёт вверх */}
      <motion.div ref={externalIconRef} style={{ width, height, bottom: 0 }} className="dock-item-abs">
        <button
          onClick={item.onClick}
          onMouseEnter={() => onHover(externalIconRef)}
          onMouseLeave={() => onHover(null)}
          aria-label={item.label}
          style={{ borderRadius }}
          className={'dock-btn' + (item.active ? ' active' : '')}
        >
          {item.icon}
        </button>
      </motion.div>
    </motion.div>
  );
}

export function Dock({
  items,
  magnification = 1.7,
  distance = 110,
  iconSize = 42,
  gap = 4,
  borderRadius = 14,
  springOptions = DEFAULT_SPRING,
}: DockProps) {
  const mouseX = useMotionValue(Infinity);
  const dockRef = React.useRef<HTMLDivElement>(null);

  const iconRefs = React.useRef<React.RefObject<HTMLDivElement>[]>(
    items.map(() => React.createRef<HTMLDivElement>()),
  );

  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [tooltipX, setTooltipX] = React.useState(0);
  const [tooltipBottomOffset, setTooltipBottomOffset] = React.useState(0);

  React.useEffect(() => {
    if (hoveredIndex === null) return;

    let raf: number;
    const update = () => {
      const iconEl = iconRefs.current[hoveredIndex]?.current;
      const dockEl = dockRef.current;
      if (iconEl && dockEl) {
        const iconRect = iconEl.getBoundingClientRect();
        const dockRect = dockEl.getBoundingClientRect();
        setTooltipX(iconRect.left - dockRect.left + iconRect.width / 2);
        setTooltipBottomOffset(dockRect.bottom - iconRect.top);
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [hoveredIndex]);

  const handleHover = React.useCallback(
    (ref: React.RefObject<HTMLDivElement> | null) => {
      if (ref === null) {
        setHoveredIndex(null);
        return;
      }
      const idx = iconRefs.current.findIndex((r) => r === ref);
      setHoveredIndex(idx >= 0 ? idx : null);
    },
    [],
  );

  return (
    <motion.div
      ref={dockRef}
      className="dock"
      style={{ gap, borderRadius: borderRadius + 8 }}
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
    >
      {items.map((item, i) => (
        <DockIcon
          key={i}
          item={item}
          mouseX={mouseX}
          magnification={magnification}
          distance={distance}
          iconSize={iconSize}
          borderRadius={borderRadius}
          springOptions={springOptions}
          onHover={handleHover}
          iconRef={iconRefs.current[i]}
        />
      ))}

      <AnimatePresence>
        {hoveredIndex !== null && (
          <motion.div
            key="dock-tooltip"
            layoutId="dock-tooltip"
            className="dock-tip-wrap"
            style={{
              left: tooltipX,
              bottom: tooltipBottomOffset + 8,
              x: '-50%',
            }}
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ duration: 0.13, ease: 'easeOut' }}
          >
            <span className="dock-tip">{items[hoveredIndex].label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
