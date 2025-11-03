import React, { useCallback, useEffect, useState } from "react";
import { appendSessionLogs, loadSrsMap, saveSrsMap } from "./db";

const THEME_KEY = "theme_v1" as const;
type Theme = "dark" | "light";

const useThemeState = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY) as Theme | null;
      return saved === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);
  return { theme, setTheme } as const;
};

const pick = (theme: Theme, darkCls: string, lightCls: string) => (theme === "dark" ? darkCls : lightCls);

const STR = {
  A_MARU: "まる",
  A_BATSU: "ばつ",
  A_SKIP: "すきっぷ",

  L_CORRECT: "ただしい",
  L_WRONG: "あやまり",
  L_SKIP: "すきっぷ",

  APP_TITLE: "きそきゅう ひょうそう てすと（20もん）",
  BTN_START_RESET: "スタート / リセット",
  HINT_KEY: "（きー：1=ただしい / 2=あやまり / 0=すきっぷ）",
  INTRO_1: "・『すたーと』で 20もん。5もんは あんぜんな てんぷれ から じどう せいせい。",
  INTRO_2: "・こたえ：1=ただしい / 2=あやまり / 0=すきっぷ（ボタンでもOK）",
  INTRO_3: "・まちがえたら『なぜ？』に ひとこと → せいかいの りゆう を 1ぎょうで。",
  Q_PREFIX: "もんだい ",
  KAI_BTN_NEXT: "つぎへ",
  PLACEHOLDER_REASON: "りゆう を ひとこと（はっけん/きずきでもOK）",
  TXT_CORRECT_POP: "ただしい！ いいね。じしん を えらんで ください。",
  TXT_WRONG_POP: "あやまり。なぜ そう おもった？ りゆう と じしん を いれて ね。",
  RESULT_TITLE: "けっか",
  RESULT_RETRY: "もういちど",
  FOOTER_HELP: "つかいかた：1=ただしい / 2=あやまり / 0=すきっぷ。",
  PROGRESS_HINT: "（1=ただしい / 2=あやまり / 0=すきっぷ）",
  WRONG_LIST: "まちがい りすと",
  SKIP_LIST: "すきっぷ",
  SEIKAI_LABEL: "せいかい：",
  REASON_LABEL: "りゆう：",
  TAG_LABEL: "たぐ：",

  CONF_TITLE: "じしん",
  CONF_HIGH: "◎ じしん あり",
  CONF_MID: "○ ふつう",
  CONF_LOW: "△ じしん なし",

  R_SCORE_HI: "◎ きーわーど かんせつ",
  R_SCORE_MD: "○ いちぶん ひっと",
  R_SCORE_LO: "△ みつからず",

  SEP: " / ",
  BTN_THEME_DARK: "🌙 ダーク",
  BTN_THEME_LIGHT: "☀️ ライト",
} as const;

const makeConfidenceLabel = (raw: string): React.ReactNode => {
  const parts = raw.trim().split(/\s+/);
  const icon = parts.shift() ?? "";
  const text = parts.join(" ");
  return (
    <span className="flex items-center justify-center gap-1">
      <span className="w-4 text-center">{icon}</span>
      <span>{text}</span>
    </span>
  );
};

const SRS_MAX = 5;
type SRSMap = Record<string, number>;
function getBox(map: SRSMap, id: string | number) {
  return Math.min(Math.max(map[id as any] || 1, 1), SRS_MAX);
}
function setBox(map: SRSMap, id: string | number, box: number) {
  map[id as any] = Math.min(Math.max(box, 1), SRS_MAX);
}
function weightForBox(box: number) {
  const w = 6 - box;
  return w * w;
}

const newSessionStamp = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type QAItem = { id: number; text: string; answer: string };
type TemplateItem = {
  id: string;
  baseId: number;
  text: string;
  answer: string;
  generated: true;
  tag: string;
};

