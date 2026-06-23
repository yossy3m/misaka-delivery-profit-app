# 次回の作業メモ

## 次回やること

1. 車両マスターの追加・変更方法を検討する
2. 入力内容の保存や配送履歴機能を検討する
3. 既存の機能は壊さない
   - 出発地・配送先から距離取得
   - 所要時間取得
   - 高速料金取得
   - 利益計算

## 現在できていること

- 出発地、任意の集荷地、配送先の住所入力
- 車種とナンバーを組み合わせた車両選択
- 選択車両の車種表示と燃費の自動入力
- 荷積み・荷下ろし・待機時間を含む拘束時間計算
- 拘束時間と時間単価からの人件費計算
- 計算結果の履歴保存・一覧表示・個別削除
- `.env`によるGoogle Maps APIキー管理
- 距離・所要時間・高速料金の取得
- 燃費、燃料単価、売上から利益計算
- 売上30,000円で利益25,192円まで確認済み

---

# 配送利益計算アプリ

Google Geocoding APIとGoogle Routes APIを使い、配送ルートの距離・所要時間・
高速料金を取得して利益を計算するアプリです。APIキーは画面側へ渡さず、
ローカルサーバーの`.env`で管理します。

集荷地を入力した場合は「出発地 → 集荷地 → 配送先」、空欄の場合は
「出発地 → 配送先」の順で距離・所要時間・高速料金を取得します。

「往復で計算する」をONにした場合は、行きのルートに加えて
「配送先 → 出発地」の帰りルートを取得して合算します。帰り道には集荷地を
含めません。全ルートを単純に2倍する計算ではありません。

## ファイルの役割

- `index.html`：入力欄、ボタン、計算結果など、画面の部品を記述します。
- `style.css`：色、余白、スマートフォン表示など、画面の見た目を整えます。
- `script.js`：サーバーへのルート取得依頼と、燃料費・経費・利益の計算を行います。
- `server.js`：ローカル起動時に`.env`を読み、Google APIへ安全に問い合わせます。
- `api/route.js`：Vercel上でGoogle APIへ問い合わせるVercel Functionです。
- `vercel.json`：Vercel Functionの実行設定です。
- `.env`：実際のAPIキーを保存します。Gitには登録されません。
- `.env.example`：`.env`の記入例です。APIキーそのものは書きません。
- `.gitignore`：`.env`がGitへ登録されないようにします。
- `package.json`：アプリを簡単なコマンドで起動するための設定です。

## Google Cloudの準備

1. Google Cloud Consoleでプロジェクトを作成します。
2. プロジェクトに請求先アカウントを設定します。
3. 「Geocoding API」と「Routes API」を有効にします。
4. 「APIとサービス」→「認証情報」からAPIキーを作成します。
5. APIキーの「APIの制限」で、Geocoding APIとRoutes APIだけを許可します。
## APIキーの設定方法

1. このフォルダにある`.env`をメモ帳などで開きます。
2. 次の行の「ここにAPIキーを貼り付けてください」の部分を、自分のAPIキーに置き換えます。

```env
GOOGLE_MAPS_API_KEY=ここにAPIキーを貼り付けてください
```

たとえばAPIキーが`AIza...`の場合は、次の形です。

```env
GOOGLE_MAPS_API_KEY=AIza...
```

APIキーの前後に空白や引用符を付ける必要はありません。`.env`を変更した後は、
起動中のサーバーを一度終了して再起動してください。

## 初回の起動方法

### 1. Node.jsをインストールする

