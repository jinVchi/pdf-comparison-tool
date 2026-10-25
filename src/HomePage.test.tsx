import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";
import HomePage from "./HomePage";

describe("login home page", () => {
    it("shows the login form before session validation without exposing the workspace", () => {
        const html = renderToStaticMarkup(<App />);
        expect(html).toContain('type="email"');
        expect(html).toContain('autoComplete="current-password"');
        expect(html).toContain("接続を確認しています");
        expect(html).toContain("<fieldset disabled");
        expect(html).not.toContain('type="file"');
        expect(html).not.toContain('class="sidebar"');
    });

    it("enables sign-in after bootstrap and offers registration with no guest entry", () => {
        const html = renderToStaticMarkup(<HomePage ready checking={false} error="" retry={() => {}} />);
        expect(html).toContain("ログイン");
        expect(html).toContain("新規登録");
        expect(html).not.toContain("<fieldset disabled");
        expect(html).not.toContain("ゲスト");
        expect(html).not.toContain("サンプルPDFで試す");
    });

    it("keeps the form disabled and provides reconnect when bootstrap fails", () => {
        const html = renderToStaticMarkup(<HomePage ready={false} checking={false} error="接続エラー" retry={() => {}} />);
        expect(html).toContain('role="alert"');
        expect(html).toContain("接続エラー");
        expect(html).toContain("再接続");
        expect(html).toContain("<fieldset disabled");
    });
});
