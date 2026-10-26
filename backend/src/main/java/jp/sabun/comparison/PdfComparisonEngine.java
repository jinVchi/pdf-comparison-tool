package jp.sabun.comparison;

import com.github.difflib.DiffUtils;
import com.github.difflib.patch.AbstractDelta;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.*;
import java.util.function.IntConsumer;
import static jp.sabun.comparison.ComparisonResult.*;

@Component
class PdfComparisonEngine {
    private final int maxPages;
    private final NumericOcr numericOcr;

    PdfComparisonEngine(int maxPages) {
        this(maxPages, new NumericOcr());
    }

    @Autowired
    PdfComparisonEngine(@Value("${app.max-pages:60}") int maxPages, NumericOcr numericOcr) {
        this.maxPages = maxPages;
        this.numericOcr = numericOcr;
    }

    void validate(Path path) throws IOException {
        try (PDDocument document = Loader.loadPDF(path.toFile())) {
            if (document.isEncrypted())
                throw new IOException("パスワード保護されたPDFは比較できません。");
            if (document.getNumberOfPages() == 0 || document.getNumberOfPages() > maxPages)
                throw new IOException("PDFは1〜" + maxPages + "ページにしてください。");
            for (PDPage page : document.getPages())
                checkSize(page);
        } catch (org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException e) {
            throw new IOException("パスワード保護されたPDFは比較できません。");
        }
    }

    ComparisonResult compare(Path original, Path revised, Path output, String mode, boolean ignoreWhitespace,
            boolean normalizeWidth, IntConsumer progress) throws IOException {
        List<Page> pages = new ArrayList<>();
        List<Change> changes = new ArrayList<>();
        Set<String> warnings = new LinkedHashSet<>();
        try (PDDocument a = Loader.loadPDF(original.toFile()); PDDocument b = Loader.loadPDF(revised.toFile())) {
            int count = Math.max(a.getNumberOfPages(), b.getNumberOfPages());
            PDFRenderer ra = new PDFRenderer(a), rb = new PDFRenderer(b);
            ra.setSubsamplingAllowed(true);
            rb.setSubsamplingAllowed(true);
            for (int i = 0; i < count; i++) {
                boolean hasA = i < a.getNumberOfPages(), hasB = i < b.getNumberOfPages();
                double aw = hasA ? width(a.getPage(i)) : 595, ah = hasA ? height(a.getPage(i)) : 842;
                double bw = hasB ? width(b.getPage(i)) : 595, bh = hasB ? height(b.getPage(i)) : 842;
                pages.add(new Page(i + 1, aw, ah, bw, bh, hasA, hasB));
                BufferedImage ia = hasA ? render(ra, a.getPage(i), i) : null;
                BufferedImage ib = hasB ? render(rb, b.getPage(i), i) : null;
                if (ia != null)
                    ImageIO.write(ia, "png", output.resolve("original-" + (i + 1) + ".png").toFile());
                if (ib != null)
                    ImageIO.write(ib, "png", output.resolve("revised-" + (i + 1) + ".png").toFile());
                if (!hasA || !hasB) {
                    changes.add(new Change("c" + changes.size(), i + 1, hasA ? "DELETED" : "ADDED",
                            hasA ? "ページが削除されました" : "", hasB ? "ページが追加されました" : "", hasA ? new Box(0, 0, 1, 1) : null,
                            hasB ? new Box(0, 0, 1, 1) : null));
                } else {
                    List<Span> sa = mode.equals("visual") ? List.of() : extract(a, i),
                            sb = mode.equals("visual") ? List.of() : extract(b, i);
                    boolean scanned = !mode.equals("visual") && ((sa.isEmpty() && NumericOcr.hasImages(a.getPage(i)))
                            || (sb.isEmpty() && NumericOcr.hasImages(b.getPage(i))));
                    List<Change> numbers = List.of();
                    if (scanned) {
                        warnings.add("画像内の数値はOCRで認識しています。誤認識や未認識の可能性があるため、原本の数値も確認してください。画像内の日本語本文は文字比較の対象外です。");
                        try {
                            numbers = numericOcr.compare(NumericOcr.scan(a.getPage(i), ia), NumericOcr.scan(b.getPage(i), ib), i + 1);
                            for (Change number : numbers)
                                changes.add(new Change("c" + changes.size(), number.page(), number.kind(), number.before(),
                                        number.after(), number.originalBox(), number.revisedBox()));
                        } catch (IOException e) {
                            warnings.add("数値OCRを利用できませんでした。外観を含む比較では、未認識の領域を画像の差分として表示します。");
                        }
                    } else if (!mode.equals("visual"))
                        textChanges(sa, sb, aw, ah, bw, bh, i + 1, ignoreWhitespace, normalizeWidth, changes);
                    if (!mode.equals("text")) {
                        if (mode.equals("mixed") && !scanned)
                            positionChanges(sa, sb, aw, ah, bw, bh, i + 1, ignoreWhitespace, normalizeWidth, changes);
                        visualChanges(ia, ib, i + 1, changes, mode.equals("mixed") && !scanned ? sa : List.of(),
                                mode.equals("mixed") && !scanned ? sb : List.of(), aw, ah, bw, bh, numbers);
                    }
                    if (Math.abs(aw - bw) > 1 || Math.abs(ah - bh) > 1)
                        warnings.add("ページサイズが異なります。プレビューは各ページの比率で表示しています。");
                }
                if (ia != null)
                    ia.flush();
                if (ib != null)
                    ib.flush();
                progress.accept((i + 1) * 100 / count);
            }
        }
        warnings.add("同じページ番号を対応させて比較しています。途中へのページ挿入・並び替えは自動整列されません。");
        return new ComparisonResult(pages, changes, List.copyOf(warnings));
    }

