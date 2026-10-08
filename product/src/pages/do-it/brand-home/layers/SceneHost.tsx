// 3D 그림층 호스트(자리마다 하나): 문지기(gate) 통과 → 첫 그림 뒤 한가할 때 장면 코드를 늦게 불러와 띄운다.
// 상태는 data-state 로 남긴다(QA 가 읽는다): off(이유 data-why) · loading · on · failed.
// 켜진 동안 해당 섹션(.bh-sec)에 data-scene-layer="on" 을 붙여 CSS 가 지구·별을 희미하게 하고 글을 앞으로 둔다. 꺼지면 속성을 떼어 원래 모습.
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { SCENE_LAYERS, SCENE_OPTIONS, resolveSceneId, type SceneProps, type SceneSlot } from './registry';
import { REDUCED_QUERY, heroLayerGate, whenIdleAfterLoad } from './gate';

type State = 'off' | 'loading' | 'on' | 'failed';

export default function SceneHost({ slot }: { slot: SceneSlot }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<State>('off');
  const [why, setWhy] = useState<string>('');
  const [id, setId] = useState<string>('none');
  const [Scene, setScene] = useState<ComponentType<SceneProps> | null>(null);

  useEffect(() => {
    const sceneId = resolveSceneId(slot);
    setId(sceneId);
    const gate = heroLayerGate(sceneId);
    if (!gate.ok) { setWhy(gate.reason ?? 'off'); return; }
    const loader = sceneId !== 'none' ? SCENE_LAYERS[slot].loaders[sceneId] : undefined;
    if (!loader) { setWhy('off'); return; }
    let cancelled = false;
    const cancelIdle = whenIdleAfterLoad(() => {
      if (cancelled) return;
      setState('loading');
      loader()
        .then((m) => { if (!cancelled) { setScene(() => m.default); setState('on'); } })
        .catch(() => { if (!cancelled) { setState('failed'); setWhy('load'); } });
    });
    // 보는 도중 「움직임 줄이기」를 켜면 바로 내린다(CSS 는 brand-home.css 가 끈다 · WebGL 은 여기서).
    let mq: MediaQueryList | null = null;
    const onChange = () => { if (mq?.matches) { cancelled = true; setScene(null); setState('off'); setWhy('reduced-motion'); } };
    try { mq = window.matchMedia(REDUCED_QUERY); mq.addEventListener?.('change', onChange); } catch { mq = null; }
    return () => { cancelled = true; cancelIdle(); mq?.removeEventListener?.('change', onChange); };
  }, [slot]);

  useEffect(() => {
    const sec = hostRef.current?.closest<HTMLElement>('.bh-sec');
    if (!sec) return;
    sec.setAttribute('data-scene-layer', state);
    return () => sec.removeAttribute('data-scene-layer');
  }, [state]);

  const onFail = useCallback((reason: string) => { setScene(null); setState('failed'); setWhy(reason); }, []);

  return (
    <div ref={hostRef} className="bh-scene-layer" aria-hidden="true" data-slot={slot} data-layer={id} data-state={state} data-why={why || undefined}>
      {Scene ? <Scene host={hostRef} slot={slot} spin={SCENE_OPTIONS.spin} onFail={onFail} /> : null}
    </div>
  );
}
