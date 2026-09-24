// uPlot wrapper (Admin only).
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useEffect, useRef } from 'preact/hooks';

export interface Series { label: string; values: (number | null)[]; color: string; bars?: boolean }

export function Chart({ x, series, height = 220, xLabels, ariaLabel }: { x: number[]; series: Series[]; height?: number; xLabels?: string[]; ariaLabel: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const width = el.current.clientWidth || 600;
    const nBars = series.filter((s) => s.bars).length;
    let barIdx = 0;
    const opts: uPlot.Options = {
      width, height,
      scales: { x: { time: !xLabels } },
      axes: [
        xLabels ? { values: (_u, ticks) => ticks.map((t) => xLabels[Math.round(t)] ?? '') } : {},
        { size: 50 },
      ],
      series: [{}, ...series.map((s) => {
        // grouped bars: each bar series gets its own slot beside the others
        const paths = s.bars ? uPlot.paths.bars?.({ size: [0.7 / nBars, 60], align: nBars > 1 ? ((barIdx++ === 0 ? -1 : 1) as -1 | 1) : 0 }) : undefined;
        return { label: s.label, stroke: s.color, fill: s.bars ? s.color + '99' : undefined, width: 2, paths, points: { show: !s.bars } };
      })],
      legend: { show: true },
    };
    const u = new uPlot(opts, [x, ...series.map((s) => s.values)] as uPlot.AlignedData, el.current);
    const ro = new ResizeObserver(() => u.setSize({ width: el.current!.clientWidth || width, height }));
    ro.observe(el.current);
    return () => { ro.disconnect(); u.destroy(); };
  }, [JSON.stringify([x, series, xLabels])]);
  return <div class="chart" ref={el} role="img" aria-label={ariaLabel} />;
}
