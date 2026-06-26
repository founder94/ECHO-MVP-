import type { ExperienceConfig } from '@/pages/home/components/SequenceOverlay';

// ─── ABOUT EXPERIENCE ────────────────────────────────

export const ABOUT_EXPERIENCE: ExperienceConfig = {
  id: 'about',
  namespace: 'about-sequence',
  steps: [
    {
      label: 'ECHO',
      type: 'hero',
      headline: '관계의 운영체제,\nECHO입니다.',
      subheadline: '↓ 스크롤하여 탐색하기',
    },
    {
      label: 'WHY',
      type: 'text',
      headlineLines: [
        '사람은 관계 속에서 태어나고,',
        '관계 속에서 상처받고,',
        '관계 속에서 다시 나를 찾습니다.',
        '',
        'ECHO는 그 여정의 동반자입니다.',
        '',
        '우리는 질문합니다.',
        '왜 우리는 비슷한 관계를 반복할까.',
        '왜 상대가 바뀌어도 같은 결말에 도달할까.',
        '',
        '그리고 답을 찾았습니다.',
        '패턴을 보지 못했기 때문이라고.',
      ],
    },
    {
      label: 'VISION',
      type: 'text',
      headlineLines: [
        'ECHO의 비전은 단순합니다.',
        '',
        '모든 사람이',
        '자신의 관계 패턴을 데이터로 이해하고',
        '더 나은 인간관계를 설계할 수 있는',
        '세상을 만드는 것.',
        '',
        '우리는 이것을',
        '"Human Relationship OS"라고 부릅니다.',
        '',
        '운영체제가 컴퓨터를 움직이듯,',
        'ECHO는 당신의 관계를 이해하는',
        '기반이 됩니다.',
      ],
    },
    {
      label: 'ROADMAP',
      type: 'cards',
      headline: '세 단계로 확장되는 ECHO',
      cards: [
        {
          number: '01',
          title: 'Phase 1 — Protocol',
          description: '개인 관계 데이터 분석과 AI 기반 인사이트 제공. 당신의 관계 패턴을 읽고, 이해하고, 정리합니다. 2025년 현재, Protocol 단계가 세상에 첫 선을 보입니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20minimalist%20composition%20of%20translucent%20glass%20geometric%20shapes%20intersecting%20in%20dark%20space%20soft%20silver%20and%20platinum%20tones%20floating%20light%20particles%20clean%20elegant%20atmosphere%20editorial%20quality%20depth%20and%20layering%20serene%20futuristic%20aesthetic%20no%20text%20no%20people&width=800&height=600&seq=about-phase1-protocol&orientation=landscape',
        },
        {
          number: '02',
          title: 'Phase 2 — Network',
          description: '관계망 시각화와 상호작용 분석. 당신의 관계가 하나의 지도로 펼쳐집니다. 누구와 어떤 감정을 주고받았는지, 그 연결이 어떻게 당신을 형성했는지 보여줍니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20network%20topology%20visualization%20with%20delicate%20luminous%20connection%20lines%20between%20soft%20glowing%20nodes%20dark%20deep%20background%20silver%20and%20warm%20gold%20accents%20minimal%20elegant%20data%20aesthetic%20floating%20particles%20ethereal%20atmosphere%20depth%20of%20field&width=800&height=600&seq=about-phase2-network&orientation=landscape',
        },
        {
          number: '03',
          title: 'Phase 3 — Operating System',
          description: '인간관계의 예측, 추천, 중재까지. ECHO는 당신의 관계를 위한 완전한 운영체제가 됩니다. 당신이 더 이상 혼자 패턴을 헤매지 않도록, ECHO가 함께합니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20artistic%20rendering%20of%20concentric%20glass%20rings%20rotating%20in%20harmony%20dark%20cosmic%20background%20soft%20iridescent%20light%20reflections%20minimal%20geometric%20precision%20floating%20particles%20elegant%20futuristic%20design%20serene%20atmosphere%20depth%20and%20layering&width=800&height=600&seq=about-phase3-os&orientation=landscape',
        },
      ],
    },
    {
      label: 'TEAM',
      type: 'cards',
      headline: 'ECHO를 만드는 사람들',
      cards: [
        {
          number: '01',
          title: 'Creator & Founder',
          description: '10년간 인간관계 데이터를 연구해온 창업자 박진욱. 관계 심리학과 데이터 사이언스의 접점에서 ECHO를 설계했습니다. 수천 건의 인터뷰와 패턴 분석이 ECHO의 기초가 되었습니다.',
        },
        {
          number: '02',
          title: 'AI Research',
          description: '자연어 처리와 감정 분석에 특화된 AI 연구팀. 인간의 미묘한 감정 뉘앙스까지 읽어내는 모델을 개발합니다. 편향 없는 분석, 안전한 출력을 위한 가드레일을 설계합니다.',
        },
        {
          number: '03',
          title: 'Experience Design',
          description: '복잡한 데이터를 직관적인 경험으로 바꾸는 HX 디자인 팀. 아름다움과 기능의 경계에서 작업하며, 데이터가 차갑지 않게, 따뜻하게 전달되도록 설계합니다.',
        },
      ],
    },
    {
      label: 'PROTOCOL READY',
      type: 'cta',
      headline: '지금, 당신의 관계를\n다시 만날 시간입니다.',
      ctaText: '무료 체험 시작',
      ctaAction: 'trial',
      bottomTag: 'ECHO — Human Relationship OS',
    },
  ],
};