const DATA: QAItem[] = [
  { id: 1, text: "ぱてべらは かべがみを せつだんするときに つかう こうぐです。", answer: STR.A_BATSU },
  { id: 2, text: "ひろい せこうめんの ながさを はかるときは、 ながい メジャーを つかうとよいです。", answer: STR.A_MARU },
  { id: 3, text: "パテには、 なかぬりようも あります。", answer: STR.A_MARU },
  { id: 4, text: "おりものは、 かべがみには つかわれません。", answer: STR.A_BATSU },
  { id: 5, text: "たかい ところで さぎょうするときは、 あんぜんたいを しようします。", answer: STR.A_MARU },
  { id: 6, text: "きゃたつ さぎょうは てんばんに のってはなりません。", answer: STR.A_MARU },
  { id: 7, text: "🚫 の さいんは、 きんしの まーくでは ありません。", answer: STR.A_BATSU },
  { id: 8, text: "はばきは てんじょうと かべの つぎめに つかわれます。", answer: STR.A_BATSU },
  { id: 9, text: "ビニルは、 かべがみには つかわれません。", answer: STR.A_BATSU },
  { id: 10, text: "あんぜんつうろには、 ものを おいては いけません。", answer: STR.A_MARU },
  { id: 11, text: "たかい ところで さぎょうするときは、 あんぜんたいを しようします。", answer: STR.A_MARU },
  { id: 12, text: "きゃたつは、 ひくければ とびおりても よいです。", answer: STR.A_BATSU },
  { id: 13, text: "かべがみの のりには、 でんぷんのりや ごうせいじゅし せっちゃくざいが あります。", answer: STR.A_MARU },
  { id: 14, text: "たちじょうぎは ながさを はかるときに つかいます。", answer: STR.A_BATSU },
  { id: 15, text: "いのちづなは、 おやづなに かけなくては いけません。", answer: STR.A_MARU },
  { id: 16, text: "かべがみには むじのものは、 ありません。", answer: STR.A_BATSU },
  { id: 17, text: "クシばけは、 かべがみの のりつけに つかいます。", answer: STR.A_BATSU },
  { id: 18, text: "せっこうボードは、 しつないの かべや てんじょうの はりしたじに つかいます。", answer: STR.A_MARU },
  { id: 19, text: "けんちくげんばでの ふくそうは はんそででも かまいません。", answer: STR.A_BATSU },
  { id: 20, text: "せっこうぼーどは、 しつないの かべや てんじょうの はりしたじには つかわれません。", answer: STR.A_BATSU },
  { id: 21, text: "なでばけは、 かべがみに せっちゃくざいを つけるときに つかわれません。", answer: STR.A_MARU },
  { id: 22, text: "せっちゃくざいは、 くうきちゅうに おいておくと せっちゃくりょくが かわります。", answer: STR.A_MARU },
  { id: 23, text: "⚠︎ の まーくは、 あんぜんつうろの さいんです。", answer: STR.A_BATSU },
  { id: 24, text: "ですみは かべの 2つの めんが であって できる うちがわの かどです。", answer: STR.A_BATSU },
  { id: 25, text: "てんじょうと へきめんに かべがみを はるときは、 したじの ジョイントぶに ぱてしょりを します。", answer: STR.A_MARU },
  { id: 26, text: "ごうはんや もるたるは、 へきそうはり したじに つかいます。", answer: STR.A_MARU },
  { id: 27, text: "さぎょうちゅうは、 たばこを すっては いけません。", answer: STR.A_MARU },
  { id: 28, text: "かべがみの ジョイントには、 つきつけと かさねだちの ほうほうが あります。", answer: STR.A_MARU },
  { id: 29, text: "パテを かけた あとは、 サンダーを かけなくても よいです。", answer: STR.A_BATSU },
  { id: 30, text: "なでばけは、 せっちゃくざいを ぬるときに つかう どうぐです。", answer: STR.A_BATSU },
  { id: 31, text: "おりものくろすは びにーるくろすに くらべて そうじが しやすいです。", answer: STR.A_BATSU },
  { id: 32, text: "シーラーや プライマーは、 せっちゃくざいの みっちゃくどを たかめるために つかいます。", answer: STR.A_MARU },
  { id: 33, text: "かべがみは かべの すんぽうと おなじ おおきさに さいだんしてから はりつける。", answer: STR.A_BATSU },
  { id: 34, text: "いりすみは かべの ふたつの めんが であって できる そとがわの かどです。", answer: STR.A_BATSU },
  { id: 35, text: "ほしつきは かべがみの くうきを ぬくときに つかいます。", answer: STR.A_BATSU },
  { id: 36, text: "はさみや カッターは、 かべがみを さいだんするときに つかいます。", answer: STR.A_MARU },
  { id: 37, text: "じべらは ぱてを かけるときの こうぐです。", answer: STR.A_BATSU },
  { id: 38, text: "でんげんが こしょうしたときには、 こんせんとを そのままにして げんいんを しらべます。", answer: STR.A_BATSU },
  { id: 39, text: "へきめんを しあげる せこうきかんは、 かべがみで しあげるよりも とそう(ペンキ)で しあげるほうが ながいです。", answer: STR.A_MARU },
  { id: 40, text: "かべがみようの のりは、 みずで のばすことが できません。", answer: STR.A_BATSU },
  { id: 41, text: "かべがみを はりおわった あとは、 スポンジや ぞうきんで みきりぶちなどの のりを ふきとります。", answer: STR.A_MARU },
  { id: 42, text: "くしばけは、 かべがみを きるときに つかいます。", answer: STR.A_BATSU },
  { id: 43, text: "ひょうめんの おうとつ（でこぼこ）は、 ななめから みるより しょうめんから みるほうが みつけにくい。", answer: STR.A_MARU },
  { id: 44, text: "かべがみには がらものは、 ありません。", answer: STR.A_BATSU },
  { id: 45, text: "ほごぼうを かぶるときは、 あごひもを しめなければ なりません。", answer: STR.A_MARU },
  { id: 46, text: "へやの なかで しんなーを つかうときは まどを あけます。", answer: STR.A_MARU },
  { id: 47, text: "でんげんが こしょうしたときには、 コンセントから プラグを ぬいて げんいんを しらべます。", answer: STR.A_MARU },
  { id: 48, text: "せっちゃくざいを つけた かべがみは、 おりたたまずに もちはこびます。", answer: STR.A_BATSU },
  { id: 49, text: "かきげんきんの ばしょでも ストーブは つかっても かまいません。", answer: STR.A_BATSU },
  { id: 50, text: "シーラーや プライマーは、 かべがみの せっちゃくりょくを あげるために つかいます。", answer: STR.A_MARU },
  { id: 51, text: "きゃたつは、 ひくくても とびおりては いけません。", answer: STR.A_MARU },
  { id: 52, text: "たちうまは まえを むいて おりなければ なりません。", answer: STR.A_BATSU },
  { id: 53, text: "あかい いろの さいんは きんしや ていしの いみにつかわれます。", answer: STR.A_MARU },
  { id: 54, text: "かべがみには ふねんざいりょうは ありません。", answer: STR.A_BATSU },
  { id: 55, text: "はばきは かべの きずや よごれから まもるために つけます。", answer: STR.A_MARU },
  { id: 56, text: "へきめんを しあげる せこうきかんは、 かべがみで しあげるよりも とそうで しあげるほうが みじかいです。", answer: STR.A_BATSU },
  { id: 57, text: "じべらは かべがみを せつだんするときに つかう こうぐです。", answer: STR.A_MARU },
  { id: 58, text: "パテべらは したじを たいらにするときに つかう こうぐです。", answer: STR.A_MARU },
  { id: 59, text: "かべがみを はりおわった あとは、 スポンジと ぞうきんで まわりぶちなどの のりを よく ふきとります。", answer: STR.A_MARU },
  { id: 60, text: "のりばけや のりづけきは、 かべがみに せっちゃくざいを つけるときに つかいます。", answer: STR.A_MARU },
  { id: 61, text: "🚫 の さいんの ばしょには いっては いけません。", answer: STR.A_MARU },
  { id: 62, text: "けんちくげんばでの ふくそうは ながそでで なければ なりません。", answer: STR.A_MARU },
  { id: 63, text: "スムーサーは、 かべがみの くうきを ぬくときに つかいます。", answer: STR.A_MARU },
  { id: 64, text: "カットテープや したじきテープは、 かべがみを ジョイントするときに つかいます。", answer: STR.A_MARU },
  { id: 65, text: "きゃたつは てんばんに のって さぎょうをしても よいです。", answer: STR.A_BATSU },
  { id: 66, text: "かきげんきんの ばしょでは ストーブは つかえません。", answer: STR.A_MARU },
  { id: 67, text: "かべがみの つきつけには したじきてーぷを つかいます。", answer: STR.A_BATSU },
  { id: 68, text: "うわパテは、 したパテの まえに かけます。", answer: STR.A_BATSU },
  { id: 69, text: "みずいとは、 かべがみを ジョイントするときに つかいます。", answer: STR.A_BATSU },
  { id: 70, text: "かべがみの ジョイントぶには、 ローラーは つかいません。", answer: STR.A_BATSU },
  { id: 71, text: "せっちゃくざいを つけた かべがみは、 おりたたんでは いけません。", answer: STR.A_BATSU },
  { id: 72, text: "へやの なかで シンナーを つかうときは まどを しめます。", answer: STR.A_BATSU },
  { id: 73, text: "ほごぼうを かぶるときは あごひもは しなくても よいです。", answer: STR.A_BATSU },
  { id: 74, text: "⚠︎  は、 ちゅういや きけんの サインです。", answer: STR.A_MARU },
  { id: 75, text: "かべがみようの せっちゃくざいは、 みずで うすめることが できません。", answer: STR.A_BATSU },
  { id: 76, text: "コーキングざいは、 かべがみを はるまえに つかいます。", answer: STR.A_MARU },
  { id: 77, text: "ひょうめんの おうとつ（でこぼこ）は、 しょうめんから みるより ななめから みるほうが みつけやすい。", answer: STR.A_MARU },
  { id: 78, text: "きかいを しようするときは、 でんげんを いれます。", answer: STR.A_MARU },
  { id: 79, text: "ぱてには、 したぬりようと うわぬりようが あります。", answer: STR.A_MARU },
  { id: 80, text: "ひろい せこうめんの ながさを はかるときは、 みじかい メジャーを つかうとよいです。", answer: STR.A_BATSU },
  { id: 81, text: "せっちゃくざいは、 くうきちゅうに ながく おいても せっちゃくりょくは かわりません。", answer: STR.A_BATSU },
  { id: 82, text: "しょうかきや しょうかせんの まえに どうぐを おいては なりません。", answer: STR.A_MARU },
  { id: 83, text: "きゃたつを たてるときには ゆかに ようじょうを します。", answer: STR.A_MARU },
  { id: 84, text: "かみは たてめよりも よこめのほうが ひっぱりきょうどが つよい。", answer: STR.A_BATSU },
  { id: 85, text: "じこが おきたときは あわてずに こうどうする。", answer: STR.A_MARU },
  { id: 86, text: "へやを ひろく みせたいときには くらいいろや こいいろの かべがみを えらぶとよい。", answer: STR.A_BATSU },
  { id: 87, text: "へやを ひろく みせたいときには しろいいろや あかるいいろのかべがみを えらぶとよい。", answer: STR.A_MARU },
  { id: 88, text: "てんじょうを たかく みせたいときには たてがらの かべがみを えらぶとよい。", answer: STR.A_MARU },
  { id: 89, text: "かべがみを ほかんするときには たてつみにする", answer: STR.A_MARU },
  { id: 90, text: "かべがみようの でんぷんのりは カビの げんいんに なります。", answer: STR.A_MARU },
  { id: 91, text: "がらものの かべがみを ジョイントするときには がらあわせを します。", answer: STR.A_MARU },
  { id: 92, text: "こうぐの てんけんは つかうまえに かならず おこなう。", answer: STR.A_MARU },
  { id: 93, text: "ひょうめんの おうとつは ひかりを しょうめんから あてるよりななめから あてるほうが みつけやすい。", answer: STR.A_MARU },
  { id: 94, text: "コーキングざいは、 めじや いりすみの すきま などに じゅうてんします。", answer: STR.A_MARU },
  { id: 95, text: "和紙くろす（かべがみ）は つうきせいが わるい。", answer: STR.A_BATSU },
];

