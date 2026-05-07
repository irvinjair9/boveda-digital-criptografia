package com.example.boveda_digital_api.controller;

import com.example.boveda_digital_api.entity.FilesEntity;
import com.example.boveda_digital_api.services.FilesService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
public class FilesController {

    private static final Logger logger = LoggerFactory.getLogger(FilesController.class);
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
            logger.error("Error al compartir archivo", e);
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
                logger.error("Archivo no encontrado en BD: fileId={}", fileId);
                return ResponseEntity.notFound().build();
            }

            FilesEntity fileEntity = fileOpt.get();
            byte[] content = fileEntity.getFileContent();

            if (content == null || content.length == 0) {
                logger.error("Contenido vacío en BD para fileId={}", fileId);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileEntity.getFilename() + "\"")
                    .body(new ByteArrayResource(content));

        } catch (Exception e) {
            logger.error("Error descargando archivo fileId={}", fileId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
