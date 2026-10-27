import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";

export default function PageImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [src]);
  return error ? (
    <div className="image-error">
      <CircleHelp size={24} />
      <p>
        ページを読み込めませんでした。
        <br />
        履歴から比較を開き直してください。
      </p>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      draggable={false}
    />
  );
}
