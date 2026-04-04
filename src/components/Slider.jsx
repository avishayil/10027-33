import { cn } from '../utils/cn';

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  className,
  ...props
}) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn('relative w-full', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-input w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to left, #3b82f6 0%, #3b82f6 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`,
        }}
        {...props}
      />
    </div>
  );
}
