type Props = { size?: number; white?: boolean };

export default function Logo({ size = 36, white = false }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={white ? "/logo-white.svg" : "/logo.svg"}
      width={size}
      height={size}
      alt="Fabrictura"
    />
  );
}