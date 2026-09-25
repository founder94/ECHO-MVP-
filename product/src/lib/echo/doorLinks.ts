// A·B 통합(2026-09-05): DO IT(A)은 이제 같은 앱 안(/doit)에 있다. 외부 주소(VITE_PUBLIC_DOIT_URL)는 더 이상 쓰지 않는다.
// 이 파일은 예전 import 경로 호환용이며, 실제 규칙은 appMode.ts 에 있다.
export { DOIT_BRAND_SENTENCE as DOIT_DOOR_LABEL, DOIT_ENTRY_PATH, showDoitDoor as hasDoitDoor } from '@/lib/echo/appMode';