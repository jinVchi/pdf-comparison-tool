import { useState } from "react";
import { ArrowRight, Check, FileDiff, FileText, LoaderCircle, ShieldCheck } from "lucide-react";
import AuthForm from "./AuthForm";
import type { AuthMode } from "./AuthForm";
import "./home.css";

export default function HomePage({ ready, checking, error, retry }: {
    ready: boolean;
    checking: boolean;
    error: string;
    retry: () => void;
}) {
    const [mode, setMode] = useState<AuthMode>("sign-in");
    const [busy, setBusy] = useState(false);
    const registering = mode === "sign-up";

    return (
        <div className="home-page">
            <header className="home-header">
                <a className="home-brand" href="/" aria-label="差分 ホーム">
                    <span className="brand-mark"><FileDiff size={25} strokeWidth={1.7} /></span>
                    <span>差分 <small>sabun</small></span>
                </a>
                <span className="home-header-note">PDF COMPARISON WORKSPACE</span>
            </header>
            <main className="home-layout">
                <section className="home-intro" aria-labelledby="home-title">
                    <span className="home-eyebrow"><span /> 書類の確認に、少しの余白を。</span>
                    <h1 id="home-title">書類の「違い」を、<br /><em>確かな安心に。</em></h1>
                    <p className="home-description">文字、数字、レイアウト。<br />日本語の帳票にひそむ小さな変更を、<br className="home-desktop-break" />ひと目で、わかりやすく。</p>
                    <div className="home-preview" aria-label="書類の金額差分のイメージ">
                        <div className="home-preview-top"><FileText size={17} /><span>お見積書</span><small>差分プレビュー</small></div>
                        <div className="home-preview-docs">
                            <div><small>変更前</small><span className="preview-line" /><span className="preview-line short" />
                                <span className="preview-caption">お見積金額</span><del>¥ 1,210,000</del></div>
                            <ArrowRight size={20} />
                            <div><small>変更後</small><span className="preview-line" /><span className="preview-line short" />
                                <span className="preview-caption">お見積金額</span><ins>¥ 1,375,000</ins></div>
                        </div>
                        <div className="home-preview-bottom"><Check size={13} /> 金額の変更をハイライト</div>
                    </div>
                    <ul className="home-features">
                        <li><Check size={15} />文字・数字・見た目をまとめて比較</li>
                        <li><Check size={15} />アカウントごとに履歴を管理</li>
                        <li><Check size={15} />ファイルは24時間で自動削除</li>
                    </ul>
                </section>
                <section className="home-account" aria-labelledby="account-title">
                    <div className="home-card">
                        <span className="home-card-icon"><ShieldCheck size={23} /></span>
                        <span className="home-card-eyebrow">YOUR WORKSPACE</span>
                        <h2 id="account-title">{registering ? "アカウントを作成" : "おかえりなさい。"}</h2>
                        <p className="home-card-description">{registering ? "登録して、書類の比較をはじめましょう。" : "ログインして、書類の比較をはじめましょう。"}</p>
                        {checking && <p className="home-status" role="status"><LoaderCircle size={15} className="spin" /> 接続を確認しています…</p>}
                        {error && <div className="auth-error" role="alert"><p>{error}</p><button type="button" onClick={retry}>再接続</button></div>}
                        <AuthForm mode={mode} changeMode={setMode} busy={busy} setBusy={setBusy} disabled={!ready} />
                    </div>
                    <p className="home-account-note">PDFの比較・履歴の閲覧にはログインが必要です。</p>
                </section>
            </main>
            <footer className="home-footer"><span>差分 sabun</span><span>小さな差分を、大きな安心に。</span></footer>
        </div>
    );
}