[Node.js公式サイト](https://nodejs.org/ja)からLTS版をインストールします。
このアプリはNode.js 24を使用します。

### 2. アプリのフォルダでターミナルを開く

エクスプローラーで`misaka-delivery-profit-app`フォルダを開き、
アドレスバーに`powershell`と入力してEnterキーを押します。

### 3. アプリを起動する

開いた画面で次のコマンドを実行します。

```powershell
npm start
```

「配送利益計算アプリを起動しました」と表示されたら、ブラウザで次を開きます。

```text
http://127.0.0.1:3000
```

終了するときは、ターミナルで`Ctrl`キーを押しながら`C`キーを押します。

> `index.html`を直接ダブルクリックして開く方法では、ルート取得は動きません。
> 必ず`npm start`で起動してください。

## Vercelで公開する方法

公開後はVercelが発行するHTTPSのURLをスマートフォンで開けます。
APIキーはVercelのサーバー側環境変数から読み込み、HTMLやブラウザには渡しません。

### 1. GitHubへアップロードする

1. GitHubで新しいリポジトリを作成します。
2. このアプリのファイルをGitHubへアップロードします。
3. `.env`はアップロードしないでください。`.gitignore`で除外済みです。

このアプリが大きなリポジトリ内の`misaka-delivery-profit-app`フォルダにある場合は、
次のVercel設定でRoot Directoryに`misaka-delivery-profit-app`を指定します。

### 2. Vercelへ取り込む

1. [Vercel](https://vercel.com/)へGitHubアカウントでログインします。
2. 「Add New」→「Project」を選びます。
3. 作成したGitHubリポジトリの「Import」を押します。
4. Framework Presetは「Other」のままで構いません。
5. 必要な場合だけRoot Directoryを`misaka-delivery-profit-app`にします。
6. まだDeployは押さず、Environment Variablesを設定します。

### 3. Google Maps APIキーを環境変数へ設定する

Environment Variablesへ次の内容を追加します。

| Name | Value |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | Google Maps APIキー |

Production、Preview、Developmentのすべてで使う場合は、3環境すべてを選択します。
設定画面ではAPIキーを第三者に共有しないでください。

### 4. デプロイする

「Deploy」を押します。完了すると、次のようなURLが発行されます。

```text
https://プロジェクト名.vercel.app
```

このURLをスマートフォンへ送れば、そのままアプリを開けます。

環境変数をデプロイ後に追加・変更した場合は、VercelのDeployments画面から
最新デプロイをRedeployしてください。環境変数は新しいデプロイから反映されます。

### 5. 今後の更新

GitHubへ変更をpushすると、Vercelが自動的に新しいデプロイを作成します。
本番ブランチ（通常は`main`）への変更は本番URLへ反映されます。

### Google APIキーの制限

Google Cloud Consoleで、APIキーの「APIの制限」を次の2つだけに設定してください。

- Geocoding API
- Routes API

この構成ではVercel FunctionがGoogle APIを呼ぶため、ブラウザ用のHTTPリファラー
制限を付けると動かない場合があります。キーをHTMLへ書く必要はありません。

### Vercel公開時の履歴について

計算履歴はスマートフォンのブラウザ内の`localStorage`へ保存されます。
同じスマートフォン・同じブラウザでは再読み込み後も残りますが、パソコンや
別のスマートフォンとは自動共有されません。

Vercel公式資料：

- [Vercel Functions](https://vercel.com/docs/functions)
- [Environment Variables](https://vercel.com/docs/environment-variables)
- [Git連携によるデプロイ](https://vercel.com/docs/git)

## 計算式

- 燃料費 ＝ 距離 ÷ 燃費 × 燃料単価
- 拘束時間 ＝ ルート所要時間 ＋ 荷積み時間 ＋ 荷下ろし時間 ＋ 待機時間
- 人件費 ＝ 拘束時間（時間換算）× 人件費単価
- 経費合計 ＝ 燃料費 ＋ 高速料金 ＋ 人件費
- 最終利益 ＝ 売上 − 経費合計

## 履歴保存

「この計算結果を履歴に保存」ボタンを押すと、日付、車両、ルート、往復有無、
距離、所要時間、高速料金、燃料費、人件費、経費合計、最終利益を保存します。

履歴はブラウザの`localStorage`に保存されるため、同じブラウザでページを
再読み込みしても残ります。別のブラウザや端末とは共有されません。

## 注意事項

- `.env`は他人へ送ったり、画面共有で見せたりしないでください。
- `.env`は`.gitignore`に登録済みです。誤ってGitへ登録しないでください。
- APIキーにはGeocoding APIとRoutes APIだけを許可する「APIの制限」を
  必ず設定してください。
- この構成ではAPIキーをHTMLやブラウザのJavaScriptへ渡しません。
- Google Routes APIが高速料金を返さないルートでは、高速料金を0円にして
  手入力できるようにしています。
- Routes APIの高速料金は推定値です。実際の車種、時間帯、ETC割引などにより
  異なる場合があります。
