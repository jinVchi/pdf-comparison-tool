import { useEffect, useState } from "react";

export default function PageImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [src]);
  return error ? (
    <p className="image-error">
      ページを読み込めませんでした。履歴から比較を開き直してください。
    </p>
  ) : (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      draggable={false}
    />
  );
}
