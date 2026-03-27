package com.example.boveda_digital_api.services;

import com.example.boveda_digital_api.dao.FileSharesDAO;
import com.example.boveda_digital_api.dao.FilesDAO;
import com.example.boveda_digital_api.dao.UsersDAO;
import com.example.boveda_digital_api.entity.FileSharesEntity;
import com.example.boveda_digital_api.entity.FilesEntity;
import com.example.boveda_digital_api.entity.UsersEntity;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@Service
public class FilesService {

    private final FilesDAO filesDAO;
    private final FileSharesDAO fileSharesDAO;
    private final UsersDAO usersDAO;
    private final ObjectMapper objectMapper;
    private final Path storageDir;

    public FilesService(FilesDAO filesDAO, FileSharesDAO fileSharesDAO, UsersDAO usersDAO,
                        @Value("${files.storage.path:uploads}") String storagePath) {
        this.filesDAO = filesDAO;
        this.fileSharesDAO = fileSharesDAO;
        this.usersDAO = usersDAO;
        this.objectMapper = new ObjectMapper();
        this.storageDir = Paths.get(storagePath).toAbsolutePath();
    }

    public void shareFile(MultipartFile file, String filename, Long ownerId, String sharesJson, String iv) throws IOException {
        // Ensure storage directory exists
        Files.createDirectories(storageDir);

        // Save file to disk with unique name
        String storedName = UUID.randomUUID() + "_" + filename;
        Path filePath = storageDir.resolve(storedName);
        file.transferTo(filePath.toFile());

        // Insert into files table
        FilesEntity filesEntity = new FilesEntity();
        filesEntity.setOwnerId(ownerId);
        filesEntity.setFilename(filename);
        filesEntity.setFilePath(filePath.toString());
        filesEntity.setIv(iv);
        FilesEntity savedFile = filesDAO.save(filesEntity);

        // Parse shares JSON and insert into file_shares
        List<Map<String, Object>> shares = objectMapper.readValue(sharesJson, new TypeReference<>() {});
        for (Map<String, Object> share : shares) {
            FileSharesEntity shareEntity = new FileSharesEntity();
            shareEntity.setFileId(savedFile.getId());
            shareEntity.setUserId(((Number) share.get("user_id")).longValue());
            shareEntity.setEncryptedSymmetricKey((String) share.get("encrypted_symmetric_key"));
            fileSharesDAO.save(shareEntity);
        }
    }

    public List<Map<String, Object>> getSharedFiles(Long userId) {
        List<FileSharesEntity> shares = fileSharesDAO.findByUserId(userId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (FileSharesEntity share : shares) {
            Optional<FilesEntity> fileOpt = filesDAO.findById(share.getFileId());
            if (fileOpt.isEmpty()) continue;

            FilesEntity fileEntity = fileOpt.get();
            Optional<UsersEntity> ownerOpt = usersDAO.findById(fileEntity.getOwnerId());

            Map<String, Object> item = new HashMap<>();
            item.put("file_id", fileEntity.getId());
            item.put("filename", fileEntity.getFilename());
            item.put("iv", fileEntity.getIv());
            item.put("owner", ownerOpt.map(UsersEntity::getName).orElse("Desconocido"));
            item.put("encrypted_symmetric_key", share.getEncryptedSymmetricKey());
            item.put("created_at", fileEntity.getCreatedAt());
            result.add(item);
        }

        return result;
    }

    public Optional<FilesEntity> getFileById(UUID fileId) {
        return filesDAO.findById(fileId);
    }
}
