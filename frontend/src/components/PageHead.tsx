export default function PageHead({
  tag,
  title,
  subtitle,
}: {
  tag: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-head">
      <span className="eyebrow">{tag}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}
