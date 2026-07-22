import * as React from 'react';
import { motion, AnimatePresence, LayoutGroup, type Transition } from 'motion/react';

/* Сегментированная навигация: активная вкладка — «пилюля» с иконкой и
   подписью, неактивные — только иконки. Пилюля скользит между вкладками
   (layoutId), подпись раскрывается по ширине. Тултипов нет. */

export interface DockItem {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export interface DockProps {
  items: DockItem[];
}

const SPRING: Transition = { type: 'spring', stiffness: 480, damping: 40, mass: 0.9 };

export function Dock({ items }: DockProps) {
  return (
    <LayoutGroup>
      <nav className="dock">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            className={'dock-btn' + (item.active ? ' active' : '')}
          >
            {item.active && (
              <motion.span
                layoutId="dock-active-pill"
                className="dock-pill"
                transition={SPRING}
              />
            )}
            <span className="dock-icon">{item.icon}</span>
            <AnimatePresence initial={false}>
              {item.active && (
                <motion.span
                  className="dock-label"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={SPRING}
                >
                  <span className="dock-label-inner">{item.label}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </nav>
    </LayoutGroup>
  );
}