    private static double width(PDPage p) {
        return p.getRotation() % 180 == 0 ? p.getCropBox().getWidth() : p.getCropBox().getHeight();
    }

    private static double height(PDPage p) {
        return p.getRotation() % 180 == 0 ? p.getCropBox().getHeight() : p.getCropBox().getWidth();
    }

    private static void checkSize(PDPage p) throws IOException {
        if (width(p) <= 0 || height(p) <= 0 || width(p) > 2400 || height(p) > 2400)
            throw new IOException("ページサイズが上限を超えています（最大2400pt）。");
    }

    private static BufferedImage render(PDFRenderer r, PDPage p, int index) throws IOException {
        checkSize(p);
        return r.renderImageWithDPI(index, 108);
    }

    private record Span(String text, double x, double y, double w, double h) {
        Box box(double width, double height) {
            return new Box(Math.max(0, x / width), Math.max(0, y / height), Math.min(1, w / width),
                    Math.min(1, h / height));
        }
    }

    private static List<Span> extract(PDDocument doc, int page) throws IOException {
        List<Span> spans = new ArrayList<>();
        PDFTextStripper stripper = new PDFTextStripper() {
            @Override
            protected void writeString(String text, List<TextPosition> positions) {
                StringBuilder current = new StringBuilder();
                List<TextPosition> run = new ArrayList<>();
                TextPosition previous = null;
                for (TextPosition p : positions) {
                    if (previous != null && (Math.abs(p.getY() - previous.getY()) > 3 || p.getX()
                            - (previous.getX() + previous.getWidth()) > Math.max(7, p.getFontSizeInPt() * .8))) {
                        addSpan(spans, current, run);
                        current.setLength(0);
                        run.clear();
                    }
                    current.append(p.getUnicode());
                    run.add(p);
                    previous = p;
                }
                addSpan(spans, current, run);
            }
        };
        stripper.setSortByPosition(true);
        stripper.setStartPage(page + 1);
        stripper.setEndPage(page + 1);
        stripper.getText(doc);
        if (spans.size() > 6000)
            throw new IOException("1ページのテキスト量が上限を超えています。");
        return spans;
    }

