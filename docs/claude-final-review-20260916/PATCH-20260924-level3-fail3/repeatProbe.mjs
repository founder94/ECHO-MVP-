// 운영 v27 의 반복 판정(looksSame: 글자쌍 sim>0.6 또는 overlap>0.7)이 자연스러운 다음 질문 후보를 얼마나 막는지 — 읽기 전용 계산(서버 코드 복사).
const normalizeKey = (s) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
function bigrams(s){const c=normalizeKey(s);const set=new Set();for(let i=0;i<c.length-1;i++)set.add(c.slice(i,i+2));return set;}
function stats(a,b){const A=bigrams(a),B=bigrams(b);let i=0;A.forEach(x=>{if(B.has(x))i++;});return {sim:+(i/(A.size+B.size-i)).toFixed(2),overlap:+(i/Math.min(A.size,B.size)).toFixed(2)};}
const asked=["취미생활에 대해 어떤 것들이 궁금한가요?","편한 친구와 어떤 활동을 함께하고 싶으세요?"];
const cands=["싸이클, 테니스, 골프 중 편한 친구와 함께하고 싶은 건 어떤 거예요?","편한 친구와 어떤 운동을 함께하고 싶으세요?","편한 친구와 싸이클을 함께하고 싶으세요?","취미생활 중에 어떤 것이 가장 궁금한가요?","그중에 어떤 걸 제일 자주 하세요?","싸이클이랑 테니스 중에 뭐가 더 좋아요?","테니스는 누구랑 치는 편이에요?","골프는 얼마나 자주 치세요?","편한 친구와 테니스를 함께하고 싶으세요?","싸이클, 테니스, 골프 중 어떤 취미를 함께하고 싶으세요?","그 취미생활을 편한 친구와 함께하고 싶으세요?","어떤 취미를 함께하고 싶으세요?"];
for(const c of cands){const r=asked.map(a=>stats(c,a));const hit=r.some(s=>s.sim>0.6||s.overlap>0.7);console.log((hit?"막힘 ":"통과 ")+c+"  "+JSON.stringify(r));}
