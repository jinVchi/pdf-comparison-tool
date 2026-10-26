package jp.sabun.comparison;

import org.apache.pdfbox.contentstream.PDFGraphicsStreamEngine;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.graphics.image.PDImage;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.RenderingHints;
import java.awt.geom.Point2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.text.Normalizer;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import static jp.sabun.comparison.ComparisonResult.*;

/** Local, bounded OCR for printed numbers; never changes the source PDF. */
@Component
class NumericOcr {
    private static final Pattern NUMBER = Pattern.compile("[+-]?(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\\.[0-9]+)?%?");
    private static final int MAX_REGIONS = 250, MAX_PIXELS = 4_000_000;
    private final boolean enabled;
    private final String command;
    private final int timeout;

    NumericOcr() { this(true, "tesseract", 45); }

    @Autowired
    NumericOcr(@Value("${app.numeric-ocr.enabled:true}") boolean enabled,
            @Value("${app.numeric-ocr.command:tesseract}") String command,
            @Value("${app.numeric-ocr.timeout-seconds:45}") int timeout) {
        this.enabled = enabled;
        this.command = command;
        this.timeout = Math.max(1, Math.min(120, timeout));
    }

    static boolean isNumber(String text) {
        return NUMBER.matcher(Normalizer.normalize(text, Normalizer.Form.NFKC).strip()).matches();
    }

    static boolean hasImages(PDPage page) throws IOException {
        return hasImages(page.getResources(), new HashSet<>(), 0);
    }

    private static boolean hasImages(org.apache.pdfbox.pdmodel.PDResources resources, Set<Object> seen, int depth) throws IOException {
        if (resources == null || depth > 8 || !seen.add(resources.getCOSObject())) return false;
        for (COSName name : resources.getXObjectNames()) {
            var object = resources.getXObject(name);
            if (object instanceof PDImageXObject) return true;
            if (object instanceof PDFormXObject form && hasImages(form.getResources(), seen, depth + 1)) return true;
        }
        return false;
    }

    /** Avoid a second resampling of low-DPI full-page scans. Other PDFs use the rendered page. */
    static BufferedImage scan(PDPage page, BufferedImage rendered) throws IOException {
        if (page.getRotation() != 0) return rendered;
        var extractor = new FullPageImage(page);
        extractor.processPage(page);
        return extractor.count == 1 && extractor.image != null ? extractor.image.getImage() : rendered;
    }