function guessTag(text: string) {
  if (/(あんぜん|きゃたつ|てんばん|いのちづな|あんぜんたい|あんぜんつうろ|しょうかき|しょうかせん|(しんなー|シンナー)|かきげんきん|(さいん|サイン)|あごひも)/.test(text)) {
    return "あんぜん";
  }
  if (/((ぱてべら|パテベラ)|じべら|(くしばけ|クシばけ|クシバケ)|なでばけ|(ろーらー|ローラー)|はさみ|(かったー|カッター)|(めじゃー|メジャー)|みずいと|(かっとてーぷ|カットテープ)|(したじきてーぷ|したじきテープ)|(しーらー|シーラー)|(ぷらいまー|プライマー))/.test(text)) {
    return "どうぐ";
  }
  return "せこう";
}

const REASON_KW: Record<string, string[]> = {
  あんぜん: ["あぶない", "きけん", "おちる", "てんとう", "やけど", "かんき"],
  どうぐ: ["どうぐ", "つかう", "のり", "きる", "ならす", "おさえる"],
  せこう: ["したじ", "じょいんと", "すんぽう", "ぴったり", "かわく", "こはん"],
};

function scoreReasonText(reason: string, tag: string) {
  if (!reason) return 0;
  const kws = REASON_KW[tag] || [];
  const hits = kws.reduce((n, k) => (reason.includes(k) ? n + 1 : n), 0);
  return hits >= 2 ? 2 : hits >= 1 ? 1 : 0;
}
function scoreLabel(score: number) {
  return score === 2 ? STR.R_SCORE_HI : score === 1 ? STR.R_SCORE_MD : STR.R_SCORE_LO;
}

