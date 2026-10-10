// next/image 대체(Vite): 그림 최적화 없이 <img> 로. `fill` 은 부모를 가득 채우는 absolute 그림.
import type { CSSProperties, ImgHTMLAttributes } from 'react';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  sizes?: string;
}

export default function Image({ src, alt, width, height, fill, priority, quality: _quality, sizes, style, ...rest }: Props) {
  const fillStyle: CSSProperties | undefined = fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : undefined;
  return <img src={src} alt={alt} width={fill ? undefined : width} height={fill ? undefined : height} sizes={sizes} decoding="async" fetchPriority={priority ? 'high' : undefined} loading={priority ? 'eager' : 'lazy'} style={{ ...fillStyle, ...style }} {...rest} />;
}

export function getImageProps({ src, width, height, sizes, alt, fetchPriority }: { src: string; width?: number; height?: number; sizes?: string; alt?: string; quality?: number; fetchPriority?: 'high' | 'low' | 'auto' }) {
  return { props: { src, srcSet: src, width, height, sizes, alt, fetchPriority } };
}