    private static void addSpan(List<Span> spans, StringBuilder text, List<TextPosition> positions) {
        if (text.toString().isBlank() || positions.isEmpty())
            return;
        double x = Double.MAX_VALUE, y = Double.MAX_VALUE, right = 0, bottom = 0;
        for (TextPosition p : positions) {
            x = Math.min(x, p.getX());
            y = Math.min(y, p.getY() - p.getHeight() * 1.25);
            right = Math.max(right, p.getX() + p.getWidth());
            bottom = Math.max(bottom, p.getY() + 2);
        }
        spans.add(new Span(text.toString(), x - 1, y - 1, right - x + 3, bottom - y + 2));
    }

    static String normalize(String value, boolean whitespace, boolean width) {
        String s = width ? Normalizer.normalize(value, Normalizer.Form.NFKC) : value;
        return whitespace ? s.replaceAll("[\\s\\u3000]+", "") : s;
    }

    private static void textChanges(List<Span> a, List<Span> b, double aw, double ah, double bw, double bh, int page,
            boolean whitespace, boolean width, List<Change> out) {
        List<String> ta = a.stream().map(s -> normalize(s.text, whitespace, width)).toList();
        List<String> tb = b.stream().map(s -> normalize(s.text, whitespace, width)).toList();
        for (AbstractDelta<String> delta : DiffUtils.diff(ta, tb).getDeltas()) {
            int na = delta.getSource().size(), nb = delta.getTarget().size();
            for (int n = 0; n < Math.max(na, nb); n++) {
                Span sa = n < na ? a.get(delta.getSource().getPosition() + n) : null;
                Span sb = n < nb ? b.get(delta.getTarget().getPosition() + n) : null;
                out.add(new Change("c" + out.size(), page, sa == null ? "ADDED" : sb == null ? "DELETED"
                        : NumericOcr.isNumber(sa.text) && NumericOcr.isNumber(sb.text) ? "NUMERIC" : "MODIFIED",
                        sa == null ? "" : sa.text, sb == null ? "" : sb.text, sa == null ? null : sa.box(aw, ah),
                        sb == null ? null : sb.box(bw, bh)));
            }
        }
    }

    private static void positionChanges(List<Span> a, List<Span> b, double aw, double ah, double bw, double bh,
            int page, boolean whitespace, boolean width, List<Change> out) {
        var ta = a.stream().map(s -> normalize(s.text, whitespace, width)).toList();
        var tb = b.stream().map(s -> normalize(s.text, whitespace, width)).toList();
        int ai = 0, bi = 0;
        var deltas = DiffUtils.diff(ta, tb).getDeltas();
        for (int d = 0; d <= deltas.size(); d++) {
            int end = d < deltas.size() ? deltas.get(d).getSource().getPosition() : a.size();
            while (ai < end && bi < b.size()) {
                Span sa = a.get(ai++), sb = b.get(bi++);
                if (Math.abs(sa.x / aw - sb.x / bw) > .006 || Math.abs(sa.y / ah - sb.y / bh) > .006)
                    out.add(new Change("c" + out.size(), page, "VISUAL", sa.text + "（元の位置）", sb.text + "（位置が変更）",
                            sa.box(aw, ah), sb.box(bw, bh)));
            }
            if (d < deltas.size()) {
                var delta = deltas.get(d);
                ai = delta.getSource().getPosition() + delta.getSource().size();
                bi = delta.getTarget().getPosition() + delta.getTarget().size();
            }
        }
    }

    private static void mask(boolean[] pixels, int imageWidth, int imageHeight, List<Span> spans, double width,
            double height) {
        for (Span s : spans) {
            int left = Math.max(0, (int) ((s.x - 3) / width * imageWidth)),
                    right = Math.min(imageWidth, (int) Math.ceil((s.x + s.w + 3) / width * imageWidth));
            int top = Math.max(0, (int) ((s.y - 3) / height * imageHeight)),
                    bottom = Math.min(imageHeight, (int) Math.ceil((s.y + s.h + 3) / height * imageHeight));
            if (left >= right)
                continue;
            for (int y = top; y < bottom; y++)
                Arrays.fill(pixels, y * imageWidth + left, y * imageWidth + right, true);
        }
    }

