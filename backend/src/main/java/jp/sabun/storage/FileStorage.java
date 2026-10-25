package jp.sabun.storage;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FileStorage {
    private final Path root;

    FileStorage(@Value("${app.storage}") String location) throws IOException {
        root = Path.of(location).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public Path directory(UUID id) throws IOException {
        Path p = root.resolve(id.toString());
        Files.createDirectories(p);
        return p;
    }

    public Path file(UUID id, String name) {
        return root.resolve(id.toString()).resolve(name);
    }

    public void delete(UUID id) throws IOException {
        Path dir = root.resolve(id.toString()).normalize();
        if (!dir.getParent().equals(root))
            throw new IOException("Invalid storage path");
        if (Files.exists(dir))
            try (var paths = Files.walk(dir)) {
                for (Path p : paths.sorted(Comparator.reverseOrder()).toList())
                    Files.deleteIfExists(p);
            }
    }
}
