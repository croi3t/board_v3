import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

# クライアントの初期化
client = genai.Client(api_key=API_KEY)

import json

def summarize_text(title: str, content: str) -> dict:
    """記事のタイトルと内容を元に要約とAIタグを生成する"""
    if not API_KEY:
        return "Error: Gemini API key is not set."
        
    prompt = f"""
以下の記事を読み、スマホの画面でサクッと読めるように要約してください。
※元の記事が英語などの外国語であっても、必ず「日本語」で出力してください。

なるべく箇条書きを用い、重要なポイントを3つ程度に絞ってください。
箇条書きにする際は、各行の「・」の前に必ず改行（\n）を入れてください。
例：
\n・ポイント1
\n・ポイント2
\n・ポイント3

また、この記事に最も適した大まかなジャンル（タグ）を1単語で判定してください。
（例：政治, 経済, IT, テクノロジー, サイエンス, 医療, 健康, 料理, アニメ, 漫画, アイドル, ゲーム, 論文, その他）

以下のJSONフォーマットのみを出力してください。バッククォートなどのマークダウン修飾は不要です。
{{
    "tag": "大まかなジャンル名",
    "summary": "要約のテキスト..."
}}

タイトル: {title}
内容: {content}
"""

    try:
        # Geminiに送信して要約とタグを取得
        response = client.models.generate_content(
            model='gemini-3.5-flash-lite',
            contents=prompt
        )
        
        # 稀に ```json と ``` が付くことがあるので除去
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        result = json.loads(text.strip())
        return result
    except Exception as e:
        print(f"Summarization error: {e}")
        return {"summary": "要約の生成に失敗しました。", "tag": "Error"}

if __name__ == "__main__":
    # テスト用
    print(summarize_text("テスト記事", "これはテスト用の記事本文です。AIが内容を分析して要約を作成します。"))
