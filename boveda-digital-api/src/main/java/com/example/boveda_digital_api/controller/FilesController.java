package com.example.boveda_digital_api.controller;

import com.example.boveda_digital_api.entity.FilesEntity;
import com.example.boveda_digital_api.services.FilesService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
public class FilesController {

    private final FilesService filesService;

    public FilesController(FilesService filesService) {
        this.filesService = filesService;
    }

    @PostMapping("/share")
    public ResponseEntity<?> shareFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("filename") String filename,
            @RequestParam("owner_id") Long ownerId,
            @RequestParam("shares") String shares,
            @RequestParam("iv") String iv) {
        try {
            filesService.shareFile(file, filename, ownerId, shares, iv);
            return ResponseEntity.ok(Map.of("message", "Archivo compartido exitosamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error al compartir archivo: " + e.getMessage()));
        }
    }

    @GetMapping("/shared/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getSharedFiles(@PathVariable Long userId) {
        List<Map<String, Object>> files = filesService.getSharedFiles(userId);
        return ResponseEntity.ok(files);
    }

    @GetMapping("/shared/download/{fileId}")
    public ResponseEntity<Resource> downloadFile(@PathVariable UUID fileId) {
        try {
            Optional<FilesEntity> fileOpt = filesService.getFileById(fileId);
            if (fileOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            FilesEntity fileEntity = fileOpt.get();
            Path path = Paths.get(fileEntity.getFilePath());
            Resource resource = new UrlResource(path.toUri());

            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileEntity.getFilename() + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