function makeReason(text: string, answer: string) {
  const t = text;
  if (/とびおり|てんばん/.test(t)) return "あぶないから";
  if (/あんぜんたい/.test(t)) return "おちる きけんを ふせぐから";
  if (/あんぜんつうろ/.test(t)) return "たいひ の じゃまに なるから";
  if (/(しんなー|シンナー)/.test(t)) return "かんきが ひつようだから";
  if (/しょうかき|しょうかせん/.test(t)) return "しょうか の じゃまに なるから";
  if (/(かきげんきん|(すとーぶ|ストーブ))/.test(t)) return "ひが でて あぶないから";
  if (/(びにる|ビニル|びにーる|ビニール)/.test(t) && /つかわれません/.test(t)) return "ビニールクロス も あるから";
  if (/おりもの/.test(t) && /つかわれません/.test(t)) return "おりもの クロス も あるから";
  if (/せっちゃくざい/.test(t) && /かわりません/.test(t)) return "かわくと ちからが へるから";
  if (/せっちゃくざい/.test(t) && /かわります/.test(t)) return "かわくと ちからが へるから";
  if (/(しーらー|シーラー|ぷらいまー|プライマー)/.test(t)) return "したじ の つきを よくするから";
  if (/じべら/.test(t) && /せつだん/.test(t)) return "きる のは はさみ や カッター だから";
  if (/(ろーラー|ローラー)/.test(t) && /つかいません/.test(t)) return "じょいんと は ローラー で おさえるから";
  if (/すんぽうと おなじ おおきさ/.test(t)) return "よぶん を きって ぴったり に するから";
  if (/でんげんが こしょう/.test(t) && /そのまま/.test(t)) return "プラグ を ぬいて しらべるから";
  if (/ふねんざいりょう/.test(t)) return "かべがみ は ふねん では ないから";
  if (/いりすみ.*そとがわ/.test(t)) return "いりすみ は うちがわ だから";
  if (/ですみ.*うちがわ/.test(t)) return "ですみ は そとがわ だから";
  if (/よこめのほうが ひっぱり/.test(t)) return "たてめ の ほう が つよいから";
  if (/(くらい|こい)いろ/.test(t) && /ひろく みせたい/.test(t)) return "あかるい いろ の ほうが ひろく みえるから";
  if (/じょいんと.*(ろーラー|ローラー).*つかいません/.test(t)) return "じょいんと は ローラー で おさえるから";
  return answer === STR.A_MARU ? "きほん に あっているから" : "きほん に そわないから";
}

const REASON_BY_ID: Record<number, string> = {
  1: "パテベラ は かべがみ を きる どうぐ では ない。したじ を ならす どうぐ だから。",
  2: "ひろい ところ は ながい メジャー が あんぜん で せいかく だから。",
  3: "パテ は なかぬり よう も ある から。",
  4: "おりもの の かべがみ も ある から。",
  5: "たかい さぎょう は おちる きけん を ふせぐ ため あんぜんたい を つかう から。",
  6: "てんばん に のる と てんとう の きけん が ある から。",
  7: "その マーク は きんし では ない は まちがい。🚫 は きんし の マーク だから。",
  8: "はばき は ゆか と かべ の つぎめ に つける から。",
  9: "ビニールクロス と いう かべがみ が ある から。",
  10: "たいひ の じゃま に なる から。",
  11: "おちる きけん を ふせぐ ため あんぜんたい を つかう から。",
  12: "とびおり は けが の げんいん に なる から。",
  13: "でんぷん のり と ごうせい せっちゃくざい の 2しゅるい が ある から。",
  14: "たちじょうぎ は ながさ を はかる どうぐ では なく すみだし に つかう から。",
  15: "いのちづな は おやづな に かけて つかう から。",
  16: "むじ の かべがみ も ある から。",
  17: "のり を ぬる のは のりばけ。クシばけ は べつ の しごと だから。",
  18: "せっこうボード は しつない の かべ や てんじょう の したじ に つかう から。",
  19: "げんば では ひふ を まもる ため ながそで が ひつよう だから。",
  20: "せっこうボード は その したじ に つかう から。",
  21: "なでばけ は のり を ぬる どうぐ では ない。はりあと を ならす どうぐ だから。",
  22: "かわく と せっちゃく りょく が へる から。",
  23: "⚠︎ は あんぜんつうろ では なく ちゅうい・きけん を しめす から。",
  24: "ですみ は そとがわ の かど の こと だから。",
  25: "ジョイント ぶ は パテ で ならし が ひつよう だから。",
  26: "その ざいりょう は へきそう はり の したじ に つかう から。",
  27: "ひ の きけん や ほこり たいさく の ため だから。",
  28: "ジョイント の ほうほう に つきつけ と かさねだち が ある から。",
  29: "パテ の あと は サンダー で ならす から。",
  30: "なでばけ は のり を ぬる どうぐ では ない から。",
  31: "そうじ は ビニールクロス の ほう が しやすい から。",
  32: "したじ と のり の つき を よく する から。",
  33: "すこし ながめ に きって はって から きわ を きる から。",
  34: "いりすみ は うちがわ の かど の こと だから。",
  35: "くうき を ぬく のは スムーサー。ほしつき は べつ の どうぐ だから。",
  36: "はさみ や カッター で さいだん する から。",
  37: "じべら は パテ を かける どうぐ では なく きる とき に そえる どうぐ だから。",
  38: "あんぜん の ため プラグ を ぬいて から しらべる から。",
  39: "とそう は かわき や かいそう で じかん が かかる から。",
  40: "みず で のばせる しゅるい も ある から。",
  41: "のこり のり を ふきとる ため だから。",
  42: "かべがみ を きる のは カッター。クシばけ は べつ の どうぐ だから。",
  43: "ななめ の ひかり の ほう が でこぼこ が みつけ やすい から。",
  44: "がら の ある かべがみ も ある から。",
  45: "あごひも を しめない と ぬげて あぶない から。",
  46: "シンナー は きけんぶつ なので かんき が ひつよう だから。",
  47: "でんげん まわり の きけん を ふせぐ ため だから。",
  48: "のりつけ した かべがみ は おりたたんで なじませて はこぶ から。",
  49: "かきげんきん では ひ の しよう は きんし だから。",
  50: "せっちゃく りょく を あげる ため だから。",
  51: "ひくくても とびおり は きけん だから。",
  52: "つねに まえ だけ を むく きまり では ない から。",
  53: "あか は きんし・ていし を しめす から。",
  54: "ふねん の かべがみ も ある から。",
  55: "かべ の きず や よごれ を ふせぐ ため だから。",
  56: "かべがみ の ほう が はやい から。",
  57: "じべら は カッター と いっしょ に きる とき に つかう から。",
  58: "したじ を たいら に ならす どうぐ だから。",
  59: "まわりぶち の のり を ふきとる ため だから。",
  60: "かべがみ に のり を つける とき に つかう から。",
  61: "その マーク の ばしょ は たちいり きんし だから。",
  62: "ひふ を まもる ため ながそで が ひつよう だから。",
  63: "くうき や しわ を ぬく ため だから。",
  64: "ジョイント の さぎょう で つかう から。",
  65: "てんばん に のる と てんとう の きけん が ある から。",
  66: "かきげんきん では ストーブ は つかえない から。",
  67: "つきつけ は したじき テープ を つかわない から。",
  68: "うわパテ は したパテ の あと に かける から。",
  69: "みずいと は すみだし に つかう。ジョイント の さぎょう では ない から。",
  70: "ジョイント ぶ は ローラー で おさえる から。",
  71: "のりつけ した かべがみ は たたんで なじませる から。",
  72: "シンナー しようじ は かんき の ため まど を あける から。",
  73: "あごひも を しめない と ぬげて あぶない から。",
  74: "⚠︎ は ちゅうい・きけん を しめす から。",
  75: "みず で うすめられる しゅるい も ある から。",
  76: "すきま を うめる ため はる まえ に つかう から。",
  77: "ななめ の ひかり で でこぼこ が みえる から。",
  78: "きかい を つかう とき は でんげん を いれる から。",
  79: "したぬり と うわぬり が ある から。",
  80: "ひろい ところ は ながい メジャー が あんぜん で せいかく だから。",
  81: "ながく おく と かわいて ちから が へる から。",
  82: "しょうか の じゃま に なる から。",
  83: "すべらない よう した を しっかり させる ため だから。",
  84: "かみ は たてめ の ほう が つよい から。",
  85: "あわてる と じこ が ひどく なる から。",
  86: "くらい いろ は へや を せまく みせる から。",
  87: "あかるい いろ は ひろく みえる から。",
  88: "たて がら は てんじょう を たかく みせる から。",
  89: "かべがみ は つぶれ にくい よう に たて に つむ から。",
  90: "でんぷん のり は かび の えさ に なりやすい から。",
  91: "がら を あわせて はる から。",
  92: "こしょう を ふせぐ ため まえ に てんけん する から。",
  93: "ななめ の ひかり の ほう が でこぼこ が みえる から。",
  94: "めじ や すきま を うめる から。",
  95: "わし クロス は つうきせい が よい から（『わるい』は まちがい）。",
};

