import { useReveal } from '../hooks/useReveal';

/**
 * Scroll-reveal wrapper.
 *
 *   <Reveal><p>…</p></Reveal>
 *   <Reveal variant="left" delay={120}>…</Reveal>
 *   <Reveal stagger>…children animate in sequence…</Reveal>
 *
 * Renders a div by default, or the element passed via `as`.
 */
export default function Reveal({
  as: Tag = 'div',
  variant = 'up',
  stagger = false,
  delay = 0,
  className = '',
  style,
  children,
  ...rest
}) {
  const [ref, visible] = useReveal();

  const classes = ['reveal'];
  if (variant === 'left') classes.push('reveal--left');
  if (variant === 'right') classes.push('reveal--right');
  if (variant === 'scale') classes.push('reveal--scale');
  if (stagger) classes.push('stagger');
  if (visible) classes.push('is-visible');
  if (className) classes.push(className);

  // Merge rather than overwrite: a caller-supplied `style` used to wipe out
  // the delay, silently disabling the stagger it asked for.
  const mergedStyle = delay ? { transitionDelay: `${delay}ms`, ...style } : style;

  return (
    <Tag ref={ref} className={classes.join(' ')} style={mergedStyle} {...rest}>
      {children}
    </Tag>
  );
}
