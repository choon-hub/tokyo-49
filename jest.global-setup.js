// 日付のテストが実行環境のタイムゾーンに左右されないよう、JST に固定する。
// 各ワーカーはこの後に起動するので、ここで設定した値を引き継ぐ。
module.exports = () => {
  process.env.TZ = "Asia/Tokyo";
};