function reasonFor(item: any) {
  return REASON_BY_ID[item?.id as number] ?? makeReason(item.text, item.answer);
}
function displayAnsLabel(ans: string) {
  return ans === STR.A_MARU ? STR.L_CORRECT : ans === STR.A_BATSU ? STR.L_WRONG : ans;
}

function canonicalAnswerFor(text: string, current: string) {
  const t = text;
  if (/(しんなー|シンナー).*まどを あけます/.test(t)) return STR.A_MARU;
  if (/(しんなー|シンナー).*まどを しめます/.test(t)) return STR.A_BATSU;
  return current;
}

const TEMPLATE_BANK = [
  { baseId: 58, tag: "どうぐ", trueText: "ぱてべらは したじを たいらに するときに つかう こうぐです。", falseText: "ぱてべらは かべがみを せつだんするときに つかう こうぐです。" },
  { baseId: 57, tag: "どうぐ", trueText: "じべらは かべがみを せつだんするときに つかう こうぐです。", falseText: "じべらは ぱてを かけるときの こうぐです。" },
  { baseId: 63, tag: "どうぐ", trueText: "すむーさーは かべがみの くうきを ぬくときに つかいます。", falseText: "すむーさーは かべがみの のりつけに つかいます。" },
  { baseId: 70, tag: "どうぐ", trueText: "じょいんとぶ は ろーらーで おさえます。", falseText: "じょいんとぶ には ろーらーは つかいません。" },
  { baseId: 36, tag: "どうぐ", trueText: "かべがみを さいだんするときは かったーを つかいます。", falseText: "かべがみを さいだんするときは くしばけを つかいます。" },
  { baseId: 46, tag: "あんぜん", trueText: "へやの なかで しんなーを つかうときは まどを あけます。", falseText: "へやの なかで しんなーを つかうときは まどを しめます。" },
  { baseId: 65, tag: "あんぜん", trueText: "きゃたつの てんばんに のっては なりません。", falseText: "きゃたつの てんばんに のって さぎょうしても よいです。" },
  { baseId: 51, tag: "あんぜん", trueText: "きゃたつは ひくくても とびおりては いけません。", falseText: "きゃたつは ひくければ とびおりても よいです。" },
  { baseId: 45, tag: "あんぜん", trueText: "ほごぼうを かぶるときは あごひもを しめます。", falseText: "ほごぼうを かぶるときは あごひもは しなくても よいです。" },
  { baseId: 61, tag: "あんぜん", trueText: "🚫 の さいんの ばしょには はいっては いけません。", falseText: "🚫 の さいんは きんしの まーくでは ありません。" },
  { baseId: 32, tag: "せこう", trueText: "しーらーや ぷらいまーは したじの つきを よくするために つかいます。", falseText: "しーらーや ぷらいまーは かべがみの せっちゃくりょくを さげるために つかいます。" },
  { baseId: 25, tag: "せこう", trueText: "てんじょうと へきめんに はる ときは じょいんとぶに ぱてしょりを します。", falseText: "てんじょうと へきめんに はる ときは じょいんとぶに ぱてしょりは しません。" },
  { baseId: 91, tag: "せこう", trueText: "がらもの の かべがみは がらあわせ を して はります。", falseText: "がらもの の かべがみは がらあわせ を しません。" },
  { baseId: 41, tag: "せこう", trueText: "はりおわったら みきりぶちの のりを ふきとります。", falseText: "はりおわっても のりは ふきとりません。" },
] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function genFromTemplates(n = 5): TemplateItem[] {
  const pickBank = shuffle([...TEMPLATE_BANK]).slice(0, n);
  return pickBank.map((t, i) => {
    const makeTrue = Math.random() < 0.5;
    return {
      id: `tpl-${t.baseId}-${Date.now()}-${i}`,
      baseId: t.baseId,
      text: makeTrue ? t.trueText : t.falseText,
      answer: makeTrue ? STR.A_MARU : STR.A_BATSU,
      generated: true as const,
      tag: t.tag,
    };
  });
}