    List<Change> compare(BufferedImage a, BufferedImage b, int page) throws IOException {
        if (!enabled) throw new IOException("数値OCRが無効です。");
        if (a.getWidth() != b.getWidth() || a.getHeight() != b.getHeight())
            throw new IOException("画像サイズが異なるため数値OCRを適用できません。");
        if ((long) a.getWidth() * a.getHeight() > MAX_PIXELS)
            throw new IOException("数値OCRの画像サイズ上限を超えています。");
        Raster ra = new Raster(a), rb = new Raster(b);
        List<Region> wa = ra.words(), wb = rb.words(), regions = new ArrayList<>();
        for (Region left : wa) {
            List<Region> matches = wb.stream().filter(right -> Math.abs(left.cy() - right.cy()) < 3
                    && Math.min(left.right, right.right) > Math.max(left.left, right.left)).toList();
            if (matches.size() != 1) continue;
            Region region = left.union(matches.getFirst()).pad(2, ra.w, ra.h);
            int different = 0;
            for (int y = region.top; y < region.bottom; y++)
                for (int x = region.left; x < region.right; x++)
                    if (Math.abs(ra.gray[y * ra.w + x] - rb.gray[y * rb.w + x]) > 60) different++;
            if (different < 12) continue;
            // A comma can split a projection run. Merge overlaps before recognition.
            for (int n = regions.size() - 1; n >= 0; n--) {
                Region previous = regions.get(n);
                if (Math.abs(previous.cy() - region.cy()) < 3
                        && Math.min(previous.right, region.right) > Math.max(previous.left, region.left)) {
                    region = region.union(previous);
                    regions.remove(n);
                }
            }
            regions.add(region);
        }
        if (regions.size() > MAX_REGIONS) throw new IOException("1ページの数値OCR領域数が上限を超えています。");
        regions.sort(Comparator.comparingInt(Region::top).thenComparingInt(Region::left));
        if (regions.isEmpty()) return List.of();
        List<BufferedImage> crops = new ArrayList<>();
        List<List<Glyph>> glyphs = new ArrayList<>();
        for (Region region : regions) for (Raster raster : List.of(ra, rb)) {
            crops.add(raster.crop(region));
            glyphs.add(raster.glyphs(region));
        }
        List<String> readings = recognize(crops);
        if (readings.size() != crops.size()) throw new IOException("数値OCRの結果が不完全です。");
        // Tesseract can confuse small 3/8/9 glyphs. Learn the repeated digit shapes
        // from this page's own readings, then cross-check each glyph. No fixture,
        // installed font, expected amount, or accounting formula is consulted.
        Templates templates = new Templates(regions, glyphs, readings);
        List<Change> changes = new ArrayList<>();
        for (int i = 0; i < regions.size(); i++) {
            Region region = regions.get(i);
            String before = templates.read(region, glyphs.get(i * 2), readings.get(i * 2));
            String after = templates.read(region, glyphs.get(i * 2 + 1), readings.get(i * 2 + 1));
            if (!isNumber(before) || !isNumber(after) || before.equals(after)) continue;
            Box box = region.box(ra.w, ra.h);
            changes.add(new Change("", page, "NUMERIC", before, after, box, box));
        }
        return changes;
    }

    /** One isolated input image per value, processed in a single bounded process. */
    List<String> recognize(List<BufferedImage> crops) throws IOException {
        Path temp = Files.createTempDirectory("sabun-numeric-ocr-");
        Process process = null;
        try {
            List<String> files = new ArrayList<>();
            for (int i = 0; i < crops.size(); i++) {
                Path path = temp.resolve("number-" + i + ".png");
                ImageIO.write(crops.get(i), "png", path.toFile());
                files.add(path.toAbsolutePath().toString());
            }
            Path inputs = temp.resolve("images.txt"), output = temp.resolve("result");
            Files.write(inputs, files, StandardCharsets.UTF_8);
            ProcessBuilder builder = new ProcessBuilder(command, inputs.toString(), output.toString(),
                    "-l", "eng", "--psm", "7", "--dpi", "200", "-c", "tessedit_char_whitelist=0123456789,.-",
                    "-c", "tessedit_create_tsv=1");
            builder.environment().put("OMP_THREAD_LIMIT", "1");
            builder.redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD);
            process = builder.start();
            if (!process.waitFor(timeout, TimeUnit.SECONDS)) throw new IOException("数値OCRがタイムアウトしました。");
            if (process.exitValue() != 0) throw new IOException("数値OCRを実行できませんでした。");
            Path tsv = temp.resolve("result.tsv");
            if (!Files.exists(tsv) || Files.size(tsv) > 2_000_000) throw new IOException("数値OCRの出力が不正です。");
            return parse(Files.readAllLines(tsv, StandardCharsets.UTF_8), crops.size());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("数値OCRが中断されました。", e);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
                try { process.waitFor(5, TimeUnit.SECONDS); }
                catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }
            try (var paths = Files.walk(temp)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }

    static List<String> parse(List<String> lines, int size) throws IOException {
        List<StringBuilder> values = new ArrayList<>();
        for (int i = 0; i < size; i++) values.add(new StringBuilder());
        try {
            for (String line : lines) {
                String[] fields = line.split("\\t", 12);
                if (fields.length < 12 || !fields[0].equals("5")) continue;
                int page = Integer.parseInt(fields[1]) - 1;
                if (page < 0 || page >= size) throw new NumberFormatException();
                values.get(page).append(fields[11].strip());
            }
        } catch (NumberFormatException e) { throw new IOException("数値OCRのページ情報が不正です。", e); }
        return values.stream().map(StringBuilder::toString).toList();
    }

