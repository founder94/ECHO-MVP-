export type TarotSheet =
  | "majorA"
  | "majorB"
  | "wands"
  | "cups"
  | "swords"
  | "pentacles";
export type TarotCard = {
  id: string;
  nameKo: string;
  nameEn: string;
  sheet: TarotSheet;
  row: number;
  col: number;
  cols: number;
  rows: number;
};
const majorKo = [
  "바보",
  "마법사",
  "여사제",
  "여황제",
  "황제",
  "교황",
  "연인",
  "전차",
  "힘",
  "은둔자",
  "운명의 수레바퀴",
  "정의",
  "매달린 사람",
  "죽음",
  "절제",
  "악마",
  "탑",
  "별",
  "달",
  "태양",
  "심판",
  "세계",
];
const majorEn = [
  "THE FOOL",
  "THE MAGICIAN",
  "THE HIGH PRIESTESS",
  "THE EMPRESS",
  "THE EMPEROR",
  "THE HIEROPHANT",
  "THE LOVERS",
  "THE CHARIOT",
  "STRENGTH",
  "THE HERMIT",
  "WHEEL OF FORTUNE",
  "JUSTICE",
  "THE HANGED MAN",
  "DEATH",
  "TEMPERANCE",
  "THE DEVIL",
  "THE TOWER",
  "THE STAR",
  "THE MOON",
  "THE SUN",
  "JUDGEMENT",
  "THE WORLD",
];
const ranksKo = [
  "에이스",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "페이지",
  "나이트",
  "퀸",
  "킹",
];
const ranksEn = [
  "ACE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "PAGE",
  "KNIGHT",
  "QUEEN",
  "KING",
];
const suits = [
  {
    sheet: "wands" as const,
    ko: "완드",
    en: "WANDS",
  },
  {
    sheet: "cups" as const,
    ko: "컵",
    en: "CUPS",
  },
  {
    sheet: "swords" as const,
    ko: "소드",
    en: "SWORDS",
  },
  {
    sheet: "pentacles" as const,
    ko: "펜타클",
    en: "PENTACLES",
  },
];
export const TAROT_DECK: TarotCard[] = [
  ...majorKo.map((nameKo, index) => ({
    id: `major-${index}`,
    nameKo,
    nameEn: majorEn[index],
    sheet:
      index <= 10
        ? ("majorA" as const)
        : ("majorB" as const),
    row:
      index <= 10
        ? Math.floor(index / 4)
        : Math.floor((index - 11) / 4),
    col:
      index <= 10
        ? index % 4
        : (index - 11) % 4,
    cols: 4,
    rows: 3,
  })),
  ...suits.flatMap((suit) =>
    ranksKo.map((rank, index) => ({
      id: `${suit.sheet}-${index + 1}`,
      nameKo: `${suit.ko} ${rank}`,
      nameEn: `${ranksEn[index]} OF ${suit.en}`,
      sheet: suit.sheet,
      row: Math.floor(index / 5),
      col: index % 5,
      cols: 5,
      rows: 3,
    })),
  ),
];
if (TAROT_DECK.length !== 78) {
  throw new Error(
    "Tarot deck must contain exactly 78 unique cards.",
  );
}