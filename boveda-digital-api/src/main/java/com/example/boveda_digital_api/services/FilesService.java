package com.example.boveda_digital_api.services;

import com.example.boveda_digital_api.dao.FileSharesDAO;
import com.example.boveda_digital_api.dao.FilesDAO;
import com.example.boveda_digital_api.dao.UsersDAO;
import com.example.boveda_digital_api.entity.FileSharesEntity;
import com.example.boveda_digital_api.entity.FilesEntity;
import com.example.boveda_digital_api.entity.UsersEntity;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FilesService {

    private final FilesDAO filesDAO;
    private final FileSharesDAO fileSharesDAO;
    private final UsersDAO usersDAO;
    private final ObjectMapper objectMapper;

    public FilesService(FilesDAO filesDAO, FileSharesDAO fileSharesDAO, UsersDAO usersDAO) {
        this.filesDAO = filesDAO;
        this.fileSharesDAO = fileSharesDAO;
        this.usersDAO = usersDAO;
        this.objectMapper = new ObjectMapper();
    }

    public void shareFile(
            MultipartFile file,
            String filename,
            Long ownerId,
            String sharesJson,
            String iv,
            String signature,
            Long signerId,
            String signerSigningPublicKey) throws IOException {

        FilesEntity filesEntity = new FilesEntity();
        filesEntity.setOwnerId(ownerId);
        filesEntity.setFilename(filename);
        filesEntity.setFileContent(file.getBytes());
        filesEntity.setIv(iv);
        filesEntity.setSignature(signature);
        filesEntity.setSignerId(signerId);
        filesEntity.setSignerSigningPublicKey(signerSigningPublicKey);
        FilesEntity savedFile = filesDAO.save(filesEntity);

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

            // All shares for this file are needed by the recipient to verify the signature
            List<FileSharesEntity> allFileShares = fileSharesDAO.findByFileId(fileEntity.getId());
            List<Map<String, Object>> allSharesList = allFileShares.stream()
                    .map(s -> {
                        Map<String, Object> m = new HashMap<>();
                        m.put("user_id", s.getUserId());
                        m.put("encrypted_symmetric_key", s.getEncryptedSymmetricKey());
                        return m;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> item = new HashMap<>();
            item.put("file_id", fileEntity.getId());
            item.put("filename", fileEntity.getFilename());
            item.put("iv", fileEntity.getIv());
            item.put("owner", ownerOpt.map(u ->
                    u.getName() + (u.getLastName() != null ? " " + u.getLastName() : "")
            ).orElse("Desconocido"));
            item.put("encrypted_symmetric_key", share.getEncryptedSymmetricKey());
            item.put("created_at", fileEntity.getCreatedAt());
            item.put("signature", fileEntity.getSignature());
            item.put("signer_id", fileEntity.getSignerId());
            // Fetch the signer's public key from the users table (established at registration),
            // not from the files table — the uploader must not control what key is used to verify them.
            String signerPubKey = null;
            if (fileEntity.getSignerId() != null) {
                signerPubKey = usersDAO.findById(fileEntity.getSignerId())
                        .map(UsersEntity::getSigningPublicKey)
                        .orElse(null);
            }
            item.put("signer_signing_public_key", signerPubKey);
            item.put("all_shares", allSharesList);
            result.add(item);
        }

        return result;
    }

    public Optional<FilesEntity> getFileById(UUID fileId) {
        return filesDAO.findById(fileId);
    }
}
