package jp.sabun.comparison;

import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.encryption.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.awt.Color;
import java.awt.Font;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.List;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;

class PdfComparisonEngineTest {
    @TempDir
    Path temp;
    private final PdfComparisonEngine engine = new PdfComparisonEngine(60);

    private Path pdf(String name, String text, boolean stamp, int pageCount) throws Exception {
        Path path = temp.resolve(name);
        try (var doc = new PDDocument()) {
            for (int i = 0; i < pageCount; i++) {
                var page = new PDPage(PDRectangle.A4);
                doc.addPage(page);
                try (var content = new PDPageContentStream(doc, page)) {
                    if (!text.isEmpty()) {
                        content.beginText();
                        content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                        content.newLineAtOffset(50, 700);
                        content.showText(text);
                        content.endText();
                    }
                    if (stamp) {
                        content.setNonStrokingColor(Color.RED);
                        content.addRect(300, 400, 45, 35);
                        content.fill();
                    }
                }
            }
            doc.save(path.toFile());
        }
        return path;
    }

    private ComparisonResult compare(Path a, Path b, String mode) throws Exception {
        return engine.compare(a, b, temp, mode, true, false, p -> {
        });
    }

    @Test
    void identicalDocumentsHaveNoChanges() throws Exception {
        Path a = pdf("a.pdf", "Amount 1,000", false, 1);
        assertThat(compare(a, a, "mixed").changes()).isEmpty();
        assertThat(temp.resolve("original-1.png")).exists();
    }

    @Test
    void numericValuesAreNotClassifiedAsLayoutChanges() throws Exception {
        var result = compare(pdf("number-a.pdf", "83", false, 1), pdf("number-b.pdf", "84", false, 1), "mixed");
        assertThat(result.changes()).singleElement().satisfies(change -> {
            assertThat(change.kind()).isEqualTo("NUMERIC");
            assertThat(change.before()).isEqualTo("83");
            assertThat(change.after()).isEqualTo("84");
        });
    }