// ─── AI EXPERIENCE ───────────────────────────────────

export const AI_EXPERIENCE: ExperienceConfig = {
  id: 'ai',
  namespace: 'ai-sequence',
  steps: [
    {
      label: 'ECHO AI',
      type: 'hero',
      headline: '당신의 관계를 읽는\n인공지능, ECHO AI.',
      subheadline: '↓ AI의 작동 방식을 확인하세요',
    },
    {
      label: 'AI MIRROR',
      type: 'text',
      headlineLines: [
        'ECHO AI는 거울입니다.',
        '',
        '당신의 말, 선택, 감정의 흔적을',
        '왜곡 없이 비추고',
        '그 안에서 패턴을 찾아냅니다.',
        '',
        'AI는 판단하지 않습니다.',
        '당신을 \'문제\'로 보지 않습니다.',
        '',
        '그저, 당신이 보지 못한',
        '당신의 모습을 비춰줄 뿐입니다.',
      ],
    },
    {
      label: 'ANALYSIS',
      type: 'cards',
      headline: 'ECHO AI의 세 가지 분석 축',
      cards: [
        {
          number: '01',
          title: '텍스트 분석',
          description: '당신이 입력한 관계 이야기에서 감정 톤, 언어 패턴, 반복되는 주제를 추출합니다. 자연어 처리 기술로 당신도 몰랐던 미묘한 표현의 뉘앙스까지 포착합니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20visualization%20of%20flowing%20text%20streams%20transforming%20into%20geometric%20patterns%20dark%20background%20with%20soft%20luminous%20threads%20of%20light%20in%20warm%20rose%20gold%20and%20soft%20pink%20tones%20minimal%20elegant%20data%20aesthetic%20subtle%20particles%20depth%20and%20atmosphere&width=800&height=600&seq=ai-text-analysis&orientation=landscape',
        },
        {
          number: '02',
          title: '패턴 인식',
          description: '여러 관계에 걸쳐 반복되는 당신의 선택과 반응을 식별합니다. 무의식적으로 되풀이하는 행동의 근원을 추적하고, 그背后의 감정적 뿌리를 찾아냅니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20concentric%20ripple%20patterns%20expanding%20from%20center%20dark%20background%20soft%20translucent%20layers%20in%20warm%20amber%20and%20lavender%20tones%20geometric%20precision%20floating%20light%20trails%20minimal%20elegant%20scientific%20aesthetic%20depth%20and%20serenity&width=800&height=600&seq=ai-pattern-recognition&orientation=landscape',
        },
        {
          number: '03',
          title: '인사이트 생성',
          description: '분석된 데이터를 당신이 이해할 수 있는 언어로 변환합니다. 추상적인 숫자와 패턴이 구체적인 깨달음으로 전환되는 순간. 데이터가 당신의 이야기가 되는 지점입니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20visualization%20of%20scattered%20data%20points%20converging%20into%20a%20single%20luminous%20core%20dark%20deep%20background%20soft%20gradients%20from%20silver%20to%20warm%20gold%20floating%20particles%20minimal%20elegant%20transformative%20moment%20atmospheric%20depth&width=800&height=600&seq=ai-insight-generation&orientation=landscape',
        },
      ],
    },
    {
      label: 'SAFETY',
      type: 'text',
      headlineLines: [
        'ECHO AI는 세 가지 안전 원칙 위에 설계되었습니다.',
        '',
        '1. 당신의 데이터는 당신의 것입니다.',
        '   분석 결과는 오직 당신만 열람할 수 있습니다.',
        '',
        '2. AI는 판단하지 않습니다. 오직 비춥니다.',
        '   \'좋다/나쁘다\'가 아닌, \'이렇다\'를 전달합니다.',
        '',
        '3. 모든 분석은 익명화된 상태로 처리됩니다.',
        '   개인 식별 정보는 분석 파이프라인에서 분리됩니다.',
      ],
    },
    {
      label: 'LIMITS',
      type: 'text',
      headlineLines: [
        '그리고 우리는 AI의 한계를 정확히 알고 있습니다.',
        '',
        'ECHO AI는 의료 진단도, 심리 상담도,',
        '법률 자문도 아닙니다.',
        '',
        'ECHO AI는 당신의 관계를 이해하는 도구일 뿐,',
        '당신을 대신해 결정하지 않습니다.',
        '',
        '모든 선택의 주체는 언제나 당신입니다.',
      ],
    },
    {
      label: 'AI READY',
      type: 'cta',
      headline: 'AI와 함께,\n당신의 관계 패턴을 발견하세요.',
      ctaText: '무료 분석 시작',
      ctaAction: 'trial',
      bottomTag: 'ECHO AI — Mirror of Your Relations',
    },
  ],
};

