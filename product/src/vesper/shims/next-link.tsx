// next/link 대체: 같은 페이지 앵커(/#id)와 바깥 주소는 보통 <a> 로 충분하다.
import { forwardRef, type AnchorHTMLAttributes } from 'react';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; scroll?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch: _p, scroll: _s, children, ...rest }, ref) {
  return <a ref={ref} href={href} {...rest}>{children}</a>;
});
export default Link;