    private record Region(int left, int top, int right, int bottom) {
        int width() { return right - left; }
        int height() { return bottom - top; }
        double cy() { return (top + bottom) / 2.; }
        Region union(Region b) { return new Region(Math.min(left,b.left),Math.min(top,b.top),Math.max(right,b.right),Math.max(bottom,b.bottom)); }
        Region pad(int p,int w,int h) { return new Region(Math.max(0,left-p),Math.max(0,top-p),Math.min(w,right+p),Math.min(h,bottom+p)); }
        Box box(int w,int h) { return new Box((double)left/w,(double)top/h,(double)width()/w,(double)height()/h); }
    }

    private static final class Raster {
        final int w, h;
        final int[] gray;
        final boolean[] ink;
        Raster(BufferedImage image) {
            w=image.getWidth(); h=image.getHeight(); gray=new int[w*h]; ink=new boolean[w*h];
            boolean raw = image.getRaster().getNumBands()==1 && image.getColorModel().getPixelSize()==8
                    && image.getColorModel().getColorSpace().getType()==java.awt.color.ColorSpace.TYPE_GRAY;
            for(int y=0;y<h;y++) for(int x=0;x<w;x++) {
                int rgb=image.getRGB(x,y);
                int value=raw?image.getRaster().getSample(x,y,0):(((rgb>>16)&255)+((rgb>>8)&255)+(rgb&255))/3;
                gray[y*w+x]=value; ink[y*w+x]=value<150;
            }
            // Find rules using a lighter threshold than text, including antialiased edges.
            for(int y=0;y<h;y++) {
                int start=-1;
                for(int x=0;x<=w;x++) {
                    if(x<w && gray[y*w+x]<220) { if(start<0) start=x; }
                    else if(start>=0) {
                        if(x-start>Math.max(50,w/20))
                            for(int yy=Math.max(0,y-1);yy<Math.min(h,y+2);yy++) Arrays.fill(ink,yy*w+start,yy*w+x,false);
                        start=-1;
                    }
                }
            }
            for(int x=0;x<w;x++) {
                int start=-1;
                for(int y=0;y<=h;y++) {
                    if(y<h && gray[y*w+x]<220) { if(start<0) start=y; }
                    else if(start>=0) {
                        if(y-start>Math.max(40,h/30))
                            for(int yy=start;yy<y;yy++) for(int xx=Math.max(0,x-1);xx<Math.min(w,x+2);xx++) ink[yy*w+xx]=false;
                        start=-1;
                    }
                }
            }
        }
        List<Region> words() {
            List<Region> words=new ArrayList<>();
            int start=-1,last=-1;
            for(int y=0;y<=h+2;y++) {
                boolean any=false;
                if(y<h) for(int x=0;x<w&&!any;x++) any=ink[y*w+x];
                if(any) { if(start<0) start=y; last=y; }
                else if(start>=0 && y-last>2) {
                    if(last+1-start>=4 && last+1-start<=35) line(words,start,last+1);
                    start=-1;
                }
            }
            return words;
        }
        void line(List<Region> out,int top,int bottom) {
            // Remove two-dot colons so a Japanese label cannot become a spurious digit.
            for(Region r:runs(top,bottom,0)) if(r.width()<=3) {
                int groups=0,count=0; boolean previous=false;
                for(int y=top;y<bottom;y++) {
                    boolean any=false;
                    for(int x=r.left;x<r.right;x++) any|=ink[y*w+x];
                    if(any) { count++; if(!previous) groups++; }
                    previous=any;
                }
                if(groups==2 && count<=Math.max(4,(bottom-top)*.5))
                    for(int y=top;y<bottom;y++) Arrays.fill(ink,y*w+r.left,y*w+r.right,false);
            }
            out.addAll(runs(top,bottom,Math.max(5,(int)((bottom-top)*.55))));
        }
        List<Region> runs(int top,int bottom,int gap) {
            List<Region> out=new ArrayList<>(); int start=-1,last=-1;
            for(int x=0;x<=w+gap;x++) {
                boolean any=false;
                if(x<w) for(int y=top;y<bottom&&!any;y++) any=ink[y*w+x];
                if(any) { if(start<0) start=x; last=x; }
                else if(start>=0 && x-last>gap) { out.add(new Region(start,top,last+1,bottom)); start=-1; }
            }
            return out;
        }
        List<Glyph> glyphs(Region region) {
            List<Glyph> out=new ArrayList<>(); int start=-1;
            for(int x=region.left;x<=region.right;x++) {
                boolean any=false;
                if(x<region.right) for(int y=region.top;y<region.bottom&&!any;y++) any=gray[y*w+x]<150;
                if(any && start<0) start=x;
                if(!any && start>=0) {
                    int top=region.bottom,bottom=region.top;
                    for(int xx=start;xx<x;xx++) for(int y=region.top;y<region.bottom;y++) if(gray[y*w+xx]<150) {
                        top=Math.min(top,y); bottom=Math.max(bottom,y+1);
                    }
                    out.add(new Glyph(this,new Region(start,top,x,bottom))); start=-1;
                }
            }
            return out;
        }
        BufferedImage crop(Region region) {
            var source=new BufferedImage(region.width(),region.height(),BufferedImage.TYPE_BYTE_GRAY);
            for(int y=0;y<region.height();y++) for(int x=0;x<region.width();x++) source.getRaster().setSample(x,y,0,gray[(region.top+y)*w+region.left+x]);
            double scale=20./Math.max(4,region.height()-4);
            int cw=(int)Math.round(region.width()*scale),ch=(int)Math.round(region.height()*scale);
            var image=new BufferedImage(cw+30,ch+30,BufferedImage.TYPE_BYTE_GRAY);
            var g=image.createGraphics(); g.setColor(java.awt.Color.WHITE); g.fillRect(0,0,image.getWidth(),image.getHeight());
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.drawImage(source,15,15,cw,ch,null); g.dispose(); return image;
        }
    }