// ─── FOUNDER EXPERIENCE ──────────────────────────────

export const FOUNDER_EXPERIENCE: ExperienceConfig = {
  id: 'founder',
  namespace: 'founder-sequence',
  steps: [
    {
      label: 'CREATOR',
      type: 'hero',
      headline: 'ECHO의 시작에는\n한 사람의 질문이 있습니다.',
      subheadline: '↓ 이야기를 따라가 보세요',
    },
    {
      label: 'WHY',
      type: 'text',
      headlineLines: [
        '"왜 나는 매번 비슷한 관계에서',
        '같은 패턴을 반복할까?"',
        '',
        '이 질문 하나가 10년을 이끌었습니다.',
        '',
        '수천 번의 만남, 수백 건의 인터뷰,',
        '그리고 한 가지 깨달음.',
        '',
        '우리의 관계 패턴은 우연이 아니라',
        '데이터로 읽을 수 있는 구조라는 것.',
      ],
    },
    {
      label: 'TIMELINE',
      type: 'cards',
      headline: 'ECHO의 여정',
      cards: [
        {
          number: '2019',
          title: '연구의 시작',
          description: '인간관계 패턴에 대한 본격적인 데이터 수집과 분석이 시작되었습니다. 소개팅, 소개팅 앱, 지인 소개, 커뮤니티, SNS 등 사람이 사람을 만나는 모든 방식을 추적하고 기록했습니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20minimalist%20scene%20of%20scattered%20handwritten%20notes%20and%20diagrams%20floating%20in%20dark%20space%20soft%20warm%20light%20illuminating%20from%20center%20platinum%20and%20silver%20tones%20contemplative%20atmosphere%20depth%20and%20texture%20scholarly%20yet%20artistic&width=800&height=600&seq=founder-2019-research&orientation=landscape',
        },
        {
          number: '2021',
          title: '첫 프로토타입',
          description: '관계 데이터를 구조화하는 첫 번째 알고리즘이 탄생했습니다. 30명의 얼리 테스터와 함께 비공개 실험을 진행했고, \'관계 패턴은 실제로 수치화할 수 있다\'는 확신을 얻었습니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20geometric%20shapes%20emerging%20from%20darkness%20translucent%20glass%20cubes%20and%20spheres%20intersecting%20soft%20silver%20and%20warm%20amber%20light%20rays%20minimal%20elegant%20composition%20sense%20of%20discovery%20and%20emergence%20depth%20and%20atmosphere&width=800&height=600&seq=founder-2021-prototype&orientation=landscape',
        },
        {
          number: '2023',
          title: 'AI 통합',
          description: '자연어 처리와 감정 분석 AI가 프로토콜에 통합되었습니다. 데이터가 단순한 숫자를 넘어 의미 있는 이야기가 되기 시작했고, \'Human Relationship OS\'라는 비전이 구체화되었습니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20visualization%20of%20organic%20data%20forms%20merging%20with%20geometric%20crystalline%20structures%20dark%20background%20soft%20luminous%20threads%20in%20rose%20gold%20and%20lavender%20tones%20minimal%20elegant%20transformative%20moment%20atmospheric%20depth&width=800&height=600&seq=founder-2023-ai&orientation=landscape',
        },
        {
          number: '2025',
          title: 'ECHO 런칭',
          description: '2년간의 비공개 베타 테스트를 거쳐 ECHO가 세상에 첫 선을 보입니다. 100명 이상의 베타 테스터로부터 검증받은 Protocol이 당신을 기다리고 있습니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20minimalist%20portal%20or%20doorway%20opening%20into%20warm%20luminous%20space%20dark%20surroundings%20soft%20golden%20and%20silver%20light%20spilling%20through%20floating%20particles%20elegant%20serene%20atmosphere%20sense%20of%20beginning%20and%20possibility%20depth&width=800&height=600&seq=founder-2025-launch&orientation=landscape',
        },
      ],
    },
    {
      label: 'BELIEF',
      type: 'text',
      headlineLines: [
        '우리는 믿습니다.',
        '',
        '모든 관계에는 패턴이 있고,',
        '모든 패턴에는 이유가 있으며,',
        '모든 사람은 더 나은 관계를 만들 자격이 있다고.',
        '',
        '당신의 반복되는 선택은 \'실수\'가 아닙니다.',
        '그것은 당신이 아직 읽지 못한 데이터일 뿐입니다.',
      ],
    },
    {
      label: 'FUTURE',
      type: 'text',
      headlineLines: [
        'ECHO의 궁극적인 목표는 단 하나입니다.',
        '',
        '당신이 당신 자신과의 관계에서',
        '더 이상 길을 잃지 않는 것.',
        '',
        '관계 속에서 흐려진 자신을 다시 만나고',
        '마침내, 진짜 당신으로 살아가는 것.',
        '',
        '그것이 ECHO가 당신에게',
        '드리고 싶은 단 하나의 선물입니다.',
      ],
    },
    {
      label: 'STORY READY',
      type: 'cta',
      headline: '당신의 이야기도\nECHO에서 시작됩니다.',
      ctaText: '무료로 시작하기',
      ctaAction: 'trial',
      bottomTag: 'ECHO — Your Story Matters',
    },
  ],
};

