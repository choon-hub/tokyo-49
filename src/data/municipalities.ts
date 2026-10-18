// 東京23区＋26市（計49区市）のマスタ。固定データで、これを正とする。
// 項目は docs/requirements.md §5.1 の dict.db `municipalities` テーブルと同じ。
// code は総務省の全国地方公共団体コードのうち、チェックデジットを除いた5桁。
// kana はひらがなで持つ（§6 の検索は入力をひらがなにそろえて突き合わせるため）。
// 並びは code の昇順で、そのまま一覧の表示順になる。
// 町・村・島しょ部（133xx 以降）は対象外（§1.3）。

export type MunicipalityType = "ward" | "city";

export type Municipality = {
  readonly code: string;
  readonly name: string;
  readonly kana: string;
  readonly type: MunicipalityType;
};

export const MUNICIPALITIES: readonly Municipality[] = [
  // 23区
  { code: "13101", name: "千代田区", kana: "ちよだく", type: "ward" },
  { code: "13102", name: "中央区", kana: "ちゅうおうく", type: "ward" },
  { code: "13103", name: "港区", kana: "みなとく", type: "ward" },
  { code: "13104", name: "新宿区", kana: "しんじゅくく", type: "ward" },
  { code: "13105", name: "文京区", kana: "ぶんきょうく", type: "ward" },
  { code: "13106", name: "台東区", kana: "たいとうく", type: "ward" },
  { code: "13107", name: "墨田区", kana: "すみだく", type: "ward" },
  { code: "13108", name: "江東区", kana: "こうとうく", type: "ward" },
  { code: "13109", name: "品川区", kana: "しながわく", type: "ward" },
  { code: "13110", name: "目黒区", kana: "めぐろく", type: "ward" },
  { code: "13111", name: "大田区", kana: "おおたく", type: "ward" },
  { code: "13112", name: "世田谷区", kana: "せたがやく", type: "ward" },
  { code: "13113", name: "渋谷区", kana: "しぶやく", type: "ward" },
  { code: "13114", name: "中野区", kana: "なかのく", type: "ward" },
  { code: "13115", name: "杉並区", kana: "すぎなみく", type: "ward" },
  { code: "13116", name: "豊島区", kana: "としまく", type: "ward" },
  { code: "13117", name: "北区", kana: "きたく", type: "ward" },
  { code: "13118", name: "荒川区", kana: "あらかわく", type: "ward" },
  { code: "13119", name: "板橋区", kana: "いたばしく", type: "ward" },
  { code: "13120", name: "練馬区", kana: "ねりまく", type: "ward" },
  { code: "13121", name: "足立区", kana: "あだちく", type: "ward" },
  { code: "13122", name: "葛飾区", kana: "かつしかく", type: "ward" },
  { code: "13123", name: "江戸川区", kana: "えどがわく", type: "ward" },
  // 26市
  { code: "13201", name: "八王子市", kana: "はちおうじし", type: "city" },
  { code: "13202", name: "立川市", kana: "たちかわし", type: "city" },
  { code: "13203", name: "武蔵野市", kana: "むさしのし", type: "city" },
  { code: "13204", name: "三鷹市", kana: "みたかし", type: "city" },
  { code: "13205", name: "青梅市", kana: "おうめし", type: "city" },
  { code: "13206", name: "府中市", kana: "ふちゅうし", type: "city" },
  { code: "13207", name: "昭島市", kana: "あきしまし", type: "city" },
  { code: "13208", name: "調布市", kana: "ちょうふし", type: "city" },
  { code: "13209", name: "町田市", kana: "まちだし", type: "city" },
  { code: "13210", name: "小金井市", kana: "こがねいし", type: "city" },
  { code: "13211", name: "小平市", kana: "こだいらし", type: "city" },
  { code: "13212", name: "日野市", kana: "ひのし", type: "city" },
  { code: "13213", name: "東村山市", kana: "ひがしむらやまし", type: "city" },
  { code: "13214", name: "国分寺市", kana: "こくぶんじし", type: "city" },
  { code: "13215", name: "国立市", kana: "くにたちし", type: "city" },
  { code: "13218", name: "福生市", kana: "ふっさし", type: "city" },
  { code: "13219", name: "狛江市", kana: "こまえし", type: "city" },
  { code: "13220", name: "東大和市", kana: "ひがしやまとし", type: "city" },
  { code: "13221", name: "清瀬市", kana: "きよせし", type: "city" },
  { code: "13222", name: "東久留米市", kana: "ひがしくるめし", type: "city" },
  { code: "13223", name: "武蔵村山市", kana: "むさしむらやまし", type: "city" },
  { code: "13224", name: "多摩市", kana: "たまし", type: "city" },
  { code: "13225", name: "稲城市", kana: "いなぎし", type: "city" },
  { code: "13227", name: "羽村市", kana: "はむらし", type: "city" },
  { code: "13228", name: "あきる野市", kana: "あきるのし", type: "city" },
  { code: "13229", name: "西東京市", kana: "にしとうきょうし", type: "city" },
];
