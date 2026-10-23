// Hand-rolled SVG charts — no chart library, just math. LineChart draws two
// series (spend + revenue) over time; ChannelBars shows spend share by channel.

export function LineChart({ data, height = 180 }) {
  if (!data || data.length < 2) return <p className="muted">Add metrics on two or more days to see the trend.</p>;
  const width = 720;
  const pad = 28;
  const max = Math.max(...data.map((d) => Math.max(d.spend, d.revenue)), 1);
  const x = (i) => pad + (i * (width - pad * 2)) / (data.length - 1);
  const y = (v) => height - pad - (v / max) * (height - pad * 2);
  const line = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[key])}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label="Spend versus revenue over time">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad} x2={width - pad} y1={y(max * f)} y2={y(max * f)} className="grid" />
      ))}
      <path d={line('revenue')} className="line revenue" fill="none" />
      <path d={line('spend')} className="line spend" fill="none" />
      <text x={pad} y={height - 6} className="axis">{data[0].date}</text>
      <text x={width - pad} y={height - 6} textAnchor="end" className="axis">{data[data.length - 1].date}</text>
    </svg>
  );
}

export function ChannelBars({ data }) {
  if (!data || !data.length) return <p className="muted">No channel data yet.</p>;
  const max = Math.max(...data.map((d) => d.spend), 1);
  return (
    <div className="bars">
      {data.map((d) => (
        <div key={d.channel} className="bar-row">
          <span className="bar-label">{d.channel}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(3, (d.spend / max) * 100)}%` }} />
          </div>
          <span className="bar-value">{d.roas}x ROAS</span>
        </div>
      ))}
    </div>
  );
}