    private static void visualChanges(BufferedImage a, BufferedImage b, int page, List<Change> out, List<Span> sa,
            List<Span> sb, double aw, double ah, double bw, double bh, List<Change> numbers) {
        int w = Math.max(a.getWidth(), b.getWidth()), h = Math.max(a.getHeight(), b.getHeight()), tile = 16;
        int cols = (w + tile - 1) / tile, rows = (h + tile - 1) / tile;
        boolean[][] changed = new boolean[rows][cols];
        boolean[] ignored = new boolean[w * h];
        mask(ignored, w, h, sa, aw, ah);
        mask(ignored, w, h, sb, bw, bh);
        for (Change number : numbers) {
            maskBox(ignored, w, h, number.originalBox());
            maskBox(ignored, w, h, number.revisedBox());
        }
        for (int gy = 0; gy < rows; gy++)
            for (int gx = 0; gx < cols; gx++) {
                int differences = 0;
                for (int y = gy * tile; y < Math.min(h, (gy + 1) * tile); y += 2)
                    for (int x = gx * tile; x < Math.min(w, (gx + 1) * tile); x += 2) {
                        double nx = (double) x / w, ny = (double) y / h;
                        if (ignored[y * w + x])
                            continue;
                        int ca = a.getRGB(Math.min(a.getWidth() - 1, (int) (nx * a.getWidth())),
                                Math.min(a.getHeight() - 1, (int) (ny * a.getHeight())));
                        int cb = b.getRGB(Math.min(b.getWidth() - 1, (int) (nx * b.getWidth())),
                                Math.min(b.getHeight() - 1, (int) (ny * b.getHeight())));
                        int d = Math.abs(((ca >> 16) & 255) - ((cb >> 16) & 255))
                                + Math.abs(((ca >> 8) & 255) - ((cb >> 8) & 255)) + Math.abs((ca & 255) - (cb & 255));
                        if (d > 120)
                            differences++;
                    }
                changed[gy][gx] = differences >= 2;
            }
        for (int gy = 0; gy < rows; gy++)
            for (int gx = 0; gx < cols; gx++)
                if (changed[gy][gx]) {
                    int minX = gx, maxX = gx, minY = gy, maxY = gy;
                    ArrayDeque<int[]> todo = new ArrayDeque<>();
                    todo.add(new int[] { gx, gy });
                    changed[gy][gx] = false;
                    while (!todo.isEmpty()) {
                        int[] p = todo.remove();
                        minX = Math.min(minX, p[0]);
                        maxX = Math.max(maxX, p[0]);
                        minY = Math.min(minY, p[1]);
                        maxY = Math.max(maxY, p[1]);
                        for (int dy = -1; dy <= 1; dy++)
                            for (int dx = -1; dx <= 1; dx++) {
                                int xx = p[0] + dx, yy = p[1] + dy;
                                if (xx >= 0 && xx < cols && yy >= 0 && yy < rows && changed[yy][xx]) {
                                    changed[yy][xx] = false;
                                    todo.add(new int[] { xx, yy });
                                }
                            }
                    }
                    Box box = new Box((double) minX * tile / w, (double) minY * tile / h,
                            Math.min(1, (double) (maxX - minX + 1) * tile / w),
                            Math.min(1, (double) (maxY - minY + 1) * tile / h));
                    out.add(new Change("c" + out.size(), page, "VISUAL", "画像上の差分（変更前）", "画像上の差分（変更後）", box, box));
                    if (out.size() > 10000)
                        throw new IllegalArgumentException("差分が多すぎます。比較範囲を小さくしてください。");
                }
    }

    private static void maskBox(boolean[] mask, int w, int h, Box box) {
        if (box == null) return;
        int left = Math.max(0, (int) Math.floor(box.x() * w) - 1);
        int right = Math.min(w, (int) Math.ceil((box.x() + box.width()) * w) + 1);
        int top = Math.max(0, (int) Math.floor(box.y() * h) - 1);
        int bottom = Math.min(h, (int) Math.ceil((box.y() + box.height()) * h) + 1);
        for (int y = top; y < bottom; y++) Arrays.fill(mask, y * w + left, y * w + right, true);
    }
}