    private Path scanned(String name, String value, boolean stamp) throws Exception {
        var image = new BufferedImage(595, 842, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        graphics.setColor(Color.WHITE);
        graphics.fillRect(0, 0, 595, 842);
        graphics.setColor(Color.BLACK);
        graphics.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 24));
        graphics.drawString(value, 50, 100);
        if (stamp) {
            graphics.setColor(Color.RED);
            graphics.fillRect(300, 400, 45, 35);
        }
        graphics.dispose();
        Path path = temp.resolve(name);
        try (var document = new PDDocument()) {
            var page = new PDPage(new PDRectangle(595, 842));
            document.addPage(page);
            try (var content = new PDPageContentStream(document, page)) {
                content.drawImage(LosslessFactory.createFromImage(document, image), 0, 0, 595, 842);
            }
            document.save(path.toFile());
        }
        return path;
    }

    @Test
    void imageOnlyNumbersBecomeNumericChangesWithoutDuplicateVisualHighlights() throws Exception {
        var ocr = new NumericOcr() {
            @Override List<String> recognize(List<BufferedImage> crops) {
                assertThat(crops).hasSize(2);
                return List.of("83", "84");
            }
        };
        var result = new PdfComparisonEngine(60, ocr).compare(scanned("a.pdf", "83", false),
                scanned("b.pdf", "84", true), temp, "mixed", true, false, p -> {});
        assertThat(result.changes()).extracting(ComparisonResult.Change::kind)
                .containsExactlyInAnyOrder("NUMERIC", "VISUAL");
        var number = result.changes().stream().filter(c -> c.kind().equals("NUMERIC")).findFirst().orElseThrow();
        assertThat(number.before()).isEqualTo("83");
        assertThat(number.after()).isEqualTo("84");
        assertThat(number.originalBox().x()).isBetween(.07, .1);
        assertThat(number.revisedBox().y()).isBetween(.09, .13);
        assertThat(result.warnings()).anyMatch(w -> w.contains("OCR"));
    }

    @Test
    void unavailableOcrKeepsVisualDifferencesAndExplainsTheFallback() throws Exception {
        var ocr = new NumericOcr() {
            @Override List<String> recognize(List<BufferedImage> crops) throws IOException {
                throw new IOException("not installed");
            }
        };
        var result = new PdfComparisonEngine(60, ocr).compare(scanned("a.pdf", "83", false),
                scanned("b.pdf", "84", false), temp, "mixed", true, false, p -> {});
        assertThat(result.changes()).isNotEmpty().allMatch(c -> c.kind().equals("VISUAL"));
        assertThat(result.warnings()).anyMatch(w -> w.contains("数値OCRを利用できません"));
    }

    @Test
    void visualOnlyModeDoesNotRunOcrAndIdenticalScansHaveNoChanges() throws Exception {
        var ocr = new NumericOcr() {
            @Override List<String> recognize(List<BufferedImage> crops) { throw new AssertionError("OCR must not run"); }
        };
        var comparing = new PdfComparisonEngine(60, ocr);
        Path a = scanned("a.pdf", "83", false), b = scanned("b.pdf", "84", false);
        assertThat(comparing.compare(a, b, temp, "visual", true, false, p -> {}).changes())
                .isNotEmpty().allMatch(c -> c.kind().equals("VISUAL"));
        assertThat(comparing.compare(a, a, temp, "mixed", true, false, p -> {}).changes()).isEmpty();
    }

    @Test
    void unrecognizedScannedWordsRemainVisualChanges() throws Exception {
        var ocr = new NumericOcr() {
            @Override List<String> recognize(List<BufferedImage> crops) { return List.of("ABC", "DEF"); }
        };
        var result = new PdfComparisonEngine(60, ocr).compare(scanned("a.pdf", "83", false),
                scanned("b.pdf", "84", false), temp, "mixed", true, false, p -> {});
        assertThat(result.changes()).isNotEmpty().allMatch(c -> c.kind().equals("VISUAL"));
    }

    @Test
    void numberSyntaxPreservesSignsGroupingAndDecimalsWithoutAcceptingDates() throws Exception {
        assertThat(NumericOcr.isNumber("-127,728")).isTrue();
        assertThat(NumericOcr.isNumber("１２３.４５")).isTrue();
        assertThat(NumericOcr.isNumber("12.5%")).isTrue();
        assertThat(NumericOcr.isNumber("09/04")).isFalse();
        assertThat(NumericOcr.isNumber("045-04")).isFalse();
        assertThat(NumericOcr.isNumber("Amount 1,000")).isFalse();
        assertThat(NumericOcr.parse(List.of("5\t1\t1\t1\t1\t1\t0\t0\t20\t10\t90\t-127,728"), 2))
                .containsExactly("-127,728", "");
        assertThatThrownBy(() -> NumericOcr.parse(List.of("5\t9\t1\t1\t1\t1\t0\t0\t20\t10\t90\t83"), 2))
                .isInstanceOf(IOException.class);
    }

    @Test
    void amountChangesHaveAccuratePageAndBoxes() throws Exception {
        var result = compare(pdf("a.pdf", "Amount 1,000", false, 1), pdf("b.pdf", "Amount 1,200", false, 1), "text");
        assertThat(result.changes()).hasSize(1);
        var change = result.changes().getFirst();
        assertThat(change.kind()).isEqualTo("MODIFIED");
        assertThat(change.before()).isEqualTo("Amount 1,000");
        assertThat(change.after()).isEqualTo("Amount 1,200");
        assertThat(change.page()).isEqualTo(1);
        assertThat(change.originalBox().x()).isBetween(.08, .09);
        assertThat(change.originalBox().y()).isBetween(.14, .18);
        assertThat(change.originalBox().width()).isBetween(.10, .18);
    }

    @Test
    void stampChangesAreDetectedWithoutExtractableText() throws Exception {
        var result = compare(pdf("a.pdf", "", false, 1), pdf("b.pdf", "", true, 1), "visual");
        assertThat(result.changes()).hasSize(1);
        assertThat(result.changes().getFirst().kind()).isEqualTo("VISUAL");
        assertThat(result.changes().getFirst().revisedBox().x()).isBetween(.48, .52);
    }

    @Test
    void mixedModeDoesNotLoseNonTextChanges() throws Exception {
        var result = compare(pdf("a.pdf", "Amount 1,000", false, 1), pdf("b.pdf", "Amount 1,200", true, 1), "mixed");
        assertThat(result.changes()).extracting(ComparisonResult.Change::kind).containsExactlyInAnyOrder("MODIFIED",
                "VISUAL");
    }

    @Test
    void extraPagesHaveOnlyTheirPresentSideHighlighted() throws Exception {
        var result = compare(pdf("a.pdf", "Test", false, 1), pdf("b.pdf", "Test", false, 2), "text");
        assertThat(result.pages()).hasSize(2);
        var c = result.changes().getFirst();
        assertThat(c.kind()).isEqualTo("ADDED");
        assertThat(c.originalBox()).isNull();
        assertThat(c.page()).isEqualTo(2);
    }

    @Test
    void removedTextIsADeletion() throws Exception {
        var result = compare(pdf("a.pdf", "Removed", false, 1), pdf("b.pdf", "", false, 1), "text");
        assertThat(result.changes()).hasSize(1);
        assertThat(result.changes().getFirst().kind()).isEqualTo("DELETED");
    }

    @Test
    void japaneseNormalizationIsOptInAndPreservesKanji() {
        assertThat(PdfComparisonEngine.normalize("合計　１２３ カタカナ", true, false)).isEqualTo("合計１２３カタカナ");
        assertThat(PdfComparisonEngine.normalize("合計　１２３ ｶﾀｶﾅ", true, true)).isEqualTo("合計123カタカナ");
        assertThat(PdfComparisonEngine.normalize("A B", false, false)).isEqualTo("A B");
    }

    @Test
    void encryptedFilesAreRejected() throws Exception {
        Path path = pdf("encrypted.pdf", "Private", false, 1);
        try (var doc = org.apache.pdfbox.Loader.loadPDF(path.toFile())) {
            doc.protect(new StandardProtectionPolicy("owner", "password", new AccessPermission()));
            doc.save(temp.resolve("protected.pdf").toFile());
        }
        assertThatThrownBy(() -> engine.validate(temp.resolve("protected.pdf")))
                .isInstanceOf(java.io.IOException.class);
    }

    @Test
    void pageLimitIsEnforced() throws Exception {
        Path path = pdf("pages.pdf", "", false, 2);
        assertThatThrownBy(() -> new PdfComparisonEngine(1).validate(path)).hasMessageContaining("1ページ");
    }

    @Test
    void csvCellsCannotBecomeSpreadsheetFormulas() {
        assertThat(ComparisonController.cell("=HYPERLINK(\"x\")\nnext")).startsWith("\"'=");
        assertThat(ComparisonController.cell("  +1")).startsWith("\"'  +");
        assertThat(ComparisonController.cell("通常の文字")).isEqualTo("\"通常の文字\"");
    }

    @Test
    void movedTextProducesLayoutDifferenceInMixedMode() throws Exception {
        Path a = pdf("a.pdf", "Unchanged wording", false, 1), b = temp.resolve("b.pdf");
        try (var doc = new PDDocument()) {
            var page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            try (var c = new PDPageContentStream(doc, page)) {
                c.beginText();
                c.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                c.newLineAtOffset(90, 650);
                c.showText("Unchanged wording");
                c.endText();
            }
            doc.save(b.toFile());
        }
        var result = compare(a, b, "mixed");
        assertThat(result.changes()).hasSize(1);
        assertThat(result.changes().getFirst().kind()).isEqualTo("VISUAL");
        assertThat(result.changes().getFirst().revisedBox().x())
                .isGreaterThan(result.changes().getFirst().originalBox().x());
    }

    @Test
    void denseTablesKeepChangesInTheirOwnCells() throws Exception {
        Path a = temp.resolve("dense-a.pdf"), b = temp.resolve("dense-b.pdf");
        for (int v = 0; v < 2; v++)
            try (var doc = new PDDocument()) {
                var page = new PDPage(PDRectangle.A4);
                doc.addPage(page);
                try (var c = new PDPageContentStream(doc, page)) {
                    var font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
                    for (int row = 0; row < 90; row++)
                        for (int col = 0; col < 8; col++) {
                            c.beginText();
                            c.setFont(font, 5);
                            c.newLineAtOffset(25 + col * 68, 810 - row * 8);
                            c.showText(
                                    row == 45 && col == 4 && v == 1 ? "REVISED" : String.format("%03d-%02d", row, col));
                            c.endText();
                        }
                }
                doc.save((v == 0 ? a : b).toFile());
            }
        var result = compare(a, b, "mixed");
        assertThat(result.changes()).hasSize(1);
        assertThat(result.changes().getFirst().before()).isEqualTo("045-04");
        assertThat(result.changes().getFirst().after()).isEqualTo("REVISED");
        assertThat(result.changes().getFirst().revisedBox().width()).isLessThan(.1);
    }
}