type SessionItem = (QAItem | TemplateItem) & { tag?: string };

function sampleByWeight<T extends { id: any }>(items: T[], boxes: SRSMap, k: number) {
  const pool = [...items];
  const picked: T[] = [];
  while (pool.length && picked.length < k) {
    const weights = pool.map((it) => weightForBox(getBox(boxes, it.id)));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= weights[idx];
      if (r <= 0) break;
    }
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

const Panel: React.FC<{ className?: string; theme: Theme } & React.PropsWithChildren> = ({ children, className = "", theme }) => (
  <div
    className={
      `rounded-2xl p-5 md:p-6 shadow-lg border backdrop-blur ${
        theme === "dark"
          ? "border-cyan-500/30 bg-gradient-to-br from-slate-900/70 to-slate-800/50"
          : "border-slate-300 bg-gradient-to-br from-white to-slate-50"
      } ${className}`
    }
  >
    {children}
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; className?: string; theme: Theme }> = ({ children, className = "", theme }) => (
  <span
    className={
      `inline-block rounded-full px-3 py-1 text-xs md:text-sm border ${
        theme === "dark" ? "border-fuchsia-400/40 bg-fuchsia-500/10" : "border-fuchsia-300 bg-fuchsia-100"
      } ${className}`
    }
  >
    {children}
  </span>
);

const Button: React.FC<{
  label: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger" | "success" | "warning" | "info" | "neutral";
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  theme: Theme;
  fullWidth?: boolean;
}> = ({ label, onClick, kind = "primary", disabled, className = "", size = "md", theme, fullWidth = false }) => {
  const sizeCls =
    size === "sm"
      ? "px-3 py-1.5 text-xs md:text-sm rounded-lg"
      : "px-5 py-3 text-sm md:text-base rounded-xl";
  const widthCls = fullWidth ? "w-full" : "w-auto";
  const base = `${widthCls} ${sizeCls} font-semibold whitespace-nowrap transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-cyan-400/50 disabled:opacity-60 disabled:cursor-not-allowed`;
  const solid = (bg: string, hover: string, text: string) => `${bg} ${hover} ${text}`;
  const styles =
    kind === "primary"
      ? solid("bg-cyan-500/90", "hover:bg-cyan-400", "text-black")
      : kind === "success"
      ? solid("bg-emerald-500/90", "hover:bg-emerald-400", "text-white")
      : kind === "danger"
      ? solid("bg-rose-500/90", "hover:bg-rose-400", "text-white")
      : kind === "warning"
      ? solid("bg-amber-500/90", "hover:bg-amber-400", "text-black")
      : kind === "info"
      ? solid("bg-sky-500/90", "hover:bg-sky-400", "text-white")
      : kind === "neutral"
      ? theme === "dark"
        ? "bg-slate-600/70 hover:bg-slate-500/70 text-slate-100 border border-slate-500/50"
        : "bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300"
      : theme === "dark"
      ? "bg-slate-700/60 hover:bg-slate-600/60 text-slate-100 border border-slate-500/40"
      : "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300";
  return (
    <button className={`${base} ${styles} ${className}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};

const ThemeToggle: React.FC<{ theme: Theme; setTheme: (t: Theme) => void }> = ({ theme, setTheme }) => (
  <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
    <Button
      size="sm"
      theme={theme}
      kind={theme === "dark" ? "primary" : "info"}
      label={STR.BTN_THEME_DARK}
      className="flex-1 min-w-[120px] sm:flex-none"
      onClick={() => setTheme("dark")}
    />
    <Button
      size="sm"
      theme={theme}
      kind={theme === "light" ? "primary" : "warning"}
      label={STR.BTN_THEME_LIGHT}
      className="flex-1 min-w-[120px] sm:flex-none"
      onClick={() => setTheme("light")}
    />
  </div>
);

const VerdictBanner: React.FC<{ ok: boolean; theme: Theme; correctLabel: string }> = ({ ok, theme, correctLabel }) => {
  const base = "flex items-center gap-3 p-3 md:p-4 rounded-xl border";
  const okCls =
    theme === "dark"
      ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-300"
      : "bg-emerald-100 border-emerald-300 text-emerald-700";
  const ngCls =
    theme === "dark"
      ? "bg-rose-500/10 border-rose-400/40 text-rose-300"
      : "bg-rose-100 border-rose-300 text-rose-700";
  return (
    <div role="status" aria-live="polite" className={`${base} ${ok ? okCls : ngCls}`}>
      <div className={`text-2xl md:text-3xl ${ok ? "animate-pulse" : ""}`}>{ok ? "✅" : "❌"}</div>
      <div className="leading-tight">
        <div className="font-semibold md:text-lg">{ok ? STR.TXT_CORRECT_POP : STR.TXT_WRONG_POP}</div>
        <div className="text-xs md:text-sm opacity-90">
          {STR.SEIKAI_LABEL}
          {correctLabel}
        </div>
      </div>
    </div>
  );
};

type RecordItem = {
  item: SessionItem;
  user: string | undefined;
  ok: boolean | null | undefined;
  reason: string;
  conf: "hi" | "md" | "lo";
  rScore: number;
};

const useSession = () => {
  const [session, setSession] = useState<SessionItem[]>([]);
  const [boxes, setBoxes] = useState<SRSMap>({});
  const [boxesReady, setBoxesReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSrsMap()
      .then((map) => {
        if (!alive) return;
        setBoxes(map);
        setBoxesReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setBoxesReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const buildSession = useCallback(() => {
    const current = boxes;
    const base15 = sampleByWeight(DATA, current, 15) as SessionItem[];
    const gen5 = genFromTemplates(5) as SessionItem[];
    const qs = shuffle<SessionItem>([...base15, ...gen5]);
    setSession(qs);
    return qs;
  }, [boxes]);

  return {
    session,
    setSession,
    boxes,
    setBoxes,
    boxesReady,
    buildSession,
  };
};

export default function App() {
  const { theme, setTheme } = useThemeState();
  const { session, setSession, boxes, setBoxes, boxesReady, buildSession } = useSession();

  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState<null | { ok: boolean; user: string }>(null);
  const [reason, setReason] = useState("");
  const [conf, setConf] = useState<"hi" | "md" | "lo">("md");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [sessionStamp, setSessionStamp] = useState<string>(() => newSessionStamp());

  useEffect(() => {
    if (!started) return;
    if (session.length === 0) {
      const qs = buildSession();
      setSession(qs);
      setIdx(0);
      setAnswered(null);
      setReason("");
      setConf("md");
      setRecords([]);
    }
  }, [started, session.length, buildSession, setSession]);

  const q = session[idx];

  const startOrReset = useCallback(() => {
    const qs = buildSession();
    setSession(qs);
    setSessionStamp(newSessionStamp());
    setIdx(0);
    setAnswered(null);
    setReason("");
    setConf("md");
    setRecords([]);
    setStarted(true);
  }, [buildSession, setSession, setSessionStamp]);

  const answer = useCallback(
    (ans: string) => {
      if (!q || answered) return;
      if (ans === STR.A_SKIP) {
        void appendSessionLogs([
          {
            sessionStamp,
            questionId: q.id,
            baseId: (q as any).baseId || q.id,
            userAnswer: STR.A_SKIP,
            correct: null,
            reason: "",
            confidence: "lo",
            tag: guessTag(q.text),
            reasonScore: 0,
            createdAt: Date.now(),
          },
        ]);
        setRecords((r) => [...r, { item: q, user: STR.A_SKIP, ok: null, reason: "", conf: "lo", rScore: 0 }]);
        setIdx((i) => Math.min(i + 1, 19));
        return;
      }
      const canon = canonicalAnswerFor(q.text, q.answer);
      const ok = ans === canon;
      setAnswered({ ok, user: ans });
    },
    [q, answered, sessionStamp]
  );

  const onNext = useCallback(() => {
    if (!q) return;
    const tag = guessTag(q.text);
    const rScore = scoreReasonText(reason, tag);

    setRecords((r) => [...r, { item: q, user: answered?.user, ok: answered?.ok, reason: reason.trim(), conf, rScore }]);

    void appendSessionLogs([
      {
        sessionStamp,
        questionId: q.id,
        baseId: (q as any).baseId || q.id,
        userAnswer: answered?.user ?? null,
        correct: answered?.ok ?? null,
        reason: reason.trim(),
        confidence: conf,
        tag,
        reasonScore: rScore,
        createdAt: Date.now(),
      },
    ]);

    const map = { ...boxes };
    const id = (q as any).baseId || q.id;
    const cur = getBox(map, id);
    if (answered && answered.ok) {
      const bump = conf === "hi" ? 2 : 1;
      setBox(map, id, cur + bump);
    } else if (answered && answered.ok === false) {
      setBox(map, id, cur - 1);
    }
    void saveSrsMap(map);
    setBoxes(map);

    setReason("");
    setConf("md");
    setAnswered(null);
    setIdx((i) => Math.min(i + 1, 20));
  }, [q, boxes, answered, reason, conf, setBoxes, sessionStamp]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
      if (!answered) {
        if (e.key === "1") answer(STR.A_MARU);
        if (e.key === "2") answer(STR.A_BATSU);
        if (e.key === "0") answer(STR.A_SKIP);
      } else if (e.key === "Enter") {
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, answered, answer, onNext]);

  const rootCls = `min-h-screen px-4 py-6 md:py-10 ${
    theme === "dark"
      ? "bg-gradient-to-b from-[#070a14] to-[#0c1020] text-slate-100"
      : "bg-gradient-to-b from-slate-50 to-white text-slate-900"
  }`;

  if (!started) {
    return (
      <div className={rootCls}>
        <div className="max-w-3xl mx-auto space-y-5">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-semibold tracking-wide">{STR.APP_TITLE}</h1>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end">
              <ThemeToggle theme={theme} setTheme={setTheme} />
              <Button
                theme={theme}
                label={STR.BTN_START_RESET}
                kind="success"
                onClick={startOrReset}
                disabled={!boxesReady}
                fullWidth
                className="min-w-[150px] sm:w-auto sm:flex-none"
              />
            </div>
          </header>

          <Panel theme={theme}>
            <div className="space-y-3 text-sm md:text-base leading-relaxed">
              <div>・{STR.INTRO_1}</div>
              <div>・{STR.INTRO_2}</div>
              <div>・{STR.INTRO_3}</div>
              <div className="text-xs opacity-75">{STR.HINT_KEY}</div>
              {!boxesReady && <div className="text-xs text-amber-500/90">データを じゅんびしています…</div>}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  if (idx >= 20) {
    const wrong = records.filter((r) => r.ok === false);
    const skips = records.filter((r) => r.ok === null);
    const correct = records.filter((r) => r.ok === true).length;
    return (
      <div className={rootCls}>
        <div className="max-w-3xl mx-auto space-y-5">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-semibold tracking-wide">{STR.APP_TITLE}</h1>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end">
              <ThemeToggle theme={theme} setTheme={setTheme} />
              <Button
                theme={theme}
                label={STR.BTN_START_RESET}
                kind="success"
                onClick={startOrReset}
                disabled={!boxesReady}
                fullWidth
                className="min-w-[150px] sm:w-auto sm:flex-none"
              />
            </div>
          </header>

          <Panel theme={theme}>
            <div className="space-y-2">
              <div className="text-lg md:text-xl font-semibold">{STR.RESULT_TITLE}</div>
              <div className={pick(theme, "h-2 w-full rounded bg-slate-700/50 overflow-hidden", "h-2 w-full rounded bg-slate-200 overflow-hidden")}>
                <div className="h-full bg-gradient-to-r from-fuchsia-400 to-cyan-400" style={{ width: `${(correct / 20) * 100}%` }} />
              </div>
              <div className="text-sm opacity-80">{correct} / 20</div>
            </div>
          </Panel>

          {wrong.length > 0 && (
            <Panel theme={theme}>
              <div className="text-base md:text-lg font-medium mb-3">
                {STR.WRONG_LIST}（{wrong.length}）
              </div>
              <ul className="space-y-4 text-sm md:text-base">
                {wrong.map((w, i) => (
                  <li key={i} className={pick(theme, "border-t border-slate-600/40 pt-3", "border-t border-slate-200 pt-3")}>
                    <div className="mb-1">{w.item.text}</div>
                    <div className={pick(theme, "text-cyan-300", "text-cyan-600")}>
                      {STR.SEIKAI_LABEL}
                      {displayAnsLabel(canonicalAnswerFor(w.item.text, w.item.answer))}
                    </div>
                    <div className={pick(theme, "text-slate-300", "text-slate-700")}>
                      {STR.REASON_LABEL}
                      {w.reason || reasonFor(w.item)}
                    </div>
                    <div className={`${pick(theme, "text-slate-400", "text-slate-500")} text-xs`}>
                      {STR.TAG_LABEL}
                      {guessTag(w.item.text)} {STR.SEP}
                      {scoreLabel(w.rScore)}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {skips.length > 0 && (
            <Panel theme={theme}>
              <div className="text-base md:text-lg font-medium mb-2">
                {STR.SKIP_LIST}（{skips.length}）
              </div>
              <ul className="list-disc pl-5 space-y-1 text-sm md:text-base">
                {skips.map((s, i) => (
                  <li key={i}>{s.item.text}</li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="flex justify-end">
            <Button theme={theme} label={STR.RESULT_RETRY} onClick={startOrReset} disabled={!boxesReady} />
          </div>
        </div>
      </div>
    );
  }

  const panelAccent = answered ? (answered.ok ? "ring-2 ring-emerald-400/50 border-emerald-400/60" : "ring-2 ring-rose-400/50 border-rose-400/60") : "";

  return (
    <div className={rootCls}>
      <div className="max-w-3xl mx-auto space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-xl md:text-2xl font-semibold tracking-wide">{STR.APP_TITLE}</h1>
            <Chip theme={theme} className="w-max">
              {STR.Q_PREFIX}
              {idx + 1}/20
            </Chip>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <Button
              theme={theme}
              label={STR.BTN_START_RESET}
              kind="success"
              onClick={startOrReset}
              disabled={!boxesReady}
              fullWidth
              className="min-w-[150px] sm:w-auto sm:flex-none"
            />
          </div>
        </header>

        <div className={pick(theme, "h-2 w-full rounded bg-slate-700/50 overflow-hidden", "h-2 w-full rounded bg-slate-200 overflow-hidden")}>
          <div className="h-full bg-gradient-to-r from-fuchsia-400 to-cyan-400" style={{ width: `${(idx / 20) * 100}%` }} />
        </div>

        <Panel theme={theme} className={panelAccent}>
          <div className="text-base md:text-lg leading-relaxed">{q?.text}</div>
          {!answered ? (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Button theme={theme} kind="success" label={`✓ ${STR.L_CORRECT}`} onClick={() => answer(STR.A_MARU)} fullWidth />
              <Button theme={theme} kind="danger" label={`✕ ${STR.L_WRONG}`} onClick={() => answer(STR.A_BATSU)} fullWidth />
              <Button theme={theme} kind="neutral" label={`… ${STR.L_SKIP}`} onClick={() => answer(STR.A_SKIP)} fullWidth />
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <VerdictBanner ok={!!answered.ok} theme={theme} correctLabel={displayAnsLabel(canonicalAnswerFor(q.text, q.answer))} />

              <div className="space-y-2">
                <div className="text-xs opacity-80">{STR.CONF_TITLE}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 items-stretch">
                  <Button
                    theme={theme}
                    label={makeConfidenceLabel(STR.CONF_HIGH)}
                    kind={conf === "hi" ? "primary" : "ghost"}
                    onClick={() => setConf("hi")}
                    fullWidth
                    className="min-h-11 text-[clamp(0.9rem,2.6vw,1rem)]"
                  />
                  <Button
                    theme={theme}
                    label={makeConfidenceLabel(STR.CONF_MID)}
                    kind={conf === "md" ? "primary" : "ghost"}
                    onClick={() => setConf("md")}
                    fullWidth
                    className="min-h-11 text-[clamp(0.9rem,2.6vw,1rem)]"
                  />
                  <Button
                    theme={theme}
                    label={makeConfidenceLabel(STR.CONF_LOW)}
                    kind={conf === "lo" ? "primary" : "ghost"}
                    onClick={() => setConf("lo")}
                    fullWidth
                    className="min-h-11 text-[clamp(0.9rem,2.6vw,1rem)]"
                  />
                </div>
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={STR.PLACEHOLDER_REASON}
                className={
                  theme === "dark"
                    ? "w-full mt-2 rounded-lg bg-slate-800/70 border border-slate-600/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    : "w-full mt-2 rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                }
              />

              <div className="flex justify-end">
                <Button theme={theme} label={STR.KAI_BTN_NEXT} onClick={onNext} />
              </div>
            </div>
          )}
          <div className="mt-4 text-xs opacity-70">{STR.PROGRESS_HINT}</div>
        </Panel>

        <footer className="text-xs opacity-60 text-right">{STR.FOOTER_HELP}</footer>
      </div>
    </div>
  );
}
