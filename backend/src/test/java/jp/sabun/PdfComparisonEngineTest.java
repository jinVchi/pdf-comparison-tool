package jp.sabun;

import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.encryption.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.awt.Color;
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