// ─── REPORT EXPERIENCE ───────────────────────────────

export const REPORT_EXPERIENCE: ExperienceConfig = {
  id: 'report',
  namespace: 'report-sequence',
  steps: [
    {
      label: 'REPORT',
      type: 'hero',
      headline: '당신만의 관계 보고서,\nECHO Report.',
      subheadline: '↓ 리포트의 구성을 확인하세요',
    },
    {
      label: 'BEFORE',
      type: 'text',
      headlineLines: [
        '분석 전의 당신은 이렇게 말합니다.',
        '',
        '"또 비슷한 사람에게 끌렸어요."',
        '"왜 자꾸 똑같은 상황이 반복될까요?"',
        '"이 관계, 내 잘못일까요?"',
        '',
        '익숙한 질문들입니다.',
        '하지만 그 답은 혼자 고민한다고',
        '찾을 수 있는 것이 아니었습니다.',
      ],
    },
    {
      label: 'PATTERN',
      type: 'cards',
      headline: 'ECHO Report가 보여주는 것',
      cards: [
        {
          number: '01',
          title: '관계 유형 분석',
          description: '당신이 선택하는 관계의 유형과 그背后의 심리적 패턴을 시각화합니다. \'왜 항상 이런 사람에게 끌리는지\'에 대한 구체적인 데이터를 확인할 수 있습니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20radar%20chart%20or%20multi%20axis%20diagram%20visualization%20in%20dark%20space%20soft%20luminous%20lines%20in%20rose%20gold%20and%20soft%20cyan%20tones%20floating%20data%20points%20minimal%20elegant%20scientific%20aesthetic%20depth%20and%20precision%20serene%20atmosphere&width=800&height=600&seq=report-type-analysis&orientation=landscape',
        },
        {
          number: '02',
          title: '감정 흐름 지도',
          description: '관계의 시작부터 현재까지, 당신의 감정이 어떻게 흘러왔는지 시간축 위에서 확인합니다. 기쁨, 불안, 기대, 실망 — 모든 감정의 굴곡이 하나의 지도로 펼쳐집니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20flowing%20timeline%20or%20river%20of%20soft%20gradient%20colors%20from%20warm%20to%20cool%20tones%20dark%20background%20delicate%20luminous%20streams%20in%20pink%20gold%20amber%20and%20soft%20blue%20minimal%20elegant%20emotional%20depth%20atmospheric%20layering&width=800&height=600&seq=report-emotion-map&orientation=landscape',
        },
        {
          number: '03',
          title: '성장 포인트',
          description: '지금 당신에게 가장 필요한 관계 성장의 방향을 구체적인 액션 아이템으로 제시합니다. 추상적인 조언이 아닌, 오늘 당장 실천할 수 있는 작은 행동들입니다.',
          image: 'https://readdy.ai/api/search-image?query=Abstract%20visualization%20of%20ascending%20steps%20or%20luminous%20pathway%20rising%20through%20dark%20space%20soft%20golden%20and%20warm%20silver%20light%20floating%20particles%20minimal%20elegant%20hopeful%20atmosphere%20sense%20of%20progress%20and%20possibility%20depth&width=800&height=600&seq=report-growth-points&orientation=landscape',
        },
      ],
    },
    {
      label: 'AFTER',
      type: 'text',
      headlineLines: [
        '리포트를 받아본 사람들은 이렇게 말합니다.',
        '',
        '"처음으로 내 패턴이 눈에 보였어요."',
        '"이제야 이해가 돼요. 왜 그랬는지."',
        '"다음 관계는 다르게 시작할 수 있을 것 같아요."',
        '',
        'ECHO Report는 단순한 분석 결과가 아닙니다.',
        '당신이 당신을 이해하기 시작하는',
        '바로 그 지점입니다.',
      ],
    },
    {
      label: 'WHITE DOOR',
      type: 'text',
      headlineLines: [
        'ECHO Report의 마지막 장에는',
        '항상 \'White Door\'가 있습니다.',
        '',
        '열어도 될지 망설여지는,',
        '하지만 반드시 열어야 하는 문.',
        '',
        '당신의 가장 깊은 패턴과 마주하는 순간.',
        '그리고 그 패턴을 당신의 것으로',
        '받아들이는 순간입니다.',
        '',
        'White Door 뒤에는 두려움이 아니라,',
        '당신 자신이 기다리고 있습니다.',
      ],
    },
    {
      label: 'REPORT READY',
      type: 'cta',
      headline: '당신만의 리포트를\n지금 생성해보세요.',
      ctaText: '리포트 생성하기',
      ctaAction: 'report',
      bottomTag: 'ECHO Report — Know Yourself, Finally',
    },
  ],
};

