export default function Metric({
  name,
  value,
  icon,
}: {
  name: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="metric panel">
      <span className="metric-icon">{icon}</span>
      <small>{name}</small>
      <strong>{value}</strong>
    </div>
  );
}