    private static final class Glyph {
        final Region bounds;
        final double[] pixels=new double[12*18];
        Glyph(Raster source,Region r) {
            bounds=r;
            var original=new BufferedImage(r.width(),r.height(),BufferedImage.TYPE_BYTE_GRAY);
            for(int y=0;y<r.height();y++) for(int x=0;x<r.width();x++) original.getRaster().setSample(x,y,0,source.gray[(r.top+y)*source.w+r.left+x]<150?255:0);
            var image=new BufferedImage(12,18,BufferedImage.TYPE_BYTE_GRAY);
            var g=image.createGraphics();g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(original,0,0,12,18,null);g.dispose();
            for(int y=0;y<18;y++) for(int x=0;x<12;x++) pixels[y*12+x]=image.getRaster().getSample(x,y,0)/255.;
        }
    }

    private record FontDigit(int height,char digit) {}
    private static final class Templates {
        final Map<FontDigit,double[]> medians=new HashMap<>();
        Templates(List<Region> regions,List<List<Glyph>> glyphs,List<String> readings) {
            Map<FontDigit,List<double[]>> samples=new HashMap<>();
            for(int i=0;i<readings.size();i++) {
                String text=readings.get(i);var gs=glyphs.get(i);
                if(!isNumber(text) || gs.size()!=text.length()) continue;
                int height=regions.get(i/2).height()-4;
                for(int n=0;n<gs.size();n++) if(Character.isDigit(text.charAt(n)) && gs.get(n).bounds.height()>=5)
                    samples.computeIfAbsent(new FontDigit(height,text.charAt(n)),k->new ArrayList<>()).add(gs.get(n).pixels);
            }
            for(var entry:samples.entrySet()) {
                if(entry.getValue().size()<2) continue;
                double[] median=new double[216];
                for(int n=0;n<216;n++) {
                    final int pixel=n;
                    double[] values=entry.getValue().stream().mapToDouble(v->v[pixel]).sorted().toArray();
                    median[n]=(values[(values.length-1)/2]+values[values.length/2])/2;
                }
                medians.put(entry.getKey(),median);
            }
        }
        String read(Region region,List<Glyph> glyphs,String original) {
            if(glyphs.isEmpty()) return original;
            StringBuilder text=new StringBuilder();
            int height=region.height()-4;
            // A small sample such as 83 -> 84 cannot teach the shapes of 3 and 4.
            // Adapt only when all ten digits have repeated examples in this font.
            if(medians.keySet().stream().filter(k->k.height()==height).count()!=10) return original;
            if(!original.matches("[0-9,.-]+")) return "";
            for(int n=0;n<glyphs.size();n++) {
                Glyph glyph=glyphs.get(n);
                if(glyph.bounds.height()<5) {
                    // A comma has a descender; OCR often calls it a decimal dot.
                    char punctuation=glyph.bounds.width()>=4?'-'
                            :glyph.bounds.height()<=Math.max(1,Math.round(height*.18))?'.':',';
                    text.append(punctuation);continue;
                }
                char best='?';double distance=Double.MAX_VALUE,second=Double.MAX_VALUE;
                for(var entry:medians.entrySet()) {
                    if(entry.getKey().height()!=height) continue;
                    double d=0;
                    for(int p=0;p<216;p++) d+=Math.abs(glyph.pixels[p]-entry.getValue()[p])/216;
                    if(d<distance) {second=distance;distance=d;best=entry.getKey().digit();}
                    else second=Math.min(second,d);
                }
                // Ambiguous / unfamiliar fonts remain OCR readings or visual changes.
                if(distance>.22 || second-distance<.015) {
                    if(original.length()!=glyphs.size()) return "";
                    best=original.charAt(n);
                }
                text.append(best);
            }
            return text.toString();
        }
    }