// ─── FAQ CATEGORY CONFIG ─────────────────────────────

export interface FAQCategory {
  id: string;
  label: string;
  questions: { q: string; a: string }[];
}

export const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: 'general',
    label: '일반',
    questions: [
      {
        q: 'ECHO는 어떤 서비스인가요?',
        a: 'ECHO는 개인의 관계 데이터를 분석하여 패턴을 발견하고, 더 나은 인간관계를 설계할 수 있도록 돕는 AI 기반 관계 운영체제입니다. 단순한 일기나 상담이 아닌, 데이터에 기반한 구조적 분석을 제공합니다. 호기심에서 시작해도 충분합니다.',
      },
      {
        q: '누구를 위한 서비스인가요?',
        a: '반복되는 관계 패턴에서 벗어나고 싶은 분, 자신의 관계 방식을 더 깊이 이해하고 싶은 분, 더 건강한 인간관계를 만들고 싶은 모든 분을 위한 서비스입니다. 특별한 이유나 힘든 상황이 없어도, 그냥 궁금해서 시작하셔도 좋습니다.',
      },
      {
        q: '꼭 힘든 일이 있어야 사용할 수 있나요?',
        a: '전혀 그렇지 않습니다. ECHO는 호기심에서 시작하는 자기이해 플랫폼입니다. 특정한 문제나 어려움이 없어도, 그냥 \'나는 어떤 사람일까\' 궁금하다면 언제든 환영합니다.',
      },
      {
        q: '비용은 얼마인가요?',
        a: '기본 분석 리포트는 무료로 제공됩니다. 심층 분석과 White Door 리포트를 포함한 프리미엄 플랜은 월 구독 방식으로 제공될 예정입니다. 출시 초기에는 얼리버드 할인이 적용됩니다.',
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    questions: [
      {
        q: 'ECHO AI는 어떻게 관계를 분석하나요?',
        a: 'ECHO AI는 사용자가 입력한 관계 이야기와 감정 데이터를 자연어 처리(NLP) 기술로 분석합니다. 감정 톤, 언어 패턴, 반복되는 주제를 식별하고, 이를 종합하여 관계 패턴을 도출합니다. 모든 분석은 익명화된 상태로 처리됩니다.',
      },
      {
        q: 'AI의 분석 결과를 얼마나 신뢰할 수 있나요?',
        a: 'ECHO AI는 통계적 패턴 인식을 기반으로 작동합니다. 분석 결과는 참고와 자기 이해를 위한 도구일 뿐, 절대적인 진단이 아닙니다. 최종 판단과 선택은 항상 사용자의 몫입니다. AI는 거울일 뿐, 판사가 아닙니다.',
      },
      {
        q: 'AI는 편향되지 않나요?',
        a: 'ECHO는 다양한 문화와 배경의 데이터를 학습하여 편향을 최소화하도록 설계되었습니다. 또한 정기적인 편향 감사를 통해 공정성을 지속적으로 점검합니다. 완벽할 순 없지만, 더 나아지기 위해 계속 노력합니다.',
      },
    ],
  },
  {
    id: 'privacy',
    label: '개인정보',
    questions: [
      {
        q: '제 데이터는 안전한가요?',
        a: '네, ECHO는 모든 사용자 데이터를 암호화하여 저장하며, 분석 과정에서도 개인 식별 정보를 분리하여 처리합니다. 데이터는 오직 사용자의 자기 이해를 위해서만 사용되며, 제3자에게 판매되거나 공유되지 않습니다.',
      },
      {
        q: '데이터를 삭제할 수 있나요?',
        a: '언제든지 계정 설정에서 모든 데이터를 영구적으로 삭제할 수 있습니다. 삭제 요청 시 30일 이내에 모든 데이터가 완전히 제거됩니다.',
      },
      {
        q: '다른 사람이 제 데이터를 보나요?',
        a: '아니요. ECHO는 AI 기반 자동 분석 시스템으로, 다른 사람이 개별 사용자의 데이터를 열람하지 않습니다. 익명화된 통계 데이터만 서비스 개선을 위해 활용됩니다.',
      },
    ],
  },
];