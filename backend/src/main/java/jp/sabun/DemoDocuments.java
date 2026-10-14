package jp.sabun;

import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.fontbox.ttf.TrueTypeCollection;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.io.*;
import java.nio.file.*;
import java.awt.Color;

@Component
class DemoDocuments {
    private final String configured;
    DemoDocuments(@Value("${app.japanese-font:}") String configured){this.configured=configured;}
    void create(Path destination,boolean revised) throws IOException {
        Path fontPath=fontPath();
        try(PDDocument doc=new PDDocument()) {
            if(fontPath.toString().endsWith(".ttc")) {
                try(var collection=new TrueTypeCollection(fontPath.toFile())) {
                    PDType0Font[] chosen=new PDType0Font[1];collection.processAllFonts(f->{if(chosen[0]==null)chosen[0]=PDType0Font.load(doc,f,true);});
                    draw(doc,chosen[0],revised);doc.save(destination.toFile());
                }
            } else {
                PDType0Font font=PDType0Font.load(doc,fontPath.toFile());draw(doc,font,revised);doc.save(destination.toFile());
            }
        }
    }
    private Path fontPath() throws IOException {
        for(String candidate:new String[]{configured,"C:/Windows/Fonts/msgothic.ttc","/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf","/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"})
            if(!candidate.isBlank()&&Files.isRegularFile(Path.of(candidate)))return Path.of(candidate);
        throw new IOException("日本語サンプル用フォントがありません。JAPANESE_FONTを設定してください。");
    }
    private void draw(PDDocument doc,PDType0Font font,boolean revised) throws IOException {
        for(int index=0;index<2;index++) {
            var page=new PDPage(PDRectangle.A4);doc.addPage(page);
            try(var c=new PDPageContentStream(doc,page)) {
                c.setNonStrokingColor(new Color(33,58,51));
                text(c,font,24,45,780,index==0?"御 見 積 書":"お取引条件・特記事項");
                text(c,font,9,400,790,"見積番号  Q-2026-1042");text(c,font,9,400,773,"発行日  2026年10月15日");
                line(c,45,754,550,754);
                if(index==0) {
                    text(c,font,13,45,716,"株式会社 青葉デザイン 御中");text(c,font,10,45,689,"件名：業務システム構築・運用支援");
                    text(c,font,10,385,716,"株式会社 みどりシステムズ");text(c,font,9,385,696,"東京都千代田区丸の内1-2-3");text(c,font,9,385,678,"担当：田中 太郎");
                    c.setNonStrokingColor(new Color(241,246,242));c.addRect(45,593,505,50);c.fill();c.setNonStrokingColor(new Color(33,58,51));
                    text(c,font,11,60,614,"お見積金額（税込）");text(c,font,22,330,611,revised?"￥ 1,375,000":"￥ 1,210,000");
                    String[][] rows={{"品目・内容","数量","単価","金額"},{"要件定義・設計","1式","300,000","300,000"},{"システム開発","1式",revised?"700,000":"600,000",revised?"700,000":"600,000"},{"テスト・品質保証","1式","150,000","150,000"},{"導入・運用サポート","1式",revised?"100,000":"50,000",revised?"100,000":"50,000"},{"小計","","",revised?"1,250,000":"1,100,000"},{"消費税（10%）","","",revised?"125,000":"110,000"}};
                    int y=553;for(String[] row:rows){text(c,font,10,58,y,row[0]);text(c,font,10,310,y,row[1]);text(c,font,10,375,y,row[2]);text(c,font,10,469,y,row[3]);line(c,45,y-14,550,y-14);y-=36;}
                    text(c,font,10,45,254,"納品予定日："+(revised?"2026年12月25日":"2026年12月15日"));
                    text(c,font,10,45,227,"お支払条件：月末締め翌月末払い");text(c,font,10,45,200,"有効期限：発行日より30日間");
                    text(c,font,10,45,145,"備考");text(c,font,9,45,123,"詳細な仕様・お取引条件については、次ページをご確認ください。");
                } else {
                    text(c,font,12,45,709,"1. 業務範囲");text(c,font,10,45,680,"本見積は、要件定義・設計から導入支援までを対象とします。");
                    text(c,font,12,45,622,"2. 保守・サポート");text(c,font,10,45,593,revised?"納品後90日間の無償サポートを含みます。":"納品後30日間の無償サポートを含みます。");
                    text(c,font,12,45,535,"3. 検収について");text(c,font,10,45,506,"納品日から10営業日以内に検収をお願いいたします。");
                    text(c,font,12,45,448,"4. お問い合わせ");text(c,font,10,45,419,"ご不明な点は、担当者までお問い合わせください。");
                }
                line(c,45,68,550,68);text(c,font,8,45,48,"MIDORI SYSTEMS  /  お見積書");text(c,font,8,510,48,(index+1)+" / 2");
            }
        }
    }
    private static void text(PDPageContentStream c,PDType0Font font,int size,int x,int y,String text) throws IOException {c.beginText();c.setFont(font,size);c.newLineAtOffset(x,y);c.showText(text);c.endText();}
    private static void line(PDPageContentStream c,int x,int y,int xx,int yy) throws IOException {c.setStrokingColor(new Color(207,216,209));c.setLineWidth(.6f);c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
}