    private static final class FullPageImage extends PDFGraphicsStreamEngine {
        int count; PDImage image;
        FullPageImage(PDPage page) { super(page); }
        @Override public void drawImage(PDImage candidate) {
            count++;
            var m=getGraphicsState().getCurrentTransformationMatrix();var crop=getPage().getCropBox();
            if(Math.abs(m.getScaleX()-crop.getWidth())<1 && Math.abs(m.getScaleY()-crop.getHeight())<1
                    && Math.abs(m.getShearX())<.01 && Math.abs(m.getShearY())<.01
                    && Math.abs(m.getTranslateX()-crop.getLowerLeftX())<1 && Math.abs(m.getTranslateY()-crop.getLowerLeftY())<1
                    && (long)candidate.getWidth()*candidate.getHeight()<=MAX_PIXELS) image=candidate;
        }
        @Override public void appendRectangle(Point2D a,Point2D b,Point2D c,Point2D d) {}
        @Override public void clip(int windingRule) {}
        @Override public void moveTo(float x,float y) {}
        @Override public void lineTo(float x,float y) {}
        @Override public void curveTo(float x1,float y1,float x2,float y2,float x3,float y3) {}
        @Override public Point2D getCurrentPoint() { return new Point2D.Float(); }
        @Override public void closePath() {}
        @Override public void endPath() {}
        @Override public void strokePath() {}
        @Override public void fillPath(int windingRule) {}
        @Override public void fillAndStrokePath(int windingRule) {}
        @Override public void shadingFill(COSName shadingName) {}
    }
}
