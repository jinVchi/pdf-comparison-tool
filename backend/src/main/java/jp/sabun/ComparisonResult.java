package jp.sabun;

import java.util.List;

public record ComparisonResult(List<Page> pages, List<Change> changes, List<String> warnings) {
    public record Box(double x, double y, double width, double height) {}
    public record Page(int number, double originalWidth, double originalHeight, double revisedWidth, double revisedHeight, boolean originalExists, boolean revisedExists) {}
    public record Change(String id, int page, String kind, String before, String after, Box originalBox, Box revisedBox) {}
}
