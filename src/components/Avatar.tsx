type Props = { url?: string | null; name: string; size?: number };

export default function Avatar({ url, name, size = 40 }: Props) {
  const style = { width: size, height: size, fontSize: size * 0.42 };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        style={style}
        className="rounded-full object-cover shrink-0 bg-brand-soft"
      />
    );
  }

  return (
    <div
      style={style}
      className="rounded-full shrink-0 grid place-items-center font-semibold text-white bg-linear-to-br from-brand to-brand-strong"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}